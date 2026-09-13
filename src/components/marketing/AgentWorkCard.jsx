import GuidedWorkCard from './GuidedWorkCard';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orchestrationRevisionRequest } from '../../lib/marketingRecovery';
import { commandMarketingOrchestration, readMarketingAgentRun } from '../../lib/marketing';
import { assetRevisionLink, constraintFailureLabel, WORKFLOW_LABELS } from '../../lib/marketingAgentWork';
import { AttentionIndicator } from './MarketingAttention';
import { ActiveConstraints, ConstraintChecks } from './HumanConstraints';
import { Outcome } from './MarketingRunHistory';

const icons = { inconsistent: '⚠', done: '✓', failed: '✕', action: '!', working: '◌', pending: '—', unknown: '?' };
const labels = { inconsistent: 'Guardian review inconsistent', done: 'Completed', failed: 'Needs changes', action: 'Human decision needed', working: 'In progress', pending: 'Not reached', unknown: 'Evidence is stale' };
export function StagePipeline({ stages }) {
  return <ol className="marketing-stage-pipeline" aria-label="Workflow pipeline">{stages.map(stage => <li key={stage.label} className={`stage-${stage.status}`}><span aria-hidden="true">{icons[stage.status]}</span> <span>{stage.label}</span><small>{labels[stage.status]}</small></li>)}</ol>;
}

function TechnicalWorkCard({ data, work, onRefresh, expanded = false, historyOnly = false, instructions: suppliedInstructions, onInstructionsChange }) {
  const [open, setOpen] = useState(expanded), [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const o = work.orchestration, asset = work.asset;
  const instructions = suppliedInstructions ?? notes;
  const canWrite = !historyOnly && ['contributor', 'approver', 'admin'].includes(data.role);
  const canAdvance = canWrite && !work.stale;
  const assetHref = asset && assetRevisionLink(asset);
  const completeTask = o?.state === 'completed' && work.task.status !== 'done' && canWrite;
  const approval = o?.state === 'awaiting_approval' && asset?.approval_state === 'in_review' && !work.stale;
  async function command(action) {
    setBusy(true); setError('');
    try { await commandMarketingOrchestration(action === 'revise' ? orchestrationRevisionRequest(data, o, instructions) : { workspace_id: data.workspace.id, id: o.id, expected_revision: o.revision, action, instructions }); }
    catch (e) { setError(e.message); }
    finally { try { await onRefresh(); } catch { setError('Refresh failed. Inspect current work before trying again.'); } setBusy(false); }
  }
  return <article className={`marketing-work-card marketing-attention-item ${work.severity}`} aria-label={`${work.task?.title || asset?.name || work.run?.purpose || 'Agent work'}: ${work.state}`}>
    <div className="marketing-work-heading"><div><p className="marketing-eyebrow">{work.campaign.name}</p><h3>{work.task?.title || asset?.name || work.run?.purpose || 'Standalone agent work'}</h3></div><AttentionIndicator items={work.items} /></div>
    <p>{o ? WORKFLOW_LABELS[o.workflow] : 'Standalone agent action · No task assigned'}</p>
    <h4>{work.state}</h4><p>{work.reason}</p>
    {work.pipeline.length > 0 && <StagePipeline stages={work.pipeline} />}
    {work.failures.length > 0 && <ul className="marketing-constraint-failures">{work.failures.map((check, index) => <li key={check.constraint_id || index}>{constraintFailureLabel(check)}</li>)}</ul>}
    {o && <p>Revision cycles {o.revision_cycles}/3{asset ? ` · Result: ${asset.name} · revision ${asset.revision}` : ''}</p>}
    <time dateTime={work.timestamp}>{work.timestamp ? new Date(work.timestamp).toLocaleString() : 'Timestamp unavailable'}</time>
    {historyOnly ? <p>Workflow decisions are available in Guided Work above.</p> : !o || approval ? <Link className="btn-primary" to={approval ? assetHref : work.href}>{work.action}</Link> : <button type="button" className="btn-primary" disabled={busy} aria-expanded={completeTask ? undefined : open} onClick={() => completeTask ? command('complete_task') : setOpen(value => !value)}>{work.action}</button>}
    {error && <p role="alert" className="marketing-error">{error}</p>}
    {o && <details open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Workflow details & actions</summary>
      {asset && <><Link to={assetHref}>Review asset manually · revision {asset.revision}</Link><pre className="marketing-asset-content">{asset.content}</pre></>}
      {work.stale && <p role="alert">The task, campaign or asset changed. Inspect the workflow before advancing it.</p>}
      {work.recovery?.human_change_request && <p className="marketing-preserve">Latest human requested changes: {work.recovery.human_change_request.notes}</p>}
      {['failed', 'blocked', 'changes_needed'].includes(o.state) && work.recovery && !work.recovery.eligible && <p>{work.recovery.reason}</p>}
      <ActiveConstraints data={data} assetId={o.asset_id} orchestrationId={o.id} />
      <ConstraintChecks checks={work.checks} />
      {open && o.active_run_id && <RunEvidence workspaceId={data.workspace.id} runId={o.active_run_id} />}
      {canWrite && <fieldset className="marketing-fieldset" disabled={busy}>
        {suppliedInstructions == null && <label className="form-field"><span>Agent team instructions / revision notes</span><textarea maxLength="4000" value={instructions} onChange={e => (onInstructionsChange || setNotes)(e.target.value)} /></label>}
        {canAdvance && o.state === 'awaiting_plan' && <button type="button" className="btn-primary" onClick={() => command('accept')}>Accept and continue</button>}
        {canAdvance && o.state === 'awaiting_review' && <button type="button" className="btn-primary" onClick={() => command('submit')}>Send to Approval</button>}
        {work.recovery?.eligible && <button type="button" className="btn-primary" onClick={() => command('revise')}>{work.failures.length ? 'Send failures to Creator' : 'Send changes to Creator'}</button>}
        {!['completed', 'blocked', 'failed', 'cancelled'].includes(o.state) && <><button type="button" className="btn-secondary" onClick={() => command('inspect')}>Inspect / refresh execution</button><button type="button" className="btn-secondary" onClick={() => command('stop')}>Stop workflow</button></>}
        {busy && <p role="status">Executing the authorized workflow…</p>}
      </fieldset>}
      <details><summary>View full history</summary><p>Recorded state: {o.state} · Workflow {o.id} · Assigned by {o.initiated_by}</p>
        <ol>{(data.orchestration_history || []).filter(h => h.workspace_id === data.workspace.id && h.orchestration_id === o.id).map(h => <li key={h.id}>{h.snapshot.state} · {new Date(h.occurred_at).toLocaleString()} · {h.actor_user_id ? `Human ${h.actor_user_id}` : 'Server transition'} {h.snapshot.active_run_id && <Link to={`/marketing/agents?run=${h.snapshot.active_run_id}`}>Inspect stage run</Link>}{h.snapshot.constraint_preflight?.length > 0 && <details><summary>Recorded constraint preflight</summary><ConstraintChecks checks={h.snapshot.constraint_preflight} /></details>}</li>)}</ol>
        <Link to={`/marketing/agents?view=history&task=${o.task_id}`}>Run History for this task</Link>
      </details>
    </details>}
  </article>;
}

function RunEvidence({ workspaceId, runId }) {
  const [state, setState] = useState({ runId: null, run: null, error: '' });
  useEffect(() => {
    let current = true;
    readMarketingAgentRun(workspaceId, runId).then(run => { if (current) setState({ runId, run, error: '' }); }).catch(e => { if (current) setState({ runId, error: e.message }); });
    return () => { current = false; };
  }, [workspaceId, runId]);
  return <section aria-label="Latest agent result"><h4>Latest agent result</h4>{state.runId !== runId ? <p>Loading recorded result…</p> : state.error ? <p role="alert">{state.error}</p> : <><p>{state.run.agent_key} · {state.run.status}</p><Outcome output={state.run.output_metadata} /></>}<Link to={`/marketing/agents?run=${runId}`}>Inspect full run</Link></section>;
}

export default function AgentWorkCard(props) {
  const context = props.data.guided_work?.find(c => c.orchestration_id === props.work.orchestration?.id);
  const technical = <TechnicalWorkCard {...props} historyOnly={Boolean(context)} />;
  return context ? <GuidedWorkCard key={`${props.work.orchestration.id}:${context.expected_revision}`} {...props} context={context}>{technical}</GuidedWorkCard> : technical;
}
