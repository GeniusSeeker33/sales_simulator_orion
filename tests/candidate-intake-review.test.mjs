import test from 'node:test';
import assert from 'node:assert/strict';
import { JoinOrionSourceAdapter } from '../scripts/lib/join-orion-source-adapter.mjs';
import { buildJoinOrionIntakeReview } from '../scripts/lib/join-orion-intake-review.mjs';
import { joinOrionDatabaseRows } from './fixtures/join-orion-database.mjs';

const workspaceId = '00000000-0000-4000-8000-000000000010';
const key = (entity, id) => `join-orion\u0000${entity}\u0000${id}`;
function target(provenance = new Set(), peopleByEmail = {}) {
  return {
    async getWorkspace(id) { return id === workspaceId ? { id, slug: 'orion', name: 'Orion' } : null; },
    async inspect(id) { return { workspace_id: id, provenance, people_by_email: peopleByEmail, people_by_provenance: {}, application_ids: {} }; },
  };
}
const manifestFor = applications => ({ manifest_version: 1, source_system: 'join-orion', records: applications.map(row => ({
  application_source_id: row.id, classification: 'historical_test_data', reason: 'Reviewed historical fixture',
  reviewed_by: 'reviewer@example.test', reviewed_at: '2026-09-15T12:00:00Z',
})) });
const adapterFor = rows => new JoinOrionSourceAdapter(async sql => sql.includes('candidate_applications') ? rows.applications : rows.activities);

test('current 15 reviewed exclusions produce an empty actionable queue', async () => {
  const rows = joinOrionDatabaseRows();
  const queue = await buildJoinOrionIntakeReview({ source: adapterFor(rows), target: target(), workspaceId, exclusionManifest: manifestFor(rows.applications) });
  assert.equal(queue.actionable_count, 0);
  assert.equal(queue.diagnostics.excluded_count, 15);
  assert.deepEqual(queue.items, []);
  assert.ok(queue.exclusion_manifest.fingerprint);
});

test('one future application is actionable by default and uses the CLI reconciliation mapping', async () => {
  const rows = joinOrionDatabaseRows();
  rows.applications.push({ ...rows.applications[14], id: '00000000-0000-4000-9001-000000000016', first_name: 'Future', last_name: 'Applicant',
    email: 'future@example.test', phone: '+1 555 010 9999', created_at: new Date('2026-09-16T12:00:00Z'), resume_path: 'private/future.pdf' });
  const queue = await buildJoinOrionIntakeReview({ source: adapterFor(rows), target: target(), workspaceId,
    exclusionManifest: manifestFor(rows.applications.slice(0, 15)) });
  assert.equal(queue.actionable_count, 1);
  assert.equal(queue.items[0].state, 'ready_for_review');
  assert.deepEqual(queue.items[0].proposed_crm_mapping, { lifecycle_stage: 'applicant', application_type: 'candidate', application_status: 'in_review' });
  assert.equal(queue.items[0].resume_metadata_exists, true);
});

test('already imported is not actionable and duplicate evidence requires identity review', async () => {
  const rows = joinOrionDatabaseRows();
  rows.applications = rows.applications.slice(0, 2);
  rows.activities = [];
  let queue = await buildJoinOrionIntakeReview({ source: adapterFor(rows), target: target(new Set([key('candidate_applications', rows.applications[0].id)])), workspaceId });
  assert.equal(queue.actionable_count, 1);
  assert.equal(queue.items[0].state, 'identity_review_required');
  assert.ok(queue.items[0].duplicate_evidence.categories.includes('email'));
  assert.equal(queue.diagnostics.already_imported_count, 1);
  assert.equal(queue.items[0].ready_for_import, false);
});

test('invalid and mapping records are distinguished from an empty queue', async () => {
  const rows = joinOrionDatabaseRows();
  rows.applications = [{ ...rows.applications[2], created_at: 'invalid-date' }, { ...rows.applications[3], status: 'unmapped-future-state' }];
  rows.activities = [];
  const queue = await buildJoinOrionIntakeReview({ source: adapterFor(rows), target: target(), workspaceId });
  assert.equal(queue.actionable_count, 0);
  assert.equal(queue.diagnostics.invalid_count, 1);
  assert.equal(queue.diagnostics.source_mapping_attention_count, 1);
});

test('review projection never exposes private candidate or storage fields and linkage remains unverified', async () => {
  const rows = joinOrionDatabaseRows();
  rows.applications = [{ ...rows.applications[2], cover_letter: 'SECRET COVER', admin_notes: 'SECRET ADMIN',
    referral_payout_amount: 999, resume_path: 'private/SECRET_PATH.pdf' }];
  rows.activities = [];
  const queue = await buildJoinOrionIntakeReview({ source: adapterFor(rows), target: target(), workspaceId });
  const json = JSON.stringify(queue);
  for (const prohibited of ['cover_letter', 'SECRET COVER', 'admin_notes', 'SECRET ADMIN', 'referral_payout', 'resume_path', 'SECRET_PATH']) assert.equal(json.includes(prohibited), false, prohibited);
  assert.deepEqual(queue.items[0].linkage, { learner: 'not_verified', employment: 'not_verified' });
});
