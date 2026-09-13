import GuardianEvidence from './GuardianEvidence';
import { guidedPipeline, guardianRetryRequest, plainWorkReason } from '../../lib/marketingGuidedWork';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { commandMarketingOrchestration, readMarketingAgentRun } from '../../lib/marketing';
import { orchestrationRevisionRequest } from '../../lib/marketingRecovery';
import { ActiveConstraints, ConstraintChecks, ConstraintEditor } from './HumanConstraints';
import { editableRules } from '../../lib/marketingGuidedWork';
import { AttentionIndicator } from './MarketingAttention';

export default function GuidedWorkCard({ data, work, context, onRefresh, children }) {
  const o = work.orchestration, asset = work.asset;
  const [advanced, setAdvanced] = useState(false);
  const [editing, setEditing] = useState(false), [notes, setNotes] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [plan, setPlan] = useState(null);
  const current = data.human_constraint_sets?.find(s => !s.superseded && s.asset_id === asset?.id);
  const [rules, setRules] = useState(() => editableRules(current?.constraints));
  const actions = context.actions || [];
  const { stages, current: stage, kind } = guidedPipeline(work, context);
  const recovery = ['failed', 'blocked'].includes(o.state);
  const blockedPolicy = (work.checks || []).some(q => q.passed === false) || (o.constraint_preflight || []).some(q => q.passed === false);
  async function command(action, decision) {
    setBusy(true); setError('');
    try {
      const request = action === 'retry_guardian' ? guardianRetryRequest(data, o) : action === 'revise' ? orchestrationRevisionRequest(data, o, notes) : {
        workspace_id: data.workspace.id, id: o.id, expected_revision: o.revision, action,
        ...(action === 'review' ? { decision, notes, review_constraints: rules, asset_revision: context.asset_revision, task_revision: context.task_revision, campaign_revision: context.campaign_revision, constraint_set_ids: context.constraint_set_ids } : {}),
      };
      await commandMarketingOrchestration(request); setEditing(false); setNotes('');
    } catch (err) { setError(err.message); }
    finally { try { await onRefresh(); } catch { setError('Refresh failed. Inspect current work before retrying.'); } setBusy(false); }
  }
  return <article className="card marketing-guided-work" id={`work-${o.id}`}>
    <h3>{work.task.title}</h3><p><Link to={`/marketing/campaigns/${o.campaign_id}?task=${o.task_id}&work=${o.id}`}>{work.campaign.name} · Guided Work</Link></p>
    <AttentionIndicator items={work.items || []} />
    {kind === 'guardian_inconsistent' && <p role="status">Guardian review issue</p>}
    <ol className="marketing-stage-pipeline" aria-label="Guided workflow pipeline">{stages.map(({ label: name, status }) => <li key={name} className={`stage-${status}`} aria-current={stage === name ? 'step' : undefined}><strong>{name} <span aria-hidden="true">{({ done: '✓', action: '!', working: '↻', failed: '✕', inconsistent: '⚠', technical: '⚠', pending: '—', unknown: '?' })[status]}</span></strong><small>{stage === name ? 'Current step · ' : ''}{({ done: 'Completed', action: 'Human decision needed', working: 'In progress', failed: name === 'CHECK' ? 'Policy issue' : 'Could not complete', inconsistent: 'Guardian review inconsistent', technical: 'Guardian could not complete', pending: 'Not reached', unknown: 'Needs inspection' })[status]}</small></li>)}</ol>
    <p><strong>Step {Math.max(1, stages.findIndex(s => s.label === stage) + 1)} of {stages.length}: {stage === 'DONE' ? 'Agent work complete' : kind === 'guardian_inconsistent' ? 'Guardian review needs retry' : kind === 'guardian_technical' ? 'Guardian could not complete' : kind === 'guardian_changes' ? 'Guardian recommends changes' : kind === 'ready' ? 'Ready for your review' : stage === 'REVIEW' ? 'Guardian is reviewing' : stage === 'PLAN' ? 'Review the execution plan' : kind === 'policy_issue' ? 'Revision blocked by Marketing Policy' : stage === 'CHECK' ? 'Checking Marketing Policy' : 'Creating your draft'}</strong></p>
    <p>{stage === 'DONE' ? 'The agent workflow is complete. You decide when the task itself is done.' : plainWorkReason(context.reason)}</p>
    {kind === 'ready' && stages.find(s => s.label === 'CHECK')?.status === 'done' && <p>Creator completed this draft. Automated checks passed. Guardian recommends human review. You decide what happens next.</p>}
    <p>Revision cycles: {o.revision_cycles}/3</p>
    {kind === 'guardian_changes' && <section aria-label="Guardian recommends changes"><h4>Guardian recommends changes</h4><p>Automated policy checks passed, but Guardian identified these issues:</p><ul>{context.guardian?.findings?.filter(f => f.requires_correction).map((f, i) => <li key={i}>{f.finding}</li>)}</ul><ul>{context.guardian?.constraint_evaluations?.filter(e => e.status === 'violated').map(e => <li key={e.constraint_id}>{e.detail}</li>)}</ul></section>}
    {context.guardian?.status === 'succeeded' && <details><summary>View Guardian details</summary><ul>{context.guardian.findings.map((f,i) => <li key={i}>{f.requires_correction ? 'Action needed' : 'Information'}: {f.finding}</li>)}</ul><ul>{context.guardian.constraint_evaluations.map(e => <li key={e.constraint_id}>{e.status.replaceAll('_',' ')}: {e.detail}</li>)}</ul></details>}
    {context.human_change_request?.notes && <p>Latest requested changes: {context.human_change_request.notes}</p>}
    {blockedPolicy && <p role="status"><strong>Revision blocked by Marketing Policy</strong> · Guardian does not run when deterministic preflight blocks the revision.</p>}
    {asset && <section><h4>{asset.name} · Revision {asset.revision}</h4><pre className="marketing-asset-content">{asset.content}</pre></section>}
    <ActiveConstraints data={data} assetId={asset?.id} orchestrationId={o.id} />
    <ConstraintChecks checks={work.checks?.length ? work.checks : o.constraint_preflight} />
    {o.plan_run_id && actions.includes('accept') && <section><button type="button" className="btn-secondary" onClick={async () => { try { setPlan(await readMarketingAgentRun(data.workspace.id, o.plan_run_id)); } catch (err) { setError(err.message); } }}>View proposed plan</button>{plan && <><p>{plan.output_metadata?.result?.summary}</p><ol>{plan.output_metadata?.result?.steps?.map((step, i) => <li key={i}><strong>{step.title}</strong> — {step.rationale}</li>)}</ol><ul>{plan.output_metadata?.result?.proposed_tasks?.map((title, i) => <li key={i}>{title}</li>)}</ul></>}</section>}
    <fieldset className="marketing-fieldset" disabled={busy}>
      {!editing && <div className="marketing-actions">
        {actions.includes('accept') && <button type="button" className="btn-primary" onClick={() => command('accept')}>Accept Plan</button>}
        {actions.includes('stop') && <button type="button" className="btn-secondary" onClick={() => command('stop')}>Stop</button>}
        {actions.includes('approve') && <button type="button" className="btn-primary" onClick={() => command('review', 'approve')}>Approve</button>}
        {actions.includes('retry_guardian') && <button type="button" className="btn-primary" onClick={() => command('retry_guardian')}>Retry Guardian</button>}
        {kind === 'guardian_inconsistent' && <button type="button" className="btn-secondary" onClick={() => setAdvanced(true)}>Inspect Guardian details</button>}
        {kind === 'guardian_technical' && <button type="button" className="btn-secondary" onClick={() => setAdvanced(true)}>Inspect technical issue</button>}
        {actions.includes('request_changes') && <button type="button" className="btn-secondary" onClick={() => { setRules(editableRules(current?.constraints)); setEditing(true); }}>{kind === 'guardian_changes' ? 'Request Changes & Send for Revision' : recovery ? 'Continue this work' : 'Request Changes'}</button>}
        {actions.includes('revise') && <button type="button" className="btn-primary" onClick={() => command('revise')}>Send Back for Revision</button>}
        {actions.includes('complete_task') && <button type="button" className="btn-primary" onClick={() => command('complete_task')}>Mark Task Complete</button>}
      </div>}
      {editing && <form onSubmit={e => { e.preventDefault(); command('review', 'request_changes'); }}>
        <label className="form-field"><span>What needs to change?</span><textarea required maxLength="4000" value={notes} onChange={e => setNotes(e.target.value)} /></label>
        <p>Standing policy and prior rules are inherited automatically. Add only new requirements for this work.</p>
        <details><summary>Add or update rules for this work</summary><ConstraintEditor value={rules} onChange={setRules} /></details>
        <button type="submit" className="btn-primary" disabled={!notes.trim()}>Request Changes &amp; Send for Revision</button>
        <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
      </form>}
      {busy && <p role="status">{editing ? "Revision requested. Creator is revising your content; policy checks and Guardian review follow before your next decision." : "Executing your authorized action…"}</p>}
    </fieldset>
    {error && <p role="alert" className="marketing-error">{error}</p>}
    <details open={advanced} onToggle={e => setAdvanced(e.currentTarget.open)}><summary>Advanced technical history</summary>{advanced && <><GuardianEvidence evidence={context.guardian} />{actions.includes('retry_guardian') && <button type="button" disabled={busy} onClick={() => command('retry_guardian')}>Retry Guardian</button>}{children}</>}</details>
  </article>;
}
