/* global process */
import postgres from 'postgres';
import { X509Certificate } from 'node:crypto';
import { TalentFailure, databaseFailure, configurationFailure } from './talent-diagnostics.js';

export function validateCrmUrl(value) {
  if (!value) throw new TalentFailure('crm_not_configured', 'configuration');
  const fail = reason => { throw configurationFailure('CRM_DATABASE_URL', reason); };
  if (typeof value !== 'string') fail('invalid_url');
  if (value !== value.trim()) fail('surrounding_whitespace');
  let url;
  try { url = new URL(value); } catch { fail('invalid_url'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('unsupported_protocol');
  if (!url.hostname) fail('missing_hostname');
  if (!url.username) fail('missing_username');
  if (!url.password) fail('missing_password');
  if (url.pathname.length < 2) fail('missing_database');
  if (url.hash) fail('unexpected_fragment');
  // Validate once without rewriting credentials; the driver performs its own decode.
  try { decodeURIComponent(url.username); } catch { fail('invalid_username_encoding'); }
  try { decodeURIComponent(url.password); } catch { fail('invalid_password_encoding'); }
  return value;
}

export function parseCrmCa(value) {
  if (value === undefined || value === '') return undefined;
  const fail = reason => { throw configurationFailure('CRM_DATABASE_CA_CERT', reason); };
  if (typeof value !== 'string') fail('invalid_pem');
  // Environment strings may contain actual newlines or escaped newline characters.
  const pem = value.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) fail('invalid_pem');
  for (const block of blocks) {
    if (!/^-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\s]+\n-----END CERTIFICATE-----$/.test(block)) fail('invalid_pem');
    try { new X509Certificate(block); } catch { fail('malformed_certificate'); }
  }
  return blocks.join('\n');
}

export function createTalentDatabase({ makePool = postgres, environment = () => process.env } = {}) {
  let pool;
  return async (userId, read) => {
    const env = environment();
    const url = validateCrmUrl(env.CRM_DATABASE_URL);
    if (!pool) {
      const ca = parseCrmCa(env.CRM_DATABASE_CA_CERT);
      try {
        pool = makePool(url, {
          ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
          prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10,
          onnotice: () => {}, // Driver notices are not a safe diagnostic channel.
        });
      } catch (error) {
        const failure = databaseFailure(error, 'crm_configuration_invalid', 'configuration');
        throw failure.category === 'crm_configuration_invalid'
          ? configurationFailure('CRM_DATABASE_POOL', 'initialization_failed') : failure;
      }
    }
    let stage = 'transaction_begin';
    try {
      return await pool.begin('isolation level repeatable read read only', async sql => {
        const step = async (category, phase, query, parameters = []) => {
          try { return await sql.unsafe(query, parameters); }
          catch (error) { throw databaseFailure(error, category, phase); }
        };
        // One pinned transaction; neither role nor claims survive commit/rollback.
        await step('crm_role_assumption_failed', 'role_assumption', 'set local role authenticated');
        await step('crm_auth_context_failed', 'auth_context', "select set_config('request.jwt.claim.sub', $1, true)", [userId]);
        await step('crm_auth_context_failed', 'auth_context', "select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
        await step('crm_auth_context_failed', 'auth_context', "set local statement_timeout = '10s'");
        const [context] = await step('crm_auth_context_failed', 'auth_context', `select
          current_user = 'authenticated' as role_ok, auth.uid() = $1::uuid as subject_ok,
          current_setting('transaction_read_only') = 'on' as read_only`, [userId]);
        if (!context?.role_ok || !context?.subject_ok || !context?.read_only) {
          throw new TalentFailure('crm_auth_context_failed', 'auth_context');
        }
        stage = 'candidate_read';
        const result = await read((query, parameters = [], phase = 'candidate_read') => step('crm_query_failed', phase, query, parameters));
        stage = 'transaction_commit';
        return result;
      });
    } catch (error) {
      throw databaseFailure(error, stage === 'transaction_begin' ? 'crm_connection_failed' : 'crm_query_failed', stage);
    }
  };
}
export const withTalentDatabase = createTalentDatabase();
