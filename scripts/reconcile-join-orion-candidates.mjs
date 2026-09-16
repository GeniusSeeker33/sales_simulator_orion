/* global process */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from '../api/_lib/talent-db.js';
import { buildDuplicateReconciliation, formatDuplicateReconciliation } from './lib/join-orion-duplicate-reconciliation.mjs';
import { createJoinOrionSourceAdapter } from './lib/join-orion-source-adapter.mjs';
import { createPostgresQuery } from './lib/join-orion-source-inspection.mjs';

function parseArgs(args) {
  const known = new Set(['--json', '--redacted']);
  const unknown = args.filter(arg => !known.has(arg));
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  return { json: args.includes('--json'), redacted: args.includes('--redacted') };
}

export async function runCli(args, environment = process.env, connect = postgres) {
  const options = parseArgs(args);
  if (!environment.JOIN_ORION_EXPORT_FILE?.trim() && !environment.JOIN_ORION_DATABASE_URL?.trim()) throw new Error('JOIN_ORION_DATABASE_URL or JOIN_ORION_EXPORT_FILE is required');
  const ca = parseCrmCa(environment.JOIN_ORION_DATABASE_CA_CERT);
  const sql = environment.JOIN_ORION_EXPORT_FILE?.trim() ? null : connect(validateCrmUrl(environment.JOIN_ORION_DATABASE_URL),
    { max: 1, prepare: false, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });
  try {
    const source = sql ? createJoinOrionSourceAdapter(createPostgresQuery(sql))
      : { read: async () => JSON.parse(await readFile(environment.JOIN_ORION_EXPORT_FILE, 'utf8')) };
    const report = buildDuplicateReconciliation(await source.read(), options);
    return { report, output: options.json ? JSON.stringify(report, null, 2) : formatDuplicateReconciliation(report) };
  } finally { await sql?.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli(process.argv.slice(2)).then(({ output }) => {
  process.stdout.write(`${output}\n`);
}).catch(error => { process.stderr.write(`Join-Orion reconciliation failed: ${error.message}\n`); process.exitCode = 1; });
