import { useState } from 'react';
import { saveMarketingPolicy } from '../../lib/marketing';
import { ConstraintEditor } from './HumanConstraints';
import { editableRules } from '../../lib/marketingGuidedWork';
export default function MarketingPolicy({ data, campaignId = null, onRefresh }) {
  const versions = (data.policy_versions || []).filter(s => s.campaign_id === campaignId);
  const current = versions.find(s => !s.superseded);
  return <PolicyEditor key={current?.id || 'new'} {...{ data, campaignId, onRefresh, versions, current }} />;
}
function PolicyEditor({ data, campaignId, onRefresh, versions, current }) {
  const [rules, setRules] = useState(() => editableRules(current?.constraints)), [json, setJson] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const canManage = ['approver', 'admin'].includes(data.role);
  return <section className="card"><h2>{campaignId ? 'Campaign Marketing Policy' : 'Workspace Marketing Policy'}</h2>
    <p>Standing rules are inherited by agent work. Campaign and review rules add requirements. Only a human policy manager can supersede this scope’s policy. Semantic instructions still need human judgment.</p>
    <p>Current version: {current?.id || 'No policy configured'}</p>
    {canManage ? <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await saveMarketingPolicy(data.workspace.id, campaignId, current?.id || null, rules); await onRefresh(); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>
      <fieldset className="marketing-fieldset" disabled={busy}><ConstraintEditor value={rules} onChange={setRules} />
        <details><summary>Import policy draft</summary><label className="form-field"><span>Policy rules JSON</span><textarea value={json} onChange={e => setJson(e.target.value)} /></label><button type="button" className="btn-secondary" onClick={() => { try { const parsed = JSON.parse(json); if (!Array.isArray(parsed) || parsed.length > 30 || parsed.some(r => !r || typeof r !== 'object' || typeof r.constraint_type !== 'string')) throw new Error('Expected an array of up to 30 rules.'); setRules(editableRules(parsed)); setError(''); } catch (err) { setError(err.message); } }}>Load draft for review</button><p>Loading does not save. Review the rules, then explicitly save this policy.</p></details>
        <button className="btn-primary" type="submit">Save Marketing Policy</button>
      </fieldset></form> : <ul>{current?.constraints.map(c => <li key={c.id}>{c.constraint_type.replaceAll('_', ' ')}: {c.value || 'Enabled'}</li>)}</ul>}
    {error && <p role="alert">{error}</p>}
    <details><summary>Policy version history</summary>{versions.map(s => <article key={s.id}><p>{s.superseded ? 'Superseded' : 'Current'} · Version {s.id} · Human {s.created_by} · {new Date(s.created_at).toLocaleString()}</p><ul>{s.constraints.map(c => <li key={c.id}>{c.constraint_type.replaceAll('_', ' ')}: {c.value || 'Enabled'}</li>)}</ul></article>)}</details>
  </section>;
}
