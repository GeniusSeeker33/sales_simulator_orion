import { attentionLevel, ATTENTION_LEVELS } from './marketingAttention.js';

export const WORKFLOW_LABELS = { strategist: 'Strategy plan', creator_guardian: 'Creator → Guardian', strategist_creator_guardian: 'Strategist → Creator → Guardian' };
export const STAGE_LABELS = { strategist_running: 'Strategist is working', awaiting_plan: 'Plan decision needed', creator_running: 'Creator is working', guardian_running: 'Guardian is reviewing', awaiting_review: 'Ready for your review', awaiting_approval: 'Approval decision needed', changes_needed: 'Revision needed', blocked: 'Workflow blocked', failed: 'Agent run failed', completed: 'Completed', cancelled: 'Stopped' };
const terminal = state => ['completed', 'cancelled', 'blocked', 'failed'].includes(state);
export const assetRevisionLink = asset => `/marketing/campaigns/${asset.campaign_id}?asset=${asset.id}&revision=${asset.revision}`;

// One projection for navigation, the command center and task details. Never persisted.
export function deriveAgentWork(data) {
  const workspace = data.workspace.id;
  const scoped = rows => (rows || []).filter(row => row.workspace_id === workspace);
  const campaigns = new Map(scoped(data.campaigns).map(c => [c.id, c]));
  const assets = new Map(scoped(data.assets).map(a => [a.id, a]));
  const tasks = new Map(scoped(data.tasks).map(t => [t.id, t]));
  const runs = scoped(data.attention_runs);
  const orchestrations = scoped(data.orchestrations).filter(o => campaigns.has(o.campaign_id) && tasks.has(o.task_id));
  const signals = (data.attention || []).filter(i => campaigns.has(i.campaign_id));
  const consumed = new Set(), work = [];
  // Logical asset lineage survives human decisions and failed stages; revision equality is not ownership.
  const assetOwners = new Map();
  for (const o of [...orchestrations].sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))) {
    if (o.asset_id && assets.get(o.asset_id)?.campaign_id === o.campaign_id) assetOwners.set(o.asset_id, o.id);
  }
  for (const o of orchestrations) {
    const asset = assets.get(o.asset_id), task = tasks.get(o.task_id);
    const items = signals.filter(i => i.orchestration_id === o.id || (!i.orchestration_id && i.asset_id && assetOwners.get(i.asset_id) === o.id));
    items.forEach(i => consumed.add(i.id));
    const guided = data.guided_work?.find(c => c.orchestration_id === o.id);
    const inconsistent = guided?.guardian?.technical_reason === 'guardian_semantic_structured_mismatch';
    const recoveryContext = data.orchestration_recovery?.find(c => c.orchestration_id === o.id);
    const recovery = inconsistent ? { ...recoveryContext, eligible: false, reason: 'Guardian review must be retried before a content revision.' } : recoveryContext;
    const current = !asset || asset.revision === o.asset_revision;
    const assessment = data.asset_constraint_checks?.find(a => a.asset_id === asset?.id && a.revision === asset?.revision);
    const checks = assessment?.checks || (current ? o.constraint_preflight || [] : []);
    const failures = checks.filter(q => q.passed === false);
    const stale = !terminal(o.state) && (task.revision !== o.task_revision || campaigns.get(o.campaign_id).revision !== o.campaign_revision || !current);
    const uncertain = o.state.endsWith('_running') && items.some(i => i.orchestration_id === o.id && i.severity === 'critical');
    const inspect = (stale || uncertain) && !recovery?.eligible;
    const state = inconsistent ? 'Guardian review inconsistent' : recovery?.eligible && o.state === 'failed' ? 'Recoverable Guardian failure' : inspect ? 'Workflow needs inspection' : failures.length ? 'Human constraint failed' : STAGE_LABELS[o.state] || 'Workflow needs inspection';
    const action = inconsistent ? (guided.guardian_retry?.eligible ? 'Retry Guardian' : 'Inspect Guardian') : recovery?.eligible && o.state === 'failed' ? 'Review recovery' : inspect ? 'Inspect Failure' : failures.length ? 'Review Constraint Failure' : ({ awaiting_plan: 'Review Plan', awaiting_review: 'Review Asset', awaiting_approval: 'Approve / Request Changes', changes_needed: 'Send Revision to Creator', failed: 'Inspect Failure', blocked: 'Inspect Failure', completed: task.status !== 'done' ? 'Mark Task Complete' : 'View history', cancelled: 'View history' }[o.state] || 'View progress');
    const pipeline = derivePipeline(data, o, runs, asset, checks, stale || !current);
    work.push({ id: o.id, orchestration: o, campaign: campaigns.get(o.campaign_id), task, asset, items, failures, checks, stale, recovery,
      state, action, severity: attentionLevel(items), timestamp: o.updated_at,
      reason: failures.length ? `Creator's current revision conflicts with ${failures.length} of your rules. ${pipeline.find(s => s.label === 'Guardian')?.status === 'pending' ? 'Guardian has not reviewed this revision.' : 'The recorded Guardian result does not resolve these rule failures.'}` : items.map(i => i.reason).join(' ') || o.reason || (o.state === 'completed' ? 'The governed workflow is complete.' : 'No human decision is currently blocking this workflow.'),
      group: items.length ? 'needsYou' : terminal(o.state) ? 'recentlyCompleted' : 'working',
      pipeline });
  }
  const standalone = new Map();
  for (const item of signals) {
    if (consumed.has(item.id) || item.orchestration_id) continue;
    const asset = assets.get(item.asset_id);
    if (item.scope !== 'agents' && !(item.scope === 'approvals' && asset?.created_via === 'agent')) continue;
    const key = asset ? `asset:${asset.id}` : item.id;
    if (!standalone.has(key)) standalone.set(key, { id: key, campaign: campaigns.get(item.campaign_id), asset, items: [], timestamp: item.timestamp, group: 'needsYou' });
    standalone.get(key).items.push(item);
  }
  for (const entry of standalone.values()) {
    const run = runs.find(r => entry.items.some(i => i.run_id === r.id));
    const asset = entry.asset;
    const failure = entry.items.some(i => /failed|no confirmed|incomplete/i.test(i.reason));
    const state = failure ? 'Agent run needs inspection' : asset?.approval_state === 'in_review' ? 'Approval decision needed' : run?.agent_key === 'strategist' ? 'Plan decision needed' : 'Review recommended';
    work.push({ ...entry, run, state, severity: attentionLevel(entry.items), reason: entry.items.map(i => i.reason).join(' '),
      action: failure ? 'Inspect Failure' : asset?.approval_state === 'in_review' ? 'Approve / Request Changes' : run?.agent_key === 'strategist' ? 'Review Plan' : 'Review Asset',
      href: failure || !asset ? `/marketing/agents?run=${run?.id || entry.items[0].run_id}` : assetRevisionLink(asset), pipeline: [], failures: [] });
  }
  work.sort((a, b) => ATTENTION_LEVELS[a.severity].rank - ATTENTION_LEVELS[b.severity].rank || (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0) || a.id.localeCompare(b.id));
  return { needsYou: work.filter(w => w.group === 'needsYou'), working: work.filter(w => w.group === 'working'), recentlyCompleted: work.filter(w => w.group === 'recentlyCompleted'), all: work };
}

export function derivePipeline(data, o, runs, asset, checks, stale = false) {
  const linked = (o.run_ids || []).map(id => runs.find(r => r.id === id)).filter(Boolean);
  const latest = key => linked.findLast(r => r.agent_key === key);
  const creator = latest('creator'), strategist = latest('strategist');
  const guardian = linked.slice(creator ? linked.indexOf(creator) + 1 : 0).findLast(r => r.agent_key === 'guardian');
  const status = run => !run ? 'pending' : run.review_issue ? 'inconsistent' : run.status === 'succeeded' ? 'done' : run.status === 'started' ? 'working' : 'failed';
  const stages = [];
  if (o.workflow.includes('strategist')) {
    stages.push({ label: 'Strategist', status: status(strategist) });
    const accepted = (data.resolutions || []).some(r => r.workspace_id === o.workspace_id && r.agent_run_id === o.plan_run_id && r.action === 'accept_plan');
    stages.push({ label: 'Human plan decision', status: accepted ? 'done' : o.state === 'awaiting_plan' ? 'action' : 'pending' });
  }
  if (o.workflow !== 'strategist') {
    stages.push({ label: 'Creator', status: status(creator) });
    // Reaching Guardian is persisted proof that the trusted preflight allowed this cycle.
    stages.push({ label: 'Constraint Check', status: stale ? 'unknown' : checks.some(q => q.passed === false) ? 'failed' : guardian || (creator?.status === 'succeeded' && checks.length) ? 'done' : 'pending' });
    stages.push({ label: 'Guardian', status: stale && guardian ? 'unknown' : guardian?.recommendation === 'needs_changes' || guardian?.qa_failed ? 'failed' : status(guardian) });
    stages.push({ label: 'Human Review', status: o.state === 'awaiting_review' ? 'action' : ['awaiting_approval', 'completed'].includes(o.state) ? 'done' : 'pending' });
    stages.push({ label: 'Approval', status: !stale && o.state === 'completed' && asset?.approval_state === 'approved' && asset.revision === o.asset_revision ? 'done' : o.state === 'awaiting_approval' ? 'action' : 'pending' });
  }
  return stages;
}

export function constraintFailureLabel(check) {
  const value = check.matched_text ? `“${check.matched_text}”` : check.detail;
  const labels = { prohibited_phrase: 'Prohibited phrase', no_unverified_comparative_claim: 'Comparative claim detected', no_unverified_outcome_claim: 'Business-outcome claim detected', no_fabricated_testimonial: 'Testimonial constraint failed', required_hostname: 'Required hostname missing' };
  return `${labels[check.constraint_type] || 'Human constraint failed'}: ${value}`;
}
