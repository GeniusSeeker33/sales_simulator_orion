import GuardianEvidence from './GuardianEvidence';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ASSET_TYPES, readMarketingAgentRun, readMarketingAgentRuns, runMarketingAgent } from '../../lib/marketing';
import { AttentionIndicator } from './MarketingAttention';

import { ConstraintChecks } from './HumanConstraints';
import AgentResolution from './AgentResolution';

const label = value => value.replaceAll('_', ' ');
const date = value => value ? new Date(value).toLocaleString() : '—';

export default function MarketingRunHistory({ data, campaign, onRefresh }) {
  const [params] = useSearchParams(), selectedRun = params.get('run');
  const [runs, setRuns] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState({ campaign: '', task: params.get('task') || '', agent: '', status: '' });
  const filterField = (name, options) => <label className="form-field"><span>Filter {name}</span><select value={filters[name]} onChange={e => setFilters({ ...filters, [name]: e.target.value })}><option value="">All {name}s</option>{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>;
  const visibleRuns = runs.filter(run => run.workspace_id === data.workspace.id && (!filters.campaign || run.campaign_id === filters.campaign) && (!filters.task || run.input_metadata?.orchestration?.task_id === filters.task || data.orchestrations?.some(o => o.task_id === filters.task && o.run_ids.includes(run.id))) && (!filters.agent || run.agent_key === filters.agent) && (!filters.status || run.status === filters.status));
  useEffect(() => {
    let current = true;
    (selectedRun ? readMarketingAgentRun(data.workspace.id, selectedRun).then(run => [run]) : readMarketingAgentRuns(data.workspace.id, campaign?.id)).then(result => { if (current) { setRuns(result); setError(''); } })
      .catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [data.workspace.id, campaign?.id, revision, selectedRun, data]);
  const refresh = () => { setRevision(value => value + 1); };
  return <section className="card marketing-workflow">
    <div className="section-header"><div><h2>{campaign ? 'Campaign agents' : 'Run History'}</h2><p>Human initiated work. Plans and QA recommendations are advisory; asset approval requires a separate human decision.</p></div><button className="btn-secondary" onClick={() => { refresh(); onRefresh().catch(e => setError(e.message)); }}>Refresh runs</button></div>
    {campaign && data.role !== 'viewer' && <AgentForm key={campaign.id} data={data} campaign={campaign} onDone={async () => { refresh(); await onRefresh(); }} />}
    {error && <p role="alert" className="marketing-error">{error}</p>}
    {loading ? <p>Loading agent runs…</p> : !runs.length && <p>No agent runs yet. Open a campaign to explicitly initiate one.</p>}
    <p className="section-subtext">Most recent 50 runs. Usage and cost appear only when available. A started run has no confirmed outcome; refresh before initiating another.</p>
    {selectedRun && <Link to="/marketing/agents?view=history">All recent runs</Link>}
    {!campaign && <div className="marketing-history-filters">{filterField('campaign', data.campaigns.map(c => [c.id, c.name]))}{filterField('task', (data.tasks || []).filter(t => !filters.campaign || t.campaign_id === filters.campaign).map(t => [t.id, t.title]))}{filterField('agent', ['strategist', 'creator', 'guardian'].map(a => [a, label(a)]))}{filterField('status', ['started', 'succeeded', 'failed', 'cancelled'].map(s => [s, s]))}</div>}
    {!loading && runs.length > 0 && !visibleRuns.length && <p>No runs match these filters in the loaded history.</p>}
    {visibleRuns.map(run => <details className="marketing-record" open={selectedRun === run.id ? true : undefined} key={run.id}>
      <summary>{label(run.agent_key)} · {run.status} · {run.purpose} · <AttentionIndicator items={data.attention_runs.some(item => item.id === run.id && item.status === run.status) ? data.attention.filter(item => item.run_id === run.id) : [{ severity: "critical" }]} /></summary>

      <p>Campaign: <Link to={`/marketing/campaigns/${run.campaign_id}`}>{data.campaigns.find(c => c.id === run.campaign_id)?.name || run.campaign_id}</Link></p>
      <p>Initiated by {run.initiated_by} · Run {run.id}</p>
      <p>Started {date(run.started_at)} · Completed {date(run.ended_at)}</p>
      <p>{run.provider || 'Provider unavailable'} / {run.model || 'Model unavailable'} · Instructions {run.instruction_version || 'Legacy'}</p>
      <p>Tokens: input {run.usage?.input_tokens ?? '—'}, output {run.usage?.output_tokens ?? '—'}, total {run.usage?.total_tokens ?? '—'} · Cost: {run.cost_usd == null ? 'Unavailable' : `$${Number(run.cost_usd).toFixed(6)} USD`}</p>
      {run.error_code && <p className="marketing-error">Run failed: {label(run.error_code)}. No agent results applied.</p>}
      {run.outcome_asset_id && <p>Outcome asset: <Link to={`/marketing/campaigns/${run.campaign_id}?asset=${run.outcome_asset_id}`}>{run.outcome_asset_id}</Link></p>}
      {run.input_metadata?.human_change_request && <details><summary>Revision handoff evidence</summary><p>Human requested changes: {run.input_metadata.human_change_request.notes}</p><p>Prior asset revision {run.input_metadata.asset.revision}</p><pre className="marketing-asset-content">{run.input_metadata.asset.content}</pre><p>Supplemental instructions: {run.input_metadata.request.supplemental_instructions || 'None'}</p>{run.input_metadata.guardian_assessment && <><Link to={`/marketing/agents?run=${run.input_metadata.guardian_assessment.run_id}`}>Inspect prior Guardian assessment</Link><Outcome output={run.input_metadata.guardian_assessment.output_metadata} /></>}</details>}
      <GuardianEvidence evidence={run.guardian_evidence} />
      <Outcome output={run.output_metadata} />
      <AgentResolution data={data} run={run} onDone={onRefresh} />
    </details>)}
  </section>;
}

export function Outcome({ output }) {
  const result = output?.result;
  if (!result) return null;
  return <div className="marketing-workflow">
    {result.summary && <p className="marketing-preserve">{result.summary}</p>}
    {result.steps && <ol>{result.steps.map((step, i) => <li key={i}><strong>{step.title}</strong><p>{step.rationale}</p></li>)}</ol>}
    {result.proposed_tasks?.length > 0 && <><h4>Proposed tasks — add through the human task workflow</h4><ul>{result.proposed_tasks.map((task, i) => <li key={i}>{task}</li>)}</ul></>}
    {result.content && <><h4>{result.name}</h4><pre className="marketing-asset-content">{result.content}</pre></>}
    {result.recommendation && <p><strong>Advisory recommendation: {label(result.recommendation)}</strong> · Not human approval.</p>}
    {result.findings?.map((finding, i) => <p key={i}><strong>{finding.category} · {finding.severity}:</strong> {finding.finding}</p>)}
    {result.constraint_evaluations?.length > 0 && <><h4>Guardian constraint evaluations</h4><ul>{result.constraint_evaluations.map(e => <li key={e.constraint_id}>{e.status.replaceAll('_', ' ')} · {e.detail} · Constraint {e.constraint_id}</li>)}</ul></>}
    <ConstraintChecks checks={output.deterministic_qa?.filter(q => q.constraint_id)} />
    {output.deterministic_qa?.length > 0 && <><h4>Deterministic QA for the recorded revision</h4><ul>{output.deterministic_qa.map(check => <li key={check.rule}>{check.review_required ? 'Human semantic review' : check.passed ? 'Pass' : 'Needs attention'}: {check.detail}</li>)}</ul></>}
  </div>;
}

function AgentForm({ data, campaign, onDone }) {
  const [agent, setAgent] = useState('strategist'), [purpose, setPurpose] = useState('');
  const [assetType, setAssetType] = useState(ASSET_TYPES[0]), [assetId, setAssetId] = useState(''), [submit, setSubmit] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const assets = data.assets.filter(asset => asset.campaign_id === campaign.id);
  const action = { strategist: 'Ask Strategist', creator: 'Create draft with Creator', guardian: 'Run Guardian QA' }[agent];
  async function execute(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await runMarketingAgent({ workspace_id: data.workspace.id, campaign_id: campaign.id, agent_key: agent, purpose,
        ...(agent === 'creator' ? { asset_type: assetType, submit_for_review: submit } : {}),
        ...(agent === 'guardian' ? { asset_id: assetId } : {}),
      });
    } catch (e) { setError(e.message); }
    finally {
      try { await onDone(); } catch { setError('Refresh failed. Check Agents before initiating another run.'); }
      setBusy(false);
    }
  }
  return <form className="marketing-form" onSubmit={execute}>
    <fieldset className="marketing-fieldset" disabled={busy}>
      <label className="form-field"><span>Agent action</span><select value={agent} onChange={e => setAgent(e.target.value)}><option value="strategist">Ask Strategist</option><option value="creator">Create draft with Creator</option><option value="guardian">Run Guardian QA</option></select></label>
      <label className="form-field"><span>Purpose / authorized instruction</span><textarea required maxLength="4000" rows="3" value={purpose} onChange={e => setPurpose(e.target.value)} /></label>
      {agent === 'creator' && <><label className="form-field"><span>Requested asset type</span><select value={assetType} onChange={e => setAssetType(e.target.value)}>{ASSET_TYPES.map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label><label><input type="checkbox" checked={submit} onChange={e => setSubmit(e.target.checked)} /> Submit the new draft for human review</label></>}
      {agent === 'guardian' && <label className="form-field"><span>Asset to review</span><select required value={assetId} onChange={e => setAssetId(e.target.value)}><option value="">Select asset</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} · revision {asset.revision}</option>)}</select></label>}
      <button className="btn-primary" type="submit">{busy ? 'Agent running…' : action}</button>
    </fieldset>
    {error && <p className="marketing-error" role="alert">{error}</p>}
  </form>;
}
