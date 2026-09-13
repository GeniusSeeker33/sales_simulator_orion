import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAgentWork, constraintFailureLabel } from '../src/lib/marketingAgentWork.js';
import { deriveMarketingAttention } from '../src/lib/marketingAttention.js';

const time = '2026-09-13T12:00:00Z';
function fixture(state = 'awaiting_review') {
  const d = { workspace: { id: 'w' }, campaigns: [{ id: 'c', workspace_id: 'w', revision: 1, name: 'Campaign' }], tasks: [{ id: 't', workspace_id: 'w', campaign_id: 'c', revision: 1, status: 'todo', title: 'Dealer copy' }], assets: [{ id: 'a', workspace_id: 'w', campaign_id: 'c', revision: 1, name: 'Copy', created_via: 'agent', approval_state: 'draft' }], attention_events: [], resolutions: [], human_constraint_sets: [], orchestration_history: [], asset_constraint_checks: [], attention_runs: [
    { id: 'old-creator', workspace_id: 'w', campaign_id: 'c', agent_key: 'creator', status: 'succeeded' },
    { id: 'old-guardian', workspace_id: 'w', campaign_id: 'c', agent_key: 'guardian', status: 'succeeded', asset_id: 'a', asset_revision: 0, recommendation: 'needs_changes' },
    { id: 'creator', workspace_id: 'w', campaign_id: 'c', agent_key: 'creator', status: 'succeeded' },
    { id: 'guardian', workspace_id: 'w', campaign_id: 'c', agent_key: 'guardian', status: 'succeeded', asset_id: 'a', asset_revision: 1, recommendation: 'ready_for_human_review' },
  ], orchestrations: [{ id: 'o', workspace_id: 'w', campaign_id: 'c', task_id: 't', task_revision: 1, campaign_revision: 1, asset_id: 'a', asset_revision: 1, workflow: 'creator_guardian', state, run_ids: ['old-creator', 'old-guardian', 'creator', 'guardian'], active_run_id: 'guardian', revision_cycles: 1, updated_at: time }] };
  return d;
}
function project(d) { d.attention = deriveMarketingAttention(d, Date.parse(time)); return deriveAgentWork(d); }

test('current workflow replaces historical Clear runs and owns its current approval gate', () => {
  const d = fixture('awaiting_approval'); d.assets[0].approval_state = 'in_review';
  const model = project(d);
  assert.equal(model.needsYou.length, 1);
  assert.equal(model.all.length, 1);
  assert.equal(model.needsYou[0].action, 'Approve / Request Changes');
  assert.equal(model.needsYou[0].asset.revision, 1);
  assert.equal(model.needsYou[0].pipeline.find(s => s.label === 'Approval').status, 'action');
  assert.equal(model.needsYou[0].pipeline.find(s => s.label === 'Guardian').status, 'done');
});

test('active work without a gate is Working; completed work remains actionable until task completion', () => {
  const d = fixture('creator_running'); d.orchestrations[0].run_ids = ['old-creator', 'old-guardian', 'creator']; d.attention_runs.pop(); d.attention_runs[2].status = 'started';
  assert.equal(project(d).working.length, 1);
  d.orchestrations[0].state = 'completed'; d.assets[0].approval_state = 'approved';
  assert.equal(project(d).needsYou[0].action, 'Mark Task Complete');
  d.tasks[0].status = 'done';
  const model = project(d);
  assert.equal(model.needsYou.length, 0); assert.equal(model.recentlyCompleted.length, 1);
  assert.equal(model.recentlyCompleted[0].pipeline.find(s => s.label === 'Approval').status, 'done');
});

test('current preflight failure does not reuse Guardian evidence from an earlier Creator cycle', () => {
  const d = fixture('changes_needed'); d.orchestrations[0].run_ids.pop();
  d.asset_constraint_checks = [{ asset_id: 'a', revision: 1, checks: [{ constraint_id: 'rule', constraint_type: 'no_unverified_comparative_claim', passed: false, matched_text: 'competitive', detail: 'No comparative claims' }] }];
  const w = project(d).needsYou[0];
  assert.equal(w.state, 'Human constraint failed'); assert.equal(w.action, 'Review Constraint Failure');
  assert.equal(w.pipeline.find(s => s.label === 'Constraint Check').status, 'failed');
  assert.equal(w.pipeline.find(s => s.label === 'Guardian').status, 'pending');
  assert.equal(constraintFailureLabel(w.failures[0]), 'Comparative claim detected: “competitive”');
});

test('a new asset revision invalidates current pipeline evidence rather than declaring it complete', () => {
  const d = fixture(); d.assets[0].revision = 2;
  const w = project(d).needsYou[0];
  assert.equal(w.stale, true); assert.equal(w.action, 'Inspect Failure');
  assert.equal(w.pipeline.find(s => s.label === 'Constraint Check').status, 'unknown');
});

test('plan acceptance requires attributable persisted human resolution', () => {
  const d = fixture('awaiting_plan'); const o = d.orchestrations[0];
  o.workflow = 'strategist_creator_guardian'; o.plan_run_id = 'plan'; o.run_ids = ['plan'];
  d.attention_runs.push({ id: 'plan', workspace_id: 'w', campaign_id: 'c', agent_key: 'strategist', status: 'succeeded' });
  assert.equal(project(d).needsYou[0].pipeline[1].status, 'action');
  d.resolutions.push({ workspace_id: 'foreign', agent_run_id: 'plan', action: 'accept_plan' });
  assert.equal(project(d).needsYou[0].pipeline[1].status, 'action');
  d.resolutions.push({ workspace_id: 'w', agent_run_id: 'plan', action: 'accept_plan' });
  assert.equal(project(d).needsYou[0].pipeline[1].status, 'done');
});

test('workspace projection excludes foreign workflows, runs, tasks and campaigns', () => {
  const d = fixture(); d.orchestrations.push({ ...d.orchestrations[0], id: 'foreign', workspace_id: 'other' });
  d.attention_runs.push({ id: 'foreign-run', workspace_id: 'other', campaign_id: 'foreign-c', agent_key: 'creator', status: 'failed' });
  d.campaigns.push({ id: 'foreign-c', workspace_id: 'other', name: 'Private' });
  const result = project(d); assert.equal(result.all.length, 1); assert.equal(JSON.stringify(result).includes('Private'), false);
});

test('standalone Guardian and its human asset decision group once; unrelated failed run stays visible', () => {
  const d = fixture(); d.orchestrations = []; d.attention_runs = d.attention_runs.slice(-1);
  d.assets[0].approval_state = 'in_review'; d.attention_runs[0].has_findings = true;
  d.attention_runs.push({ id: 'failed', workspace_id: 'w', campaign_id: 'c', agent_key: 'creator', status: 'failed', purpose: 'Failed draft' });
  const model = project(d);
  assert.equal(model.needsYou.length, 2);
  assert.equal(model.needsYou.find(w => w.asset)?.items.length, 2);
});


test('uncertain active execution leads to inspection instead of a normal progress action', () => {
  const d = fixture('creator_running');
  d.orchestrations[0].updated_at = '2026-09-13T11:50:00Z';
  const work = project(d).needsYou[0];
  assert.equal(work.action, 'Inspect Failure');
  assert.equal(work.state, 'Workflow needs inspection');
});


test('failed workflow owns newer human approval revisions by lineage, never a duplicate standalone card', () => {
  const d = fixture('failed'); d.assets[0].revision = 4; d.assets[0].approval_state = 'in_review';
  let work = project(d); assert.equal(work.needsYou.length, 1); assert.equal(work.needsYou[0].orchestration.id, 'o');
  d.assets[0].approval_state = 'changes_requested';
  d.orchestration_recovery = [{ orchestration_id: 'o', eligible: true }];
  work = project(d); assert.equal(work.needsYou.length, 1); assert.equal(work.needsYou[0].state, 'Recoverable Guardian failure');
});
