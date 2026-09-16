/* global process */
import { constants } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from '../api/_lib/talent-db.js';
import { createJoinOrionSourceAdapter } from './lib/join-orion-source-adapter.mjs';
import { createPostgresQuery } from './lib/join-orion-source-inspection.mjs';

function parseArgs(args) {
  const outputIndex = args.indexOf('--output');
  const force = args.includes('--force');
  const allowed = new Set(['--output', '--force']);
  const unknown = args.filter((arg, index) => !allowed.has(arg) && index !== outputIndex + 1);
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`);
  if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error('--output PATH is required');
  return { output: args[outputIndex + 1], force };
}

export async function runCli(args, environment = process.env, connect = postgres) {
  const options = parseArgs(args);
  if (!environment.JOIN_ORION_EXPORT_FILE?.trim() && !environment.JOIN_ORION_DATABASE_URL?.trim()) throw new Error('JOIN_ORION_DATABASE_URL or JOIN_ORION_EXPORT_FILE is required');
  const sourceCa = parseCrmCa(environment.JOIN_ORION_DATABASE_CA_CERT);
  const sql = environment.JOIN_ORION_EXPORT_FILE?.trim() ? null : connect(validateCrmUrl(environment.JOIN_ORION_DATABASE_URL),
    { max: 1, prepare: false, ssl: { rejectUnauthorized: true, ...(sourceCa ? { ca: sourceCa } : {}) } });
  try {
    const source = sql ? createJoinOrionSourceAdapter(createPostgresQuery(sql))
      : { read: async () => JSON.parse(await readFile(environment.JOIN_ORION_EXPORT_FILE, 'utf8')) };
    const snapshot = await source.read();
    const manifest = { manifest_version: 1, source_system: 'join-orion', records: snapshot.applications
      .map(row => String(row.source_id)).sort().map(application_source_id => ({ application_source_id,
        classification: '', reason: '', reviewed_by: '', reviewed_at: '' })) };
    await writeFile(options.output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: options.force ? 'w' : 'wx', mode: constants.S_IRUSR | constants.S_IWUSR });
    return { output: options.output, records: manifest.records.length };
  } finally { await sql?.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli(process.argv.slice(2)).then(result => {
  process.stdout.write(`Wrote ${result.records} unclassified application IDs to ${result.output}\n`);
}).catch(error => { process.stderr.write(`Exclusion template generation failed: ${error.message}\n`); process.exitCode = 1; });
