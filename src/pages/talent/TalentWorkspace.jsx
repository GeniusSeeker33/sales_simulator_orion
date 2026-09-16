import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { readTalent, readTalentIntake } from '../../lib/talent';
import '../../styles/talent.css';

const stages = ['lead', 'applicant', 'candidate', 'learner', 'employee', 'alumni', 'inactive'];
const statuses = ['draft', 'submitted', 'in_review', 'qualified', 'approved', 'rejected', 'withdrawn', 'hired', 'activated'];
const label = value => value ? value.replaceAll('_', ' ') : 'Not recorded';
const name = person => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.preferred_name || 'Unnamed candidate';
const owner = (id, displayName) => id ? displayName || `Recruiter · ${id.slice(-8)}` : 'Unassigned';
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
function Badge({ value }) { return <span className={`talent-badge talent-badge-${value || 'none'}`}>{label(value)}</span>; }
function Source({ record }) {
  return <details className="talent-source"><summary>Source details</summary><dl><dt>System</dt><dd>{record.source_system}</dd><dt>Entity</dt><dd>{record.source_entity}</dd><dt>Original reference</dt><dd>{record.source_id}</dd></dl></details>;
}
function Attention({ reasons }) {
  return reasons.length ? <ul className="talent-reasons">{reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.text}</li>)}</ul> : <p>No attention conditions detected from recorded status and task dates.</p>;
}

export default function TalentWorkspace() {
  const location = useLocation();
  return location.pathname === '/talent/intake' ? <IntakeReview /> : <CandidatesWorkspace />;
}

function CandidatesWorkspace() {
  const { personId } = useParams();
  const [search, setSearch] = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', data: null, error: '' });
  const key = `${personId || ''}?${search.toString()}&refresh=${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    const params = Object.fromEntries(new URLSearchParams(key.split('?')[1]));
    delete params.refresh;
    if (personId) {
      for (const field of Object.keys(params)) if (field !== 'workspace_id') delete params[field];
      params.person_id = personId;
    }
    readTalent(params, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, data, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, data: null, error: error.message });
    });
    return () => controller.abort();
  }, [key, personId]);
  const loading = state.key !== key;
  const data = loading ? null : state.data;
  function filter(field, value) {
    const next = new URLSearchParams(search);
    value ? next.set(field, value) : next.delete(field);
    if (field !== 'page') next.delete('page');
    setSearch(next);
  }
  return <Layout title="Talent Command Center"><div className="talent-workspace">
    <div className="talent-heading"><p>Candidates, applications and relationship history across your workspace.</p><span className="talent-badge">Read only</span></div>
    <nav className="talent-subnav" aria-label="Talent workspace"><Link aria-current="page" to={`/talent/candidates?${search}`}>Candidates</Link><IntakeLink workspaceId={search.get('workspace_id') || data?.workspace.id || ''} /></nav>
    <div className="talent-toolbar"><h2>{personId ? 'Candidate 360' : 'Candidates'}</h2><button className="btn-secondary" onClick={() => setRevision(v => v + 1)}>Refresh</button></div>
    {loading && <p role="status">Loading candidate records…</p>}
    {!loading && state.error && <section className="card" role="alert"><h3>Talent workspace unavailable</h3><p>{state.error}</p><p>Your administrator can confirm CRM workspace membership and server configuration.</p>{personId && <Link to={`/talent/candidates?${new URLSearchParams({ workspace_id: search.get('workspace_id') || '' })}`}>Back to candidates</Link>}</section>}
    {data && <>
      {!personId && <label className="talent-workspace-select">Workspace<select aria-label="Workspace" value={data.workspace.id} onChange={e => setSearch({ workspace_id: e.target.value })}>{data.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
      {personId ? <CandidateProfile key={`${data.person.id}-${data.workspace.id}`} data={data} /> : <>
        <form className="talent-filters" onSubmit={e => { e.preventDefault(); filter('q', new FormData(e.currentTarget).get('q').trim()); }}>
          <label>Search candidates<div className="talent-search"><input key={search.get('q') || ''} name="q" aria-label="Search candidates" defaultValue={search.get('q') || ''} maxLength={200} placeholder="Name, email or job reference" /><button className="btn-secondary" type="submit">Search</button></div></label>
          <Filter title="Lifecycle stage" value={search.get('stage')} values={stages} onChange={value => filter('stage', value)} />
          <Filter title="Latest application status" value={search.get('status')} values={statuses} onChange={value => filter('status', value)} />
          <label>Owner<select aria-label="Owner" value={search.get('owner') || ''} onChange={e => filter('owner', e.target.value)}><option value="">All owners</option><option value="unassigned">Unassigned</option>{data.owners.map(o => <option key={o.id} value={o.id}>{owner(o.id, o.name)}</option>)}</select></label>
          <Filter title="Source system" value={search.get('source')} values={data.sources} onChange={value => filter('source', value)} />
          <button className="btn-secondary" type="button" onClick={() => setSearch({ workspace_id: data.workspace.id })}>Clear filters</button>
        </form>
        <section className="talent-attention card"><h3>Needs Attention <span>{data.candidates.filter(c => c.attention.length).length} on this page</span></h3><p>Based on assignment, latest application status, a 7-day review window and recorded task due dates.</p></section>
        <section className="card talent-list"><div className="talent-toolbar"><h3>Candidate pipeline</h3><span>{data.total} matching · {data.workspace_total} in workspace</span></div>
          {data.candidates.length ? <div className="talent-table-scroll"><table className="talent-table"><caption className="talent-sr-only">Candidate pipeline, most recent activity first</caption><thead><tr><th>Candidate</th><th>Lifecycle</th><th>Latest application</th><th>Owner</th><th>Source</th><th>Latest activity</th><th>Next action</th></tr></thead><tbody>{data.candidates.map(c => <tr key={c.id}>
            <td><Link to={`/talent/candidates/${c.id}?workspace_id=${data.workspace.id}`}>{name(c)}</Link><small>{c.email || 'Email not recorded'}</small></td>
            <td><Badge value={c.lifecycle_stage} /></td><td>{c.latest_application ? <><Badge value={c.latest_application.status} /><small>{c.latest_application.job_ref || 'Role not recorded'}</small></> : 'No applications'}</td>
            <td title={c.latest_application?.assigned_to || undefined}>{owner(c.latest_application?.assigned_to, c.latest_application?.owner_name)}</td><td>{c.source_system}{c.latest_application && c.latest_application.source_system !== c.source_system && <small>Application: {c.latest_application.source_system}</small>}</td><td>{date(c.latest_activity_at)}</td>
            <td>{c.next_action && <><strong>{c.next_action.summary}</strong><small>Due {date(c.next_action.due_at)}</small></>}{c.attention.length ? <details><summary className="talent-attention-label">{c.attention.length} attention {c.attention.length === 1 ? 'reason' : 'reasons'}</summary><Attention reasons={c.attention} /></details> : !c.next_action && 'No action recorded'}</td>
          </tr>)}</tbody></table></div> : <div className="talent-empty"><h3>{data.workspace_total === 0 ? 'No candidate records have been imported into the unified CRM yet.' : 'No candidates match this view.'}</h3><p>{data.workspace_total === 0 ? 'Join-Orion migration/integration is a separate step. Imported candidate records will appear here when available.' : 'Clear filters or return to the first page to see more candidates.'}</p></div>}
          <div className="talent-pagination"><button className="btn-secondary" disabled={data.page <= 1} onClick={() => filter('page', String(data.page - 1))}>Previous</button><span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.page_size))}</span><button className="btn-secondary" disabled={data.page * data.page_size >= data.total} onClick={() => filter('page', String(data.page + 1))}>Next</button></div>
        </section>
      </>}
    </>}
  </div></Layout>;
}

function IntakeLink({ workspaceId }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!workspaceId) return undefined;
    const controller = new AbortController();
    readTalentIntake(workspaceId, controller.signal).then(data => !controller.signal.aborted && setCount(data.actionable_count)).catch(() => {});
    return () => controller.abort();
  }, [workspaceId]);
  return <Link to={`/talent/intake?workspace_id=${workspaceId}`}>Intake Review{count > 0 && <span className="talent-count" aria-label={`${count} applications awaiting review`}>{count}</span>}</Link>;
}

function IntakeReview() {
  const [search] = useSearchParams();
  const workspaceId = search.get('workspace_id') || '';
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', data: null, error: '' });
  const key = `${workspaceId}:${revision}`;
  useEffect(() => {
    if (!workspaceId) return undefined;
    const controller = new AbortController();
    readTalentIntake(workspaceId, controller.signal).then(data => !controller.signal.aborted && setState({ key, data, error: '' }))
      .catch(error => !controller.signal.aborted && setState({ key, data: null, error: error.message }));
    return () => controller.abort();
  }, [key, workspaceId]);
  const loading = Boolean(workspaceId) && state.key !== key;
  const data = loading ? null : state.data;
  const error = workspaceId ? state.error : 'Choose a workspace from Candidates before opening Intake Review.';
  return <Layout title="Talent Command Center"><div className="talent-workspace">
    <div className="talent-heading"><p>Human-governed review of new Join-Orion applications before CRM import.</p><span className="talent-badge">Read only</span></div>
    <nav className="talent-subnav" aria-label="Talent workspace"><Link to={`/talent/candidates?workspace_id=${workspaceId}`}>Candidates</Link><Link aria-current="page" to={`/talent/intake?workspace_id=${workspaceId}`}>Intake Review{data?.actionable_count ? <span className="talent-count">{data.actionable_count}</span> : ''}</Link></nav>
    <div className="talent-toolbar"><div><h2>New candidate applications awaiting review</h2>{data && <p>{data.actionable_count} eligible application{data.actionable_count === 1 ? '' : 's'} · refreshed {date(data.refreshed_at)}</p>}</div><button className="btn-secondary" onClick={() => setRevision(value => value + 1)}>Refresh</button></div>
    {loading && <p role="status">Refreshing candidate intake…</p>}
    {!loading && error && <section className="card" role="alert"><h3>Candidate intake unavailable</h3><p>{error}</p><p>This is not an empty queue. Retry or ask an administrator to check the named service configuration.</p></section>}
    {data && <>
      {(data.diagnostics.invalid_count > 0 || data.diagnostics.source_mapping_attention_count > 0) && <section className="card talent-attention" role="status"><h3>Source records need configuration attention</h3><p>{data.diagnostics.invalid_count} invalid · {data.diagnostics.source_mapping_attention_count} mapping attention. These records are not presented as import-ready.</p></section>}
      {data.items.length ? <section className="card talent-list"><div className="talent-table-scroll"><table className="talent-table"><caption className="talent-sr-only">Join-Orion candidate intake review queue</caption><thead><tr><th>Candidate</th><th>Applied</th><th>Position</th><th>Source / recruiter</th><th>Resume</th><th>Review state</th></tr></thead><tbody>{data.items.map(item => <tr key={item.source_application_id}>
        <td><strong>{item.candidate_name}</strong><small>Application {item.source_application_id}</small></td><td>{date(item.application_date)}</td><td>{item.position_title || item.position_reference || 'Not recorded'}<small>Source status: {label(item.source_status)}</small></td><td>{item.application_source || 'Not recorded'}<small>{item.recruiter || 'Recruiter not recorded'}</small></td><td>{item.resume_metadata_exists ? 'Present' : 'Not recorded'}</td><td><Badge value={item.state} /><small>{item.reason}</small><details><summary>Review details</summary><dl className="talent-facts"><dt>Proposed mapping</dt><dd>Applicant · Candidate · {label(item.proposed_crm_mapping.application_status)}</dd><dt>Duplicate evidence</dt><dd>{item.duplicate_evidence ? `${item.duplicate_evidence.categories.join(', ')} — ${item.duplicate_evidence.explanation}` : 'None detected'}</dd><dt>Provenance</dt><dd>{item.provenance.source_system} / {item.provenance.source_entity} / {item.provenance.source_id}</dd><dt>Learner linkage</dt><dd>Not verified</dd><dt>Employment linkage</dt><dd>Not verified</dd></dl></details></td>
      </tr>)}</tbody></table></div></section> : <section className="card talent-empty"><h3>No candidate applications are awaiting import review.</h3><p>Future genuine applications appear automatically unless explicitly excluded or already represented by CRM provenance.</p></section>}
      <p className="talent-footnote">Manual refresh only. Review does not import, merge, rank, or make a hiring recommendation. Exclusion fingerprint: {data.exclusion_manifest?.fingerprint || 'not available'}.</p>
    </>}
  </div></Layout>;
}

function Filter({ title, value, values, onChange }) {
  return <label>{title}<select aria-label={title} value={value || ''} onChange={e => onChange(e.target.value)}><option value="">All</option>{values.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>;
}
function CandidateProfile({ data }) {
  const [section, setSection] = useState('Overview');
  const p = data.person;
  return <>
    <Link to={`/talent/candidates?workspace_id=${data.workspace.id}`}>← Back to candidates</Link>
    <header className="card talent-profile-heading"><div><h2>{name(p)}</h2><p>{p.email || 'Email not recorded'} · {data.workspace.name}</p></div><Badge value={p.lifecycle_stage} /></header>
    <nav className="talent-tabs" aria-label="Candidate sections">{['Overview', 'Applications', 'Activity', 'Documents', 'Talent Journey'].map(tab => <button key={tab} aria-current={section === tab ? 'page' : undefined} onClick={() => setSection(tab)}>{tab}{tab === 'Applications' ? ` (${data.applications.length})` : ''}</button>)}</nav>
    <section className="card talent-panel" aria-label={section}>
      {section === 'Overview' && <><h3>Contact and relationship</h3><dl className="talent-facts"><dt>Name</dt><dd>{name(p)}</dd><dt>Preferred name</dt><dd>{p.preferred_name || 'Not recorded'}</dd><dt>Email</dt><dd>{p.email || 'Not recorded'}</dd><dt>Phone</dt><dd>{p.phone || 'Not recorded'}</dd><dt>CRM lifecycle stage</dt><dd><Badge value={p.lifecycle_stage} /></dd><dt>Source system</dt><dd>{p.source_system}</dd><dt>Learner linkage</dt><dd>Not verified</dd></dl><Source record={p} />
        <h3>Needs Attention</h3><Attention reasons={data.attention} /><h3>Communication consent</h3>{data.consent.length ? data.consent.map(c => <article className="talent-record" key={c.id}><strong>{label(c.channel)} · {c.purpose}</strong><p><Badge value={c.status} /> · Captured {date(c.captured_at)}</p><Source record={c} /></article>) : <p>No communication consent has been recorded.</p>}
      </>}
      {section === 'Applications' && <><h3>Applications</h3><p>Newest records first. Each application keeps its own status and role.</p>{data.applications.length ? data.applications.map(a => <article className="talent-record" key={a.id}><div className="talent-toolbar"><h4>{a.job_ref || 'Role not recorded'}</h4><Badge value={a.status} /></div><p>{label(a.application_type)} · Submitted {date(a.submitted_at)}</p><p title={a.assigned_to || undefined}>Owner: {owner(a.assigned_to, a.owner_name)}</p><p>Source: {a.source_system}</p><Source record={a} /></article>) : <p>No applications are recorded for this candidate.</p>}</>}
      {section === 'Activity' && <><h3>Relationship history</h3>{data.activities.length ? <ol className="talent-timeline">{data.activities.map(a => <li key={a.id}><div className="talent-toolbar"><Badge value={a.activity_type} /><time dateTime={a.occurred_at}>{date(a.occurred_at)}</time></div><p className="talent-activity-summary">{a.summary}</p>{a.application_id && <p>Application: {data.applications.find(app => app.id === a.application_id)?.job_ref || 'Role not recorded'}</p>}{a.task?.due_at && <p>Due {date(a.task.due_at)} · {label(a.task.status)}</p>}<p>Source: {a.source_system}</p><Source record={a} /></li>)}</ol> : <p>No activity has been recorded.</p>}</>}
      {section === 'Documents' && <><h3>Documents</h3><p>Document metadata only. File access requires a separately authorized document service.</p>{data.documents.length ? data.documents.map(d => <article key={d.id} className="talent-record"><h4>{d.original_filename || 'Untitled document'}</h4><p>{label(d.document_type)} · Added {date(d.created_at)}</p><p>Source: {d.source_system}</p><Source record={d} /></article>) : <p>No document metadata has been recorded.</p>}</>}
      {section === 'Talent Journey' && <><h3>Talent Journey</h3><p><Badge value="candidate" /></p><h4>No verified learner or employment linkage</h4><p>Learner linkage: Not verified</p><p>A verified cross-system relationship has not been established. Application status and contact details do not establish learner identity or employment.</p></>}
    </section>
  </>;
}
