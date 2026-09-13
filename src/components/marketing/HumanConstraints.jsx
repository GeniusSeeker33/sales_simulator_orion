import { useState } from 'react';
import { saveMarketingHumanConstraints } from '../../lib/marketing';

const toggles = [
  ['no_fabricated_testimonial', 'No fabricated testimonials'],
  ['no_unverified_comparative_claim', 'No unverified comparative claims'],
  ['no_unverified_outcome_claim', 'No unverified business-outcome claims'],
];
export function ConstraintEditor({ value, onChange }) {
  const phrases = value.map((rule, index) => ({ rule, index })).filter(({ rule }) => !toggles.some(([type]) => type === rule.constraint_type));
  return <fieldset className="marketing-fieldset"><legend>Structured constraints</legend>
    <p>These mandatory human rules apply to this asset and its future revision path. Freeform notes remain separate.</p>
    {phrases.map(({ rule, index }, number) => <div key={index}>
      <label className="form-field"><span>{rule.constraint_type === 'prohibited_phrase' ? 'Prohibited phrase' : rule.constraint_type.replaceAll('_', ' ')} {number + 1}</span><input required maxLength="240" value={rule.value} onChange={e => onChange(value.map((v, i) => i === index ? { ...v, value: e.target.value } : v))} /></label>
      <button type="button" className="btn-secondary" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove phrase {number + 1}</button>
    </div>)}
    <button type="button" className="btn-secondary" disabled={value.length >= 30} onClick={() => onChange([...value, { constraint_type: 'prohibited_phrase', value: '' }])}>Add prohibited phrase</button>
    <label className="form-field"><span>Add a rule for this work</span><select value="" disabled={value.length >= 30} onChange={e => { if (e.target.value) onChange([...value, { constraint_type: e.target.value, value: '' }]); }}><option value="">Choose rule type</option>{['human_instruction', 'prohibited_claim', 'required_phrase_or_concept', 'required_destination', 'approved_destination'].map(type => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
    {toggles.map(([type, text]) => <label key={type}><input type="checkbox" checked={value.some(v => v.constraint_type === type)} onChange={e => onChange(e.target.checked ? [...value, { constraint_type: type }] : value.filter(v => v.constraint_type !== type))} /> {text}</label>)}
  </fieldset>;
}

export function ConstraintChecks({ checks = [] }) {
  if (!checks.length) return null;
  return <ul>{checks.map((q, i) => <li key={`${q.constraint_id}:${i}`}>
    {q.source_scope && <span>{q.source_scope} rule · </span>}<strong>{!q.passed ? 'Human constraint failed' : q.review_required ? 'Semantic review recommended' : 'Deterministic check passed'}</strong>: {q.detail}
    {q.matched_text && <p>Detected: “{q.matched_text}”{q.normalized_offset ? ` · Normalized text position ${q.normalized_offset}` : ''}</p>}
    {q.excerpt && <blockquote>{q.excerpt}</blockquote>}
  </li>)}</ul>;
}

export function ActiveConstraints({ data, assetId, orchestrationId }) {
  const campaignId = data.assets?.find(a => a.id === assetId)?.campaign_id || data.orchestrations?.find(o => o.id === orchestrationId)?.campaign_id;
  const sets = [
    ...(data.policy_versions || []).filter(s => !s.superseded && (!s.campaign_id || s.campaign_id === campaignId)).map(s => ({ ...s, scope: s.campaign_id ? 'Campaign policy' : 'Workspace policy' })),
    ...(data.human_constraint_sets || []).filter(s => !s.superseded && (s.asset_id === assetId || orchestrationId && s.orchestration_id === orchestrationId)).map(s => ({ ...s, scope: 'This review' })),
  ];
  return <section><h4>Effective Marketing Policy</h4>
    <p>{['Workspace policy', 'Campaign policy', 'This review'].map(scope => `${scope}: ${sets.filter(s => s.scope === scope).reduce((n, s) => n + s.constraints.length, 0)} rules`).join(' · ')}</p>
    <details><summary>View effective policy</summary>{!sets.some(s => s.constraints.length) && <p>No active structured constraints.</p>}
    {sets.map(s => <div key={s.id}><p>{s.scope} · Version {s.id} · Recorded by {s.created_by} · {new Date(s.created_at).toLocaleString()}</p>
      <ul>{s.constraints.map(c => <li key={c.id}>{c.constraint_type.replaceAll('_', ' ')}{c.value ? `: ${c.value}` : ''}{c.rationale ? ` — ${c.rationale}` : ''}</li>)}</ul>
    </div>)}</details>
  </section>;
}

export function ConstraintManager({ data, asset, onRefresh }) {
  const current = (data.human_constraint_sets || []).find(s => s.asset_id === asset.id && !s.superseded);
  const [value, setValue] = useState(() => (current?.constraints || []).map(rule => Object.fromEntries(Object.entries(rule).filter(([key]) => key !== 'id'))));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const checks = data.asset_constraint_checks?.find(a => a.asset_id === asset.id && a.revision === asset.revision)?.checks;
  const canWrite = ['contributor', 'approver', 'admin'].includes(data.role) && asset.publication_state === 'unpublished' && ['draft', 'changes_requested'].includes(asset.approval_state);
  return <section>
    <ActiveConstraints data={data} assetId={asset.id} />
    <ConstraintChecks checks={checks} />
    {canWrite && <details><summary>Edit structured constraints</summary><form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await saveMarketingHumanConstraints(data.workspace.id, asset, current?.id || null, value); await onRefresh(); }
      catch (err) { setError(err.message); } finally { setBusy(false); }
    }}><fieldset className="marketing-fieldset" disabled={busy}><ConstraintEditor value={value} onChange={setValue} /><button type="submit" className="btn-primary">Save structured constraints</button></fieldset></form></details>}
    {error && <p role="alert" className="marketing-error">{error}</p>}
    <details><summary>Constraint history</summary>{(data.human_constraint_sets || []).filter(s => s.asset_id === asset.id).map(s => <article key={s.id}><p>{s.superseded ? 'Superseded' : 'Current'} · {s.created_by} · {new Date(s.created_at).toLocaleString()} · Source review {s.source_decision_id || 'Asset edit'}</p><ul>{s.constraints.map(c => <li key={c.id}>{c.constraint_type.replaceAll('_', ' ')}: {c.value || 'Enabled'}</li>)}</ul></article>)}</details>
  </section>;
}
