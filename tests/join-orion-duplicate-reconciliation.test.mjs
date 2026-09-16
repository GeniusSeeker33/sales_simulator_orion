import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateReconciliation, formatDuplicateReconciliation } from '../scripts/lib/join-orion-duplicate-reconciliation.mjs';

const application = (id, overrides = {}) => ({ source_id: id, identity_scope: 'application', first_name: `First ${id}`,
  last_name: 'Person', email: `${id}@example.test`, phone: `555000${id.charCodeAt(id.length - 1)}`, status: 'submitted',
  source_status: 'new', submitted_at: '2026-08-01T12:00:00Z', owner_ref: 'Recruiter',
  payload: { position_title: 'Sales', application_source: 'website', source_status: 'new' }, ...overrides });
const snapshot = applications => ({ contract_version: 1, applications, activities: [{ summary: 'private note' }],
  documents: [{ storage_path: 'private/resume.pdf' }], consents: [] });

test('groups exact, single-signal, normalized, and transitive matches while excluding unrelated records', () => {
  const records = [
    application('app-a', { first_name: ' Alex ', last_name: 'Example', email: 'ALEX@EXAMPLE.TEST ', phone: '+1 (555) 010-1000' }),
    application('app-b', { first_name: 'alex', last_name: ' example ', email: 'alex@example.test', phone: '1-555-010-1000' }),
    application('app-c', { first_name: 'Other', last_name: 'Candidate', email: 'alex@example.test', phone: '999' }),
    application('app-d', { first_name: 'Phone', last_name: 'Only', phone: '(212) 555-1212' }),
    application('app-e', { first_name: 'Different', last_name: 'Name', phone: '212.555.1212' }),
    application('app-f', { first_name: 'Name', last_name: 'Only' }),
    application('app-g', { first_name: ' name ', last_name: ' ONLY ', email: 'unique-g@example.test', phone: '777' }),
    application('app-h'),
  ];
  const report = buildDuplicateReconciliation(snapshot(records));
  assert.equal(report.summary.reconciliation_cases, 3);
  assert.equal(report.summary.applications_in_cases, 7);
  assert.equal(report.summary.applications_without_duplicate_signals, 1);
  const transitive = report.cases.find(item => item.applications.some(row => row.source_application_id === 'app-a'));
  assert.deepEqual(transitive.applications.map(row => row.source_application_id), ['app-a', 'app-b', 'app-c']);
  assert.deepEqual(transitive.relationships.find(row => row.application_b === 'app-b').evidence, { email: true, phone: true, name: true });
  assert.deepEqual(transitive.relationships.find(row => row.application_a === 'app-a' && row.application_b === 'app-c').evidence,
    { email: true, phone: false, name: false });
  assert.equal(report.summary.writes_performed, 0);
  assert.equal(report.cases.flatMap(item => item.applications).some(row => row.source_application_id === 'app-h'), false);
});

test('case IDs and JSON output are stable regardless of source order', () => {
  const records = [application('app-z', { email: 'same@example.test' }), application('app-a', { email: 'SAME@example.test' })];
  const first = buildDuplicateReconciliation(snapshot(records));
  const second = buildDuplicateReconciliation(snapshot([...records].reverse()));
  assert.match(first.cases[0].case_id, /^DUP-[A-F0-9]{12}$/);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('worksheet is unset and report is a review aid, never an automatic merge', () => {
  const report = buildDuplicateReconciliation(snapshot([
    application('app-1', { email: 'same@example.test' }), application('app-2', { email: 'same@example.test' }),
  ]));
  assert.deepEqual(report.worksheet[0], { case_id: report.cases[0].case_id, source_application_ids: ['app-1', 'app-2'],
    decision: null, reviewed_by: null, reviewed_at: null, reason: null });
  assert.equal('recommendation' in report.cases[0], false);
  assert.equal('confidence' in report.cases[0], false);
  assert.equal(report.summary.writes_performed, 0);
});

test('redacted output masks contacts and omits prohibited source fields', () => {
  const records = [application('app-1', { email: 'person@example.test', phone: '+1 212 555 9876', cover_letter: 'secret cover',
    notes: 'secret note', admin_notes: 'secret admin', referral_payout_amount: 100, referral_payout_status: 'paid', resume_path: 'private/resume.pdf' }),
  application('app-2', { email: 'PERSON@example.test', phone: '1-212-555-9876' })];
  const report = buildDuplicateReconciliation(snapshot(records), { redacted: true });
  const output = formatDuplicateReconciliation(report), json = JSON.stringify(report);
  assert.doesNotMatch(output, /person@example\.test/i);
  assert.doesNotMatch(output, /12125559876|1 212 555 9876|1-212-555-9876/);
  assert.match(output, /p\*\*\*@e\*\*\*\.test/);
  for (const prohibited of ['cover_letter', 'secret cover', 'secret note', 'secret admin', 'referral_payout', 'resume_path', 'private/resume', 'activity']) assert.equal(json.includes(prohibited), false, prohibited);
});
