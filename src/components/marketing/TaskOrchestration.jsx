import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { ASSET_TYPES, commandMarketingOrchestration } from '../../lib/marketing';
import { deriveAgentWork } from '../../lib/marketingAgentWork';
import AgentWorkCard from './AgentWorkCard';
const label = value => value.replaceAll('_', ' ');
const terminal = o => ['completed', 'blocked', 'failed', 'cancelled'].includes(o.state);

export default function TaskOrchestration({ data, campaign, task, onRefresh }) {
  const [params] = useSearchParams();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [workflow, setWorkflow] = useState(''), [assetType, setAssetType] = useState('social_copy'), [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const executions = (data.orchestrations || []).filter(o => o.task_id === task.id);
  const active = executions.find(o => !terminal(o));
  const canWrite = ['contributor', 'approver', 'admin'].includes(data.role);
  const guidedActionPending = (data.guided_work || []).some(context => executions.some(o => o.id === context.orchestration_id) && context.actions.length > 0);
  const canAssign = canWrite && !active && !guidedActionPending && ['todo', 'in_progress'].includes(task.status);
  async function command(action, orchestration) {
    setBusy(true); setError('');
    try {
      await commandMarketingOrchestration({ workspace_id: data.workspace.id, id: orchestration?.id || id, action, instructions,
        ...(action === 'start' ? { campaign_id: campaign.id, task_id: task.id, task_revision: task.revision, campaign_revision: campaign.revision, workflow, asset_type: assetType } : { expected_revision: orchestration.revision }) });
      if (action === 'start') setId(crypto.randomUUID());
    } catch (e) { setError(e.message); }
    finally { try { await onRefresh(); } catch { setError('Refresh failed. Inspect task execution before trying again.'); } setBusy(false); }
  }
  return <details className="marketing-record" open={params.get("task") === task.id ? true : undefined}><summary>Guided Work</summary>
    <p>Human owner: {task.owner_user_id || 'Unassigned'} · Task {label(task.status)} · Due {task.due_on || 'not set'}</p>
    {deriveAgentWork(data).all.filter(work => work.orchestration?.task_id === task.id).map(work => <AgentWorkCard key={work.id} data={data} work={work} onRefresh={onRefresh} expanded instructions={instructions} />)}
    {canAssign && <fieldset className="marketing-fieldset" disabled={busy}>
      <label className="form-field"><span>Agent team instructions / revision notes</span><textarea maxLength="4000" value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
      {!active && ['todo', 'in_progress'].includes(task.status) && <>
        <label className="form-field"><span>Execution workflow</span><select value={workflow} onChange={e => setWorkflow(e.target.value)}><option value="">Choose a workflow</option><option value="strategist">Strategist only</option><option value="creator_guardian">Creator → Guardian</option><option value="strategist_creator_guardian">Strategist → Creator → Guardian</option></select></label>
        <label className="form-field"><span>Agent asset type</span><select value={assetType} onChange={e => setAssetType(e.target.value)}>{ASSET_TYPES.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label>
        <button type="button" className="btn-primary" disabled={!workflow} onClick={() => command('start')}>Assign to Agent Team</button>
      </>}
      {busy && <p role="status">Executing the authorized workflow…</p>}
    </fieldset>}
    {error && <p role="alert" className="marketing-error">{error}</p>}
  </details>;
}
