import test from 'node:test';
import assert from 'node:assert/strict';
import { applyExclusions, validateExclusionManifest } from '../scripts/lib/join-orion-exclusions.mjs';
import { reconcileJoinOrionCandidates } from '../scripts/lib/join-orion-candidate-import.mjs';
import { buildDuplicateReconciliation } from '../scripts/lib/join-orion-duplicate-reconciliation.mjs';

const excludedId = '11111111-1111-4111-8111-111111111111';
const eligibleId = '22222222-2222-4222-8222-222222222222';
const manifest = (overrides = {}) => ({ manifest_version: 1, source_system: 'join-orion', records: [{
  application_source_id: excludedId, classification: 'historical_test_data', reason: 'Reviewed fixture record',
  reviewed_by: 'ticket-49/operator', reviewed_at: '2026-09-16T10:00:00Z', ...overrides }] });
const app = id => ({ source_id: id, identity_scope: 'application', first_name: 'Same', last_name: 'Person',
  email: 'same@example.test', phone: '5551234567', status: 'submitted', submitted_at: '2026-09-01T00:00:00Z' });
const snapshot = () => ({ contract_version: 1, applications: [app(excludedId), app(eligibleId)], activities: [
  { source_id: 'a1', identity_scope: 'application', application_source_id: excludedId, type: 'note', summary: 'x', occurred_at: '2026-09-01T00:00:00Z' },
  { source_id: 'a2', identity_scope: 'application', application_source_id: eligibleId, type: 'note', summary: 'x', occurred_at: '2026-09-01T00:00:00Z' }],
documents: [{ source_id: 'd1', identity_scope: 'application', application_source_id: excludedId, source_entity: 'candidate_application_resumes', document_type: 'resume', storage_path: 'private/x' }], consents: [] });

const target = () => ({ writes: 0, async getWorkspace(id) { return { id, slug: 'x', name: 'X' }; },
  async inspect(id) { return { workspace_id: id, provenance: new Set(), people_by_email: {}, people_by_provenance: {}, application_ids: {} }; },
  async apply({ plan }) { this.writes += Object.values(plan).flat().length; return { writes: this.writes, batches: [] }; } });

test('manifest validation is strict and fingerprint deterministic', () => {
  const first = validateExclusionManifest(manifest());
  const second = validateExclusionManifest({ ...manifest(), records: [...manifest().records].reverse() });
  assert.equal(first.fingerprint, second.fingerprint);
  for (const [change, pattern] of [
    [{ application_source_id: 'not-uuid' }, /malformed/], [{ classification: 'spam' }, /Unsupported/],
    [{ reason: '' }, /reason/], [{ reviewed_by: '' }, /reviewed_by/], [{ reviewed_at: '' }, /reviewed_at/],
  ]) assert.throws(() => validateExclusionManifest(manifest(change)), pattern);
  assert.throws(() => validateExclusionManifest({ ...manifest(), records: [...manifest().records, ...manifest().records] }), /Duplicate/);
});

test('explicit exclusion removes only the application and its authoritative dependents', () => {
  const result = applyExclusions(snapshot(), validateExclusionManifest(manifest()));
  assert.deepEqual(result.snapshot.applications.map(row => row.source_id), [eligibleId]);
  assert.deepEqual(result.snapshot.activities.map(row => row.source_id), ['a2']);
  assert.equal(result.snapshot.documents.length, 0);
  assert.deepEqual(result.excluded, { applications: 1, activities: 1, documents: 1, consents: 0,
    classification_counts: { historical_test_data: 1 } });
  assert.equal(result.metadata.unmatched_manifest_ids.length, 0);
});

test('contact similarity never excludes unrelated or future applications', () => {
  const result = applyExclusions(snapshot(), validateExclusionManifest(manifest()));
  assert.equal(result.snapshot.applications[0].source_id, eligibleId);
});

test('nonexistent source UUID fails closed', () => {
  assert.throws(() => applyExclusions(snapshot(), validateExclusionManifest(manifest({ application_source_id: '33333333-3333-4333-8333-333333333333' }))), /not found/);
});

test('import and duplicate reconciliation omit exclusions and report them separately', async () => {
  const store = target();
  const validated = validateExclusionManifest(manifest());
  const report = await reconcileJoinOrionCandidates({ source: { read: async () => structuredClone(snapshot()) }, target: store,
    workspaceId: eligibleId, exclusionManifest: manifest() });
  assert.deepEqual(report.proposed, { people: 1, applications: 1, activities: 1, documents: 0, consents: 0 });
  assert.equal(report.excluded.applications, 1); assert.equal(report.potential_duplicates.length, 0);
  assert.equal(report.identity_conflicts.length, 0); assert.equal(report.writes_performed, 0); assert.equal(store.writes, 0);
  const duplicates = buildDuplicateReconciliation(snapshot(), { exclusionManifest: manifest() });
  assert.equal(duplicates.cases.length, 0); assert.equal(duplicates.summary.source_applications, 2);
  assert.equal(duplicates.summary.applications_excluded, 1); assert.equal(duplicates.summary.applications_eligible, 1);
  assert.equal(duplicates.exclusion_manifest.fingerprint, validated.fingerprint);
});

test('apply revalidates reviewed manifest and never writes excluded records', async () => {
  const store = target(); const validated = validateExclusionManifest(manifest()); let loads = 0;
  const report = await reconcileJoinOrionCandidates({ source: { read: async () => structuredClone(snapshot()) }, target: store,
    workspaceId: eligibleId, mode: 'apply', operator: 'ticket-49', exclusionManifestLoader: async () => { loads++; return manifest(); },
    reviewedExclusionFingerprint: validated.fingerprint });
  assert.equal(loads, 2); assert.equal(report.writes_performed, 3); assert.equal(store.writes, 3);
  await assert.rejects(reconcileJoinOrionCandidates({ source: { read: async () => structuredClone(snapshot()) }, target: target(),
    workspaceId: eligibleId, mode: 'apply', operator: 'ticket-49', exclusionManifest: manifest(), reviewedExclusionFingerprint: 'changed' }), /reviewed exclusion/);
});

test('manifest changes between review and apply are detected before writes', async () => {
  const store = target(); let loads = 0;
  await assert.rejects(reconcileJoinOrionCandidates({ source: { read: async () => structuredClone(snapshot()) }, target: store,
    workspaceId: eligibleId, mode: 'apply', operator: 'ticket-49', reviewedExclusionFingerprint: validateExclusionManifest(manifest()).fingerprint,
    exclusionManifestLoader: async () => ++loads === 1 ? manifest() : manifest({ reason: 'Changed after review' }) }), /changed during apply/);
  assert.equal(store.writes, 0);
});
