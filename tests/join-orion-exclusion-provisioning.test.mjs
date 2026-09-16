import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionJoinOrionExclusions } from '../scripts/lib/join-orion-exclusion-provisioning.mjs';
import { validateExclusionManifest } from '../scripts/lib/join-orion-exclusions.mjs';

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
const manifest = (records = ids.map((application_source_id, index) => ({ application_source_id,
  classification: 'historical_test_data', reason: `Reviewed fixture ${index}`,
  reviewed_by: 'Desiree Thayer', reviewed_at: '2026-09-16T10:00:00.000Z' }))) =>
  ({ manifest_version: 1, source_system: 'join-orion', records });

function harness({ sourceIds = ids, existing = [], failInsert = false } = {}) {
  const state = { exclusions: structuredClone(existing), writes: 0, candidateWrites: 0, applicationNames: [] };
  const methods = rows => ({
    async readExclusions(id) { return rows.filter(row => row.workspace_id === id); },
    async setApplicationName(name) { state.applicationNames.push(name); },
    async lockWorkspace() {},
    async insertExclusions(id, records) {
      for (const record of records) { rows.push({ ...record, workspace_id: id }); state.writes++; }
      if (failInsert) throw new Error('simulated insert failure');
    },
  });
  const target = { ...methods(state.exclusions),
    async getWorkspace(id) { return id === workspaceId ? { id, name: 'Orion', slug: 'orion' } : null; },
    async transaction(callback) {
      const pending = structuredClone(state.exclusions); const writes = state.writes;
      try { const result = await callback(methods(pending)); state.exclusions.splice(0, state.exclusions.length, ...pending); return result; }
      catch (error) { state.writes = writes; throw error; }
    } };
  return { state, target, source: { findApplicationIds: async requested => requested.filter(id => sourceIds.includes(id)) } };
}

const invoke = (fixture, options = {}) => {
  const value = options.manifest ?? manifest();
  return provisionJoinOrionExclusions({ manifest: value,
    expectedFingerprint: options.fingerprint ?? validateExclusionManifest(value).fingerprint,
    workspaceId: options.workspaceId ?? workspaceId, operator: 'change-50/desiree',
    source: fixture.source, target: fixture.target, apply: options.apply ?? false });
};

test('dry-run plans inserts and performs zero writes', async () => {
  const fixture = harness(); const report = await invoke(fixture);
  assert.equal(report.proposed_inserts, 2); assert.equal(report.writes_performed, 0); assert.equal(fixture.state.writes, 0);
});

test('fingerprint mismatch fails before database reads or writes', async () => {
  const fixture = harness(); let touched = false;
  fixture.target.getWorkspace = async () => { touched = true; };
  await assert.rejects(invoke(fixture, { fingerprint: '0'.repeat(64) }), /fingerprint mismatch/);
  assert.equal(touched, false); assert.equal(fixture.state.writes, 0);
});

test('unmatched source UUID fails before writes', async () => {
  const fixture = harness({ sourceIds: [ids[0]] });
  await assert.rejects(invoke(fixture, { apply: true }), /not found in source/); assert.equal(fixture.state.writes, 0);
});

test('first provisioning and idempotent rerun preserve governance and fingerprint', async () => {
  const fixture = harness(); const fingerprint = validateExclusionManifest(manifest()).fingerprint;
  const first = await invoke(fixture, { apply: true }); const second = await invoke(fixture, { apply: true });
  assert.equal(first.writes_performed, 2); assert.equal(first.hosted_fingerprint, fingerprint);
  assert.equal(second.writes_performed, 0); assert.equal(second.already_matching_rows, 2);
  assert.deepEqual(fixture.state.exclusions.map(({ workspace_id, ...row }) => row), manifest().records);
});

test('conflicting metadata and extra hosted governance fail without deletion', async () => {
  const bad = { ...manifest().records[0], reason: 'Different', workspace_id: workspaceId };
  const fixture = harness({ existing: [bad] });
  await assert.rejects(invoke(fixture, { apply: true }), /governance conflict/);
  assert.equal(fixture.state.exclusions[0].reason, 'Different'); assert.equal(fixture.state.writes, 0);
});

test('provisioning never invokes candidate CRM writes', async () => {
  const fixture = harness(); await invoke(fixture, { apply: true });
  assert.equal(fixture.state.candidateWrites, 0);
});

test('transaction rolls back every insert and reports no hosted success on failure', async () => {
  const fixture = harness({ failInsert: true });
  await assert.rejects(invoke(fixture, { apply: true }), /simulated/);
  assert.deepEqual(fixture.state.exclusions, []); assert.equal(fixture.state.writes, 0);
});

test('hosted reconstruction has the identical canonical fingerprint', async () => {
  const fixture = harness(); const report = await invoke(fixture, { apply: true });
  assert.equal(report.hosted_fingerprint, report.reviewed_fingerprint);
  assert.match(fixture.state.applicationNames[0], /^join-orion-exclusions:/);
});

test('workspace isolation ignores and preserves rows belonging to another workspace', async () => {
  const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const other = { ...manifest().records[0], reason: 'Other workspace governance', workspace_id: otherWorkspace };
  const fixture = harness({ existing: [other] });
  const report = await invoke(fixture, { apply: true });
  assert.equal(report.writes_performed, 2);
  assert.equal(fixture.state.exclusions.filter(row => row.workspace_id === otherWorkspace).length, 1);
  assert.equal(fixture.state.exclusions.filter(row => row.workspace_id === workspaceId).length, 2);
});
