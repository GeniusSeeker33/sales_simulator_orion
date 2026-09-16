import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSeparateSourceAndTarget, inspectJoinOrionSource } from '../scripts/lib/join-orion-source-inspection.mjs';

const fixture = [
  [{ database_name: 'join_orion', system_identifier: 'source-cluster' }],
  [{ schema_name: 'public', relation_name: 'candidate_applications', relation_type: 'table', estimated_row_count: 2 },
    { schema_name: 'public', relation_name: 'dealer_inquiries', relation_type: 'table', estimated_row_count: 9 }],
  [
    { schema_name: 'public', relation_name: 'candidate_applications', column_name: 'id', data_type: 'uuid', udt_name: 'uuid', nullable: false },
    { schema_name: 'public', relation_name: 'candidate_applications', column_name: 'email', data_type: 'text', udt_name: 'text', nullable: false },
    { schema_name: 'public', relation_name: 'candidate_applications', column_name: 'status', data_type: 'text', udt_name: 'text', nullable: false },
    { schema_name: 'public', relation_name: 'candidate_applications', column_name: 'stage', data_type: 'USER-DEFINED', udt_name: 'application_status', nullable: false },
    { schema_name: 'public', relation_name: 'candidate_applications', column_name: 'resume_path', data_type: 'text', udt_name: 'text', nullable: true },
    { schema_name: 'public', relation_name: 'candidate_applications', column_name: 'consent_evidence', data_type: 'jsonb', udt_name: 'jsonb', nullable: true },
  ],
  [{ schema_name: 'public', relation_name: 'candidate_applications', constraint_name: 'candidate_applications_pkey', constraint_type: 'primary_key', columns: ['id'], referenced_schema: null, referenced_relation: null }],
  [{ enum_schema: 'public', enum_name: 'application_status', values: ['submitted', 'reviewing'] }],
];

test('inspection reports candidate metadata, constraints, and privacy-safe category candidates only', async () => {
  let call = 0;
  const report = await inspectJoinOrionSource(async () => fixture[call++]);
  assert.equal(report.relations.length, 1);
  assert.deepEqual(report.safe_distinct_candidates, [{ schema_name: 'public', relation_name: 'candidate_applications', column_name: 'status' }]);
  assert.equal(report.constraints[0].constraint_type, 'primary_key');
  assert.deepEqual(report.enum_values[0].values, ['submitted', 'reviewing']);
  assert.equal(report.field_presence.document_storage[0].column_name, 'resume_path');
  assert.equal(report.field_presence.consent_evidence[0].column_name, 'consent_evidence');
  const output = JSON.stringify(report);
  assert.doesNotMatch(output, /person@example|555-|candidate name|application text/i);
});

test('inspection SQL never selects candidate relations or distinct candidate values', async () => {
  const statements = []; let call = 0;
  await inspectJoinOrionSource(async sql => { statements.push(sql); return fixture[call++]; });
  assert.ok(statements.every(sql => !/select\s+\*|from\s+public\.candidate_applications|\bdistinct\s+status/i.test(sql)));
});

test('source/target guard uses database system identity, not hostname', () => {
  assert.equal(assertSeparateSourceAndTarget({ database_name: 'source', system_identifier: '1' }, { database_name: 'target', system_identifier: '2' }), 'separate');
  assert.throws(() => assertSeparateSourceAndTarget({ database_name: 'same', system_identifier: '1' }, { database_name: 'same', system_identifier: '1' }), /CRM target database/);
  assert.throws(() => assertSeparateSourceAndTarget({}, {}), /Cannot verify/);
});
