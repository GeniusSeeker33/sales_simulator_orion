import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ASSET_TYPES, commandMarketingOrchestration } from '../../lib/marketing';
import { AttentionIndicator } from './MarketingAttention';
const label = value => value.replaceAll('_', ' ');
const terminal = o => ['completed', 'blocked', 'failed', 'cancelled'].includes(o.state);

export default function TaskOrchestration({ data, campaign, task, onRefresh }) {
  const [id, setId] = useState(() => crypto.randomUUID());
  const [workflow, setWorkflow] = useState(''), [assetType, setAssetType] = useState('social_copy'), [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const executions = (data.orchestrations || []).filter(o => o.task_id === task.id);
  const active = executions.find(o => !terminal(o));
  const canWrite = ['contributor', 'approver', 'admin'].includes(data.role);
  async function command(action, orchestration) {
    setBusy(true); setError('');
    try {
      await commandMarketingOrchestration({ workspace_id: data.workspace.id, id: orchestration?.id || id, action, instructions,
        ...(action === 'start' ? { campaign_id: campaign.id, task_id: task.id, task_revision: task.revision, campaign_revision: campaign.revision, workflow, asset_type: assetType } : { expected_revision: orchestration.revision }) });
      if (action === 'start') setId(crypto.randomUUID());
    } catch (e) { setError(e.message); }
    finally { try { await onRefresh(); } catch { setError('Refresh failed. Inspect task execution before trying again.'); } setBusy(false); }
  }
  return <details className="marketing-record"><summary>Agent execution</summary>
    <p>Human owner: {task.owner_user_id || 'Unassigned'} · Task {label(task.status)} · Due {task.due_on || 'not set'}</p>
    {executions.map(o => <section key={o.id}>
      <h4>{label(o.workflow)} · {label(o.state)}</h4>
      <AttentionIndicator items={data.attention.filter(i => i.orchestration_id === o.id || i.asset_id === o.asset_id)} />
      <p>Assigned by {o.initiated_by} · Revision cycles {o.revision_cycles}/3</p>
      {o.reason && <p>{o.reason}</p>}
      {o.active_run_id && <p>Current / last agent: <Link to={`/marketing/agents?run=${o.active_run_id}`}>{data.attention_runs.find(r => r.id === o.active_run_id)?.agent_key || 'Inspect run'}</Link></p>}
      {o.asset_id && <Link to={`/marketing/campaigns/${campaign.id}?asset=${o.asset_id}`}>Review manually · asset revision {o.asset_revision}</Link>}
      <ol>{(data.orchestration_history || []).filter(h => h.orchestration_id === o.id).map(h => <li key={h.id}>{label(h.snapshot.state)} · {new Date(h.occurred_at).toLocaleString()} · {h.actor_user_id ? `Human ${h.actor_user_id}` : 'Server transition'} {h.snapshot.active_run_id && <Link to={`/marketing/agents?run=${h.snapshot.active_run_id}`}>Inspect stage run</Link>}</li>)}</ol>
      {canWrite && <fieldset className="marketing-fieldset" disabled={busy}>
        {o.state === 'awaiting_plan' && <button type="button" className="btn-primary" onClick={() => command('accept', o)}>Accept and continue</button>}
        {o.state === 'awaiting_review' && <><p>Ready for your review</p><button type="button" className="btn-primary" onClick={() => command('submit', o)}>Send to Approval</button></>}
        {o.state === 'changes_needed' && <button type="button" className="btn-primary" onClick={() => command('revise', o)}>Send changes to Creator</button>}
        {!terminal(o) && <><button type="button" className="btn-secondary" onClick={() => command('inspect', o)}>Inspect / refresh execution</button><button type="button" className="btn-secondary" onClick={() => command('stop', o)}>Stop orchestration</button></>}
        {o.state === 'completed' && task.status !== 'done' && <button type="button" className="btn-primary" onClick={() => command('complete_task', o)}>Mark task complete</button>}
      </fieldset>}
    </section>)}
    {canWrite && <fieldset className="marketing-fieldset" disabled={busy}>
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
