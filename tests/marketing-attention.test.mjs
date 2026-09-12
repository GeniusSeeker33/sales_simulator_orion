import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMarketingAttention, attentionCounts, attentionLevel, ATTENTION_LEVELS } from '../src/lib/marketingAttention.js';

const asset = { id: 'a', workspace_id: 'w', campaign_id: 'c', name: 'Draft', approval_state: 'draft', revision: 3, updated_at: '2026-09-12T10:00:00Z' };
const run = { id: 'g', workspace_id: 'w', campaign_id: 'c', agent_key: 'guardian', status: 'succeeded', purpose: 'QA', asset_id: 'a', asset_revision: 2, recommendation: 'needs_changes', ended_at: '2026-09-12T09:00:00Z' };
const data = (extra = {}) => ({ workspace: { id: 'w' }, campaigns: [{ id: 'c', name: 'Campaign' }], assets: [asset], attention_runs: [run], attention_events: [], ...extra });

test('critical gates, failed/uncertain runs, proposal and warning signals are sorted and counted consistently', () => {
  const items = deriveMarketingAttention(data({ assets: [{ ...asset, approval_state: 'in_review' }], attention_runs: [run,
    { ...run, id: 'failed', status: 'failed', ended_at: '2026-09-12T11:00:00Z' },
    { ...run, id: 'started', status: 'started', ended_at: null, started_at: '2026-09-12T12:00:00Z' },
    { ...run, id: 'proposal', agent_key: 'strategist', ended_at: '2026-09-12T13:00:00Z' },
    { ...run, id: 'warning', recommendation: 'ready_for_human_review', has_findings: true },
  ] }));
  assert.deepEqual(items.map(i => i.id), ['run:started', 'run:failed', 'asset:a', 'run:g', 'run:proposal', 'run:warning']);
  assert.equal(attentionLevel(items), 'critical'); assert.deepEqual(attentionCounts(items), { approvals: 1, agents: 5 });
  assert.ok(items.every(item => item.campaign === 'Campaign' && item.reason && item.href && item.timestamp));
  assert.equal(ATTENTION_LEVELS.critical.label, 'Human action required'); assert.equal(ATTENTION_LEVELS.attention.label, 'Review recommended'); assert.equal(ATTENTION_LEVELS.clear.label, 'Clear');
});

test('submission alone, unrelated edits, missing metadata and ambiguous newer passes never clear a Guardian issue', () => {
  for (const attention_events of [[], [{ asset_id: 'a', revision: 3, action: 'submitted' }], [{ asset_id: 'other', revision: 99, action: 'asset_saved' }]]) assert.equal(deriveMarketingAttention(data({ attention_events })).length, 1);
  assert.equal(deriveMarketingAttention(data({ attention_runs: [{ ...run, asset_revision: null }] }))[0].severity, 'critical');
  assert.equal(deriveMarketingAttention(data({ attention_runs: [run, { ...run, id: 'pass', recommendation: 'ready_for_human_review' }] })).length, 1);
});

test('saved content and human decisions supersede old QA, preserving a current requested-changes gate', () => {
  for (const action of ['asset_saved', 'approved', 'changes_requested']) {
    const items = deriveMarketingAttention(data({ attention_events: [{ asset_id: 'a', revision: 3, action }] }));
    assert.equal(attentionLevel(items), 'clear'); assert.equal(items.length, 0);
  }
  const requested = deriveMarketingAttention(data({ assets: [{ ...asset, approval_state: 'changes_requested' }], attention_events: [{ asset_id: 'a', revision: 3, action: 'changes_requested' }] }));
  assert.deepEqual(requested.map(i => i.id), ['asset:a']); assert.equal(requested[0].severity, 'critical');
  assert.equal(deriveMarketingAttention(data({ attention_events: [{ asset_id: 'a', revision: 2, action: 'asset_saved' }] })).length, 1);
});

test('proposals remain recommended without explicit acknowledgment evidence and foreign records are ignored', () => {
  const result = deriveMarketingAttention(data({ attention_runs: [{ ...run, agent_key: 'strategist' }, { ...run, id: 'other', workspace_id: 'other' }], assets: [{ ...asset, workspace_id: 'other', approval_state: 'in_review' }] }));
  assert.equal(result.length, 1); assert.equal(attentionLevel(result), 'attention');
  assert.equal(attentionLevel([]), 'clear'); assert.deepEqual(attentionCounts([]), { approvals: 0, agents: 0 });
});

test('campaign approval gates cannot appear clear without assets or runs', () => {
  const items = deriveMarketingAttention(data({ assets: [], attention_runs: [], campaigns: [{ id: 'c', workspace_id: 'w', name: 'Campaign', approval_state: 'in_review', updated_at: '2026-09-12T10:00:00Z' }] }));
  assert.equal(items.length, 1); assert.equal(items[0].severity, 'critical'); assert.equal(items[0].action, 'Open campaign');
});

test('resolution evidence clears only its workspace run and current ready drafts recommend submission', () => {
  const proposal = { ...run, agent_key: 'strategist' };
  for (const action of ['accept_plan', 'dismiss', 'create_tasks']) {
    const snapshot = data({ attention_runs: [proposal], resolutions: [{ workspace_id: 'w', agent_run_id: run.id, action }] });
    assert.deepEqual(attentionCounts(deriveMarketingAttention(snapshot)), { approvals: 0, agents: 0 });
    snapshot.resolutions[0].workspace_id = 'foreign'; assert.equal(deriveMarketingAttention(snapshot).length, 1);
  }
  const ready = { ...run, asset_revision: 3, recommendation: 'ready_for_human_review', has_findings: false };
  const snapshot = data({ attention_runs: [ready] });
  assert.equal(deriveMarketingAttention(snapshot)[0].severity, 'attention');
  snapshot.assets = [{ ...asset, revision: 4, approval_state: 'in_review' }];
  snapshot.resolutions = [{ workspace_id: 'w', agent_run_id: ready.id, action: 'send_to_approval' }];
  assert.deepEqual(attentionCounts(deriveMarketingAttention(snapshot)), { approvals: 1, agents: 0 });
  snapshot.assets = [{ ...asset, revision: 5, approval_state: 'approved' }];
  snapshot.attention_events = [{ asset_id: asset.id, revision: 5, action: 'approved' }];
  assert.equal(attentionLevel(deriveMarketingAttention(snapshot)), 'clear');
});
