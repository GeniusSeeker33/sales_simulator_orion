/* global process */
import postgres from 'postgres';
import { TalentFailure, databaseFailure } from './talent-diagnostics.js';

export function validateCrmUrl(value) {
  if (!value) throw new TalentFailure('crm_not_configured', 'configuration');
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username
      || !url.password || url.pathname.length < 2 || url.hash || value !== value.trim()) throw new Error();
    // The driver also decodes credentials. Reject malformed escapes before it can
    // produce a URI error containing the original connection string.
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    return value;
  } catch { throw new TalentFailure('crm_configuration_invalid', 'configuration'); }
}

export function createTalentDatabase({ makePool = postgres, environment = () => process.env } = {}) {
  let pool;
  return async (userId, read) => {
    const env = environment();
    const url = validateCrmUrl(env.CRM_DATABASE_URL);
    if (!pool) {
      try {
        pool = makePool(url, {
          ssl: { rejectUnauthorized: true, ...(env.CRM_DATABASE_CA_CERT ? { ca: env.CRM_DATABASE_CA_CERT } : {}) },
          prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10,
          onnotice: () => {}, // Driver notices are not a safe diagnostic channel.
        });
      } catch (error) { throw databaseFailure(error, 'crm_configuration_invalid', 'configuration'); }
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
