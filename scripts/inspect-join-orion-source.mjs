/* global process */
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from '../api/_lib/talent-db.js';
import { assertSeparateSourceAndTarget, createPostgresQuery, inspectJoinOrionSource } from './lib/join-orion-source-inspection.mjs';

export async function runInspection(environment = process.env, connect = postgres) {
  const sourceUrl = validateCrmUrl(environment.JOIN_ORION_DATABASE_URL);
  const targetUrl = validateCrmUrl(environment.CRM_DATABASE_URL);
  const ca = parseCrmCa(environment.JOIN_ORION_DATABASE_CA_CERT);
  const targetCa = parseCrmCa(environment.CRM_DATABASE_CA_CERT);
  const sql = connect(sourceUrl, { max: 1, prepare: false, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });
  const target = connect(targetUrl, { max: 1, prepare: false, ssl: { rejectUnauthorized: true, ...(targetCa ? { ca: targetCa } : {}) } });
  try {
    const report = await inspectJoinOrionSource(createPostgresQuery(sql));
    const targetIdentity = (await target.unsafe(`select current_database() as database_name,
      (select system_identifier::text from pg_control_system()) as system_identifier`))[0];
    return { ...report, source_target_relationship: assertSeparateSourceAndTarget(report.source_identity, targetIdentity) };
  } finally { await Promise.all([sql.end(), target.end()]); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runInspection().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)).catch(error => {
    process.stderr.write(`Join-Orion source inspection failed: ${error.message}\n`); process.exitCode = 1;
  });
}
