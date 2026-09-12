import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMarketingAgentRun } from '../../lib/marketing';

const actions = { accept_plan: 'Accepted', create_tasks: 'Tasks created', dismiss: 'Dismissed', send_to_approval: 'Sent to Approval' };

export default function AgentResolution({ data, run, onDone }) {
  const [selected, setSelected] = useState([]), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(null);
  const resolution = saved || data.resolutions?.find(item => item.agent_run_id === run.id);
  if (resolution) return <div role="status"><strong>{actions[resolution.action]}{resolution.action === 'create_tasks' ? `: ${resolution.created_task_ids.length}` : ''}</strong><p>By {resolution.actor_user_id} · {new Date(resolution.occurred_at).toLocaleString()}</p>{resolution.note && <p className="marketing-preserve">{resolution.note}</p>}{error && <p role="alert">{error}</p>}</div>;
  if (run.input_metadata?.orchestration) return <p><Link to={`/marketing/campaigns/${run.campaign_id}?task=${run.input_metadata.orchestration.task_id}`}>Open task Agent execution</Link> to record human decisions for this run.</p>;
  if (data.role === 'viewer' || run.status !== 'succeeded') return null;
  const result = run.output_metadata?.result;
  const strategist = run.agent_key === 'strategist';
  const asset = data.assets.find(item => item.id === run.input_metadata?.asset?.id);
  const guardian = run.agent_key === 'guardian' && result?.recommendation === 'ready_for_human_review'
    && asset?.approval_state === 'draft' && asset.publication_state === 'unpublished'
    && asset.revision === run.input_metadata?.asset?.revision
    && !run.output_metadata?.deterministic_qa?.some(check => check.passed === false);
  if (!strategist && !guardian) return null;
  async function resolve(action) {
    setBusy(true); setError('');
    try {
      const record = await resolveMarketingAgentRun(data.workspace.id, run.id, action, action === 'create_tasks' ? selected : [], note);
      setSaved(record);
      await onDone();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="marketing-form">
    <fieldset className="marketing-fieldset" disabled={busy}>
      <legend>Human resolution</legend>
      {strategist && <><p>Select proposed tasks to create. Owners and due dates remain unset.</p>{result?.proposed_tasks?.map((task, index) => <label key={index}><input type="checkbox" checked={selected.includes(index)} onChange={event => setSelected(values => event.target.checked ? [...values, index] : values.filter(value => value !== index))} /> {task}</label>)}</>}
      <label className="form-field"><span>Optional human note</span><textarea maxLength="4000" value={note} onChange={event => setNote(event.target.value)} /></label>
      {strategist ? <><button type="button" className="btn-secondary" onClick={() => resolve('accept_plan')}>Accept plan</button><button type="button" className="btn-primary" disabled={!selected.length} onClick={() => resolve('create_tasks')}>Create selected tasks</button><button type="button" className="btn-secondary" onClick={() => resolve('dismiss')}>Dismiss / no action</button></>
        : <><p>Submit this revision for a separate human decision. This does not approve the asset.</p><button type="button" className="btn-primary" onClick={() => resolve('send_to_approval')}>Send to Approval</button></>}
      {busy && <p role="status">Recording human action…</p>}
    </fieldset>
    {error && <p className="marketing-error" role="alert">{error}</p>}
  </div>;
}
