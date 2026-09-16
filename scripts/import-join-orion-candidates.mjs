/* global process */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from '../api/_lib/talent-db.js';
import { formatReconciliationReport, reconcileJoinOrionCandidates } from './lib/join-orion-candidate-import.mjs';
import { createPostgresImportTarget } from './lib/join-orion-postgres-target.mjs';
import { createJoinOrionSourceAdapter } from './lib/join-orion-source-adapter.mjs';
import { createPostgresQuery } from './lib/join-orion-source-inspection.mjs';

function parseArgs(args) {
  const known = new Set(['--apply', '--json']);
  const unknown = args.filter(arg => !known.has(arg));
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  return { apply: args.includes('--apply'), json: args.includes('--json') };
}

export async function runCli(args, environment = process.env, connect = postgres) {
  const options = parseArgs(args);
  if (!environment.JOIN_ORION_EXPORT_FILE?.trim() && !environment.JOIN_ORION_DATABASE_URL?.trim()) throw new Error('JOIN_ORION_DATABASE_URL or JOIN_ORION_EXPORT_FILE is required');
  if (!environment.CRM_WORKSPACE_ID?.trim()) throw new Error('CRM_WORKSPACE_ID is required');
  if (options.apply && !environment.CRM_IMPORT_OPERATOR?.trim()) throw new Error('--apply requires CRM_IMPORT_OPERATOR');
  const databaseUrl = validateCrmUrl(environment.CRM_DATABASE_URL);
  const ca = parseCrmCa(environment.CRM_DATABASE_CA_CERT);
  const sql = connect(databaseUrl, { max: 1, prepare: false, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });
  const sourceCa = parseCrmCa(environment.JOIN_ORION_DATABASE_CA_CERT);
  const sourceSql = environment.JOIN_ORION_EXPORT_FILE?.trim() ? null : connect(validateCrmUrl(environment.JOIN_ORION_DATABASE_URL),
    { max: 1, prepare: false, ssl: { rejectUnauthorized: true, ...(sourceCa ? { ca: sourceCa } : {}) } });
  const source = sourceSql ? createJoinOrionSourceAdapter(createPostgresQuery(sourceSql))
    : { read: async () => JSON.parse(await readFile(environment.JOIN_ORION_EXPORT_FILE, 'utf8')) };
  try {
    const report = await reconcileJoinOrionCandidates({ source, target: createPostgresImportTarget(sql),
      workspaceId: environment.CRM_WORKSPACE_ID.trim(), mode: options.apply ? 'apply' : 'dry-run',
      operator: options.apply ? environment.CRM_IMPORT_OPERATOR.trim() : null });
    return { report, output: options.json ? JSON.stringify(report, null, 2) : formatReconciliationReport(report) };
  } finally { await Promise.all([sql.end(), sourceSql?.end()]); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).then(({ output }) => process.stdout.write(`${output}\n`)).catch(error => {
    process.stderr.write(`Join-Orion candidate import failed: ${error.message}\n`); process.exitCode = 1;
  });
}
