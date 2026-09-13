// CHECK represents deterministic evaluation; REVIEW represents Guardian and human readiness.
export function guidedPipeline(work, context = {}) {
  const o = work.orchestration, guardian = context.guardian;
  const status = label => work.pipeline.find(s => s.label === label)?.status || 'pending';
  const combine = values => ['failed','unknown','working','action'].find(s => values.includes(s)) || (values.every(s => s === 'done') ? 'done' : 'pending');
  const check = status('Constraint Check');
  const technical = guardian?.status === 'failed' || ['failed','blocked'].includes(o.state) && ['failed','unknown'].includes(status('Guardian'));
  const semantic = guardian?.status === 'succeeded' && guardian.recommendation === 'needs_changes' || o.state === 'changes_needed' && status('Guardian') === 'failed' && check !== 'failed';
  const reviewRunning = o.state === 'guardian_running';
  const kind = check === 'failed' ? 'policy_issue' : technical ? 'guardian_technical' : semantic ? 'guardian_changes' : reviewRunning ? 'review_running' : ['awaiting_review','awaiting_approval'].includes(o.state) ? 'ready' : 'other';
  const review = status('Approval') === 'done' ? 'done' : technical ? 'technical' : reviewRunning ? 'working' : semantic || ['awaiting_review','awaiting_approval'].includes(o.state) ? 'action' : 'pending';
  const stages = [];
  if (o.workflow.includes('strategist')) stages.push({ label:'PLAN',status:combine([status('Strategist'),status('Human plan decision')]) });
  if (o.workflow !== 'strategist') stages.push({ label:'CREATE',status:status('Creator') },{ label:'CHECK',status:check },{ label:'REVIEW',status:review });
  stages.push({ label:'DONE',status:o.state === 'completed' ? 'done' : 'pending' });
  const current = o.state === 'completed' ? 'DONE' : ['awaiting_plan','strategist_running'].includes(o.state) ? 'PLAN' : o.state === 'creator_running' ? 'CREATE' : check === 'failed' ? 'CHECK' : o.workflow === 'strategist' ? 'PLAN' : 'REVIEW';
  return { stages,current,kind };
}
export const editableRules = rules => (rules || []).map(rule => Object.fromEntries(Object.entries(rule).filter(([key]) => key !== 'id')));
export function guardianRetryRequest(data, o) {
  const ctx = data.guided_work?.find(c => c.orchestration_id === o.id)?.guardian_retry;
  if (!ctx?.eligible) throw new Error(ctx?.reason || 'Refresh this work before retrying Guardian.');
  return { workspace_id:data.workspace.id,id:o.id,action:'retry_guardian',expected_revision:o.revision,asset_revision:ctx.asset_revision,task_revision:ctx.task_revision,campaign_revision:ctx.campaign_revision,constraint_set_ids:ctx.constraint_set_ids };
}
export function plainWorkReason(reason) {
  if (!reason) return 'Review the current work before deciding what happens next.';
  if (/Record human requested changes|Current human requested.change evidence/.test(reason)) return 'Add the changes you want, and the same workflow will continue with a new revision.';
  if (/result_rejected|invalid_output|persistence_failed|model_failed/.test(reason)) return 'The review encountered a technical issue. Inspect the issue before continuing.';
  return reason.replace(/orchestration recovery/gi,'continuing this work').replace(/orchestration/gi,'workflow');
}
