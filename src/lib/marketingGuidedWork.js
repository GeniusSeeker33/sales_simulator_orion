// Presentation only: available commands always come from guided_work.actions on the server.
export function guidedPipeline(work) {
  const o = work.orchestration;
  const status = label => work.pipeline.find(s => s.label === label)?.status || 'pending';
  const combine = statuses => ['failed','unknown','working','action'].find(s => statuses.includes(s)) || (statuses.every(s => s === 'done') ? 'done' : 'pending');
  const stages = [];
  if (o.workflow.includes('strategist')) stages.push({ label: 'PLAN', status: combine([status('Strategist'),status('Human plan decision')]) });
  if (o.workflow !== 'strategist') stages.push({ label:'CREATE',status:status('Creator') },{ label:'CHECK',status:combine([status('Constraint Check'),status('Guardian')]) },{ label:'REVIEW',status: status('Approval') === 'done' ? 'done' : ['awaiting_review','awaiting_approval','changes_needed','failed','blocked'].includes(o.state) ? 'action' : 'pending' });
  stages.push({ label:'DONE',status:o.state === 'completed' ? 'done' : 'pending' });
  const current = o.state === 'completed' ? 'DONE' : o.state === 'awaiting_plan' || o.state === 'strategist_running' ? 'PLAN' : o.state === 'creator_running' ? 'CREATE' : o.state === 'guardian_running' ? 'CHECK' : o.workflow === 'strategist' ? 'PLAN' : 'REVIEW';
  return { stages, current };
}

export const editableRules = rules => (rules || []).map(rule => Object.fromEntries(Object.entries(rule).filter(([key]) => key !== 'id')));
