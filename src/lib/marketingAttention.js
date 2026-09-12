// Pure projection of persisted evidence. No status is stored or inferred from edits to unrelated records.
export const ATTENTION_LEVELS = {
  critical: { label: 'Human action required', icon: '!', rank: 0 },
  attention: { label: 'Review recommended', icon: '△', rank: 1 },
  clear: { label: 'Clear', icon: '✓', rank: 2 },
};

export function deriveMarketingAttention(data, now = Date.now()) {
  const items = [], workspace = data.workspace.id;
  const campaigns = new Map(data.campaigns.map(c => [c.id, c]));
  const assets = new Map(data.assets.map(a => [a.id, a]));
  const resolvedRuns = new Set((data.resolutions || []).filter(r => r.workspace_id === workspace).map(r => r.agent_run_id));
  const resolvedThrough = new Map();
  for (const event of data.attention_events) {
    if (Number.isInteger(event.revision) && ['asset_saved', 'approved', 'changes_requested'].includes(event.action)) {
      resolvedThrough.set(event.asset_id, Math.max(resolvedThrough.get(event.asset_id) || 0, event.revision));
    }
  }
  const add = item => items.push({ ...item, campaign: campaigns.get(item.campaign_id)?.name || 'Campaign unavailable' });
  for (const campaign of data.campaigns) {
    if (campaign.workspace_id === workspace && ['in_review', 'changes_requested'].includes(campaign.approval_state)) {
      add({ id: `campaign:${campaign.id}`, campaign_id: campaign.id, name: 'Campaign approval', severity: 'critical',
        reason: campaign.approval_state === 'in_review' ? 'Campaign is awaiting a human approval decision.' : 'Campaign changes are requested.',
        timestamp: campaign.updated_at || campaign.created_at, href: `/marketing/campaigns/${campaign.id}`, action: 'Open campaign', scope: 'campaigns' });
    }
  }
  for (const asset of data.assets) {
    if (asset.workspace_id !== workspace) continue;
    const base = { id: `asset:${asset.id}`, campaign_id: asset.campaign_id, asset_id: asset.id, name: asset.name, timestamp: asset.updated_at || asset.created_at, href: `/marketing/campaigns/${asset.campaign_id}?asset=${asset.id}`, action: 'Review', scope: 'approvals' };
    if (asset.approval_state === 'in_review') add({ ...base, severity: 'critical', reason: 'Asset is awaiting a human review decision.' });
    else if (asset.approval_state === 'changes_requested') add({ ...base, severity: 'critical', reason: 'Human requested changes are awaiting a response or revision.' });
  }
  for (const run of data.attention_runs) {
    if (run.workspace_id !== workspace) continue;
    const base = { id: `run:${run.id}`, run_id: run.id, campaign_id: run.campaign_id, asset_id: run.asset_id || run.outcome_asset_id, name: `${run.agent_key}: ${run.purpose}`, timestamp: run.ended_at || run.started_at, href: `/marketing/agents?run=${run.id}`, action: 'Inspect run', scope: 'agents' };
    if (['failed', 'started', 'cancelled'].includes(run.status)) {
      add({ ...base, severity: 'critical', reason: run.status === 'failed' ? 'Agent run failed; operator inspection is required.' : 'Run has no confirmed successful outcome. Inspect before retrying.' });
    } else if (run.status === 'succeeded' && run.agent_key === 'strategist') {
      if (resolvedRuns.has(run.id)) continue;
      add({ ...base, severity: 'attention', reason: 'Strategist proposal is available. No acknowledgment or explicit action linkage is recorded.' });
    } else if (run.status === 'succeeded' && run.agent_key === 'guardian') {
      // Submission increments revision too: only a content save or human decision supersedes QA.
      const superseded = Number.isInteger(run.asset_revision) && resolvedThrough.get(run.asset_id) > run.asset_revision;
      if (superseded) continue;
      if (!assets.has(run.asset_id) || !Number.isInteger(run.asset_revision) || !run.recommendation) {
        add({ ...base, severity: 'critical', reason: 'Guardian context is incomplete; inspect the recorded evidence.' });
      } else if (run.recommendation === 'needs_changes' || run.qa_failed) {
        add({ ...base, severity: 'critical', reason: 'Guardian identified changes needed; no newer content or human decision resolves this assessment.' });
      } else if (resolvedRuns.has(run.id)) {
        continue;
      } else if (run.recommendation === 'ready_for_human_review' && assets.get(run.asset_id).approval_state === 'draft' && assets.get(run.asset_id).revision === run.asset_revision) {
        add({ ...base, severity: 'attention', reason: 'Guardian recommends human review. Send the current draft to Approval.' });
      } else if (run.has_findings) {
        add({ ...base, severity: 'attention', reason: 'Guardian findings merit human inspection; the recommendation is advisory.' });
      }
    }
  }
  const orchestrations = (data.orchestrations || []).filter(o => o.workspace_id === workspace);
  const linkedRuns = new Set(orchestrations.flatMap(o => o.run_ids));
  // Replace stage-level signals with one task action; retain an existing asset approval gate.
  for (let i = items.length - 1; i >= 0; i--) if (linkedRuns.has(items[i].run_id)) items.splice(i, 1);
  for (const o of orchestrations) {
    const task = (data.tasks || []).find(t => t.id === o.task_id), asset = assets.get(o.asset_id);
    const terminal = ['completed', 'cancelled', 'failed', 'blocked'].includes(o.state);
    const running = o.state.endsWith('_running');
    const stale = !terminal && (task?.revision !== o.task_revision || campaigns.get(o.campaign_id)?.revision !== o.campaign_revision
      || (asset && asset.revision !== o.asset_revision));
    const uncertain = running && now - Date.parse(o.updated_at) > 120000;
    const severity = stale || uncertain || ['awaiting_plan', 'awaiting_review', 'changes_needed', 'awaiting_approval', 'failed', 'blocked'].includes(o.state)
      ? 'critical' : o.state === 'completed' && task?.status !== 'done' ? 'attention' : null;
    const sameAssetGate = !stale && !uncertain && ['changes_needed', 'awaiting_approval'].includes(o.state)
      && o.asset_id && items.some(item => item.id === `asset:${o.asset_id}`);
    if (!severity || sameAssetGate) continue;
    const reason = stale ? 'Task, campaign or asset changed. Inspect the orchestration.' : uncertain ? 'Stage outcome is uncertain. Inspect before restarting.'
      : o.reason || ({ awaiting_plan: 'Strategist plan requires your decision.', awaiting_review: 'Ready for your review. Send the asset to Approval.', changes_needed: 'Guardian or human requested changes. Choose a revision or review manually.', awaiting_approval: 'Asset is awaiting actual human approval.', completed: 'Agent work completed; the task remains open.' }[o.state] || 'Orchestration requires human inspection.');
    add({ id: `orchestration:${o.id}`, orchestration_id: o.id, campaign_id: o.campaign_id, task_id: o.task_id, name: task?.title || 'Agent task', severity, reason,
      timestamp: o.updated_at, href: `/marketing/campaigns/${o.campaign_id}?task=${o.task_id}`, action: 'Open task', scope: 'agents' });
  }
  return items.sort((a, b) => ATTENTION_LEVELS[a.severity].rank - ATTENTION_LEVELS[b.severity].rank
    || (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0) || a.id.localeCompare(b.id));
}

export function attentionLevel(items) {
  return items.some(i => i.severity === 'critical') ? 'critical' : items.length ? 'attention' : 'clear';
}

export function attentionCounts(items) {
  return { approvals: items.filter(i => i.scope === 'approvals').length, agents: items.filter(i => i.scope === 'agents').length };
}
