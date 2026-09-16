import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from '../api/_lib/talent-db.js';
import { provisionJoinOrionExclusions } from './lib/join-orion-exclusion-provisioning.mjs';

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const connectionOptions = (ca, applicationName) => ({ max: 1, prepare: false,
  connection: { application_name: applicationName },
  ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });

function createTarget(sql) {
  const rows = (statement, parameters = []) => sql.unsafe(statement, parameters);
  const adapter = query => ({
    getWorkspace: async id => (await query('select id::text, name, slug from crm.workspaces where id=$1::uuid', [id]))[0],
    readExclusions: async (id, options = {}) => query(`select application_source_id::text, classification, reason, reviewed_by, reviewed_at
      from crm.join_orion_source_exclusions where workspace_id=$1::uuid and source_system='join-orion'
      order by application_source_id${options.lock ? ' for update' : ''}`, [id]),
    setApplicationName: name => query("select set_config('application_name', $1, true)", [name]),
    lockWorkspace: id => query("select pg_advisory_xact_lock(hashtext('crm:join-orion-exclusions:' || $1))", [id]),
    insertExclusions: async (id, records) => {
      for (const row of records) await query(`insert into crm.join_orion_source_exclusions
        (workspace_id, source_system, application_source_id, classification, reason, reviewed_by, reviewed_at)
        values ($1::uuid, 'join-orion', $2::uuid, $3, $4, $5, $6::timestamptz)`,
      [id, row.application_source_id, row.classification, row.reason, row.reviewed_by, row.reviewed_at]);
    },
  });
  return { ...adapter(rows), transaction: callback => sql.begin(transaction => callback(adapter((q, p = []) => transaction.unsafe(q, p)))) };
}

export async function runCli(args, environment = process.env, connect = postgres) {
  const unknown = args.filter(arg => arg !== '--apply');
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  const crmUrl = validateCrmUrl(required(environment, 'CRM_DATABASE_URL'));
  const sourceUrl = validateCrmUrl(required(environment, 'JOIN_ORION_DATABASE_URL'));
  const workspaceId = required(environment, 'CRM_WORKSPACE_ID');
  const filename = required(environment, 'JOIN_ORION_EXCLUSION_FILE');
  const operator = required(environment, 'JOIN_ORION_EXCLUSION_OPERATOR');
  const expectedFingerprint = required(environment, 'JOIN_ORION_EXCLUSION_FINGERPRINT');
  const manifest = JSON.parse(await readFile(filename, 'utf8'));
  const applicationName = `join-orion-exclusions:${operator}`;
  const crm = connect(crmUrl, connectionOptions(parseCrmCa(environment.CRM_DATABASE_CA_CERT), applicationName));
  const sourceSql = connect(sourceUrl, connectionOptions(parseCrmCa(environment.JOIN_ORION_DATABASE_CA_CERT), applicationName));
  try {
    const source = { findApplicationIds: async ids => (await sourceSql.unsafe(
      'select id::text from public.candidate_applications where id = any($1::uuid[]) order by id', [ids])).map(row => row.id) };
    return await provisionJoinOrionExclusions({ manifest, expectedFingerprint, workspaceId, operator,
      source, target: createTarget(crm), apply: args.includes('--apply') });
  } finally { await Promise.allSettled([crm.end(), sourceSql.end()]); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli(process.argv.slice(2)).then(report => {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}).catch(error => {
  process.stderr.write(`Exclusion provisioning failed: ${error.message}\n`);
  if (error.report) process.stderr.write(`${JSON.stringify(error.report, null, 2)}\n`);
  process.exitCode = 1;
});
