import { useState } from 'react';
import { saveMarketingHumanConstraints } from '../../lib/marketing';

const toggles = [
  ['no_fabricated_testimonial', 'No fabricated testimonials'],
  ['no_unverified_comparative_claim', 'No unverified comparative claims'],
  ['no_unverified_outcome_claim', 'No unverified business-outcome claims'],
];
export function ConstraintEditor({ value, onChange }) {
  const phrases = value.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.constraint_type === 'prohibited_phrase');
  return <fieldset className="marketing-fieldset"><legend>Structured constraints</legend>
    <p>These mandatory human rules apply to this asset and its future revision path. Freeform notes remain separate.</p>
    {phrases.map(({ rule, index }, number) => <div key={index}>
      <label className="form-field"><span>Prohibited phrase {number + 1}</span><input required maxLength="240" value={rule.value} onChange={e => onChange(value.map((v, i) => i === index ? { ...v, value: e.target.value } : v))} /></label>
      <button type="button" className="btn-secondary" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove phrase {number + 1}</button>
    </div>)}
    <button type="button" className="btn-secondary" disabled={value.length >= 30} onClick={() => onChange([...value, { constraint_type: 'prohibited_phrase', value: '' }])}>Add prohibited phrase</button>
    {toggles.map(([type, text]) => <label key={type}><input type="checkbox" checked={value.some(v => v.constraint_type === type)} onChange={e => onChange(e.target.checked ? [...value, { constraint_type: type }] : value.filter(v => v.constraint_type !== type))} /> {text}</label>)}
  </fieldset>;
}

export function ConstraintChecks({ checks = [] }) {
  if (!checks.length) return null;
  return <ul>{checks.map((q, i) => <li key={`${q.constraint_id}:${i}`}>
    <strong>{!q.passed ? 'Human constraint failed' : q.review_required ? 'Semantic review recommended' : 'Deterministic check passed'}</strong>: {q.detail}
    {q.matched_text && <p>Detected: “{q.matched_text}”{q.normalized_offset ? ` · Normalized text position ${q.normalized_offset}` : ''}</p>}
    {q.excerpt && <blockquote>{q.excerpt}</blockquote>}
  </li>)}</ul>;
}

export function ActiveConstraints({ data, assetId, orchestrationId }) {
  const sets = (data.human_constraint_sets || []).filter(s => !s.superseded && (s.asset_id === assetId || orchestrationId && s.orchestration_id === orchestrationId));
  return <section><h4>Active structured human constraints</h4>
    {!sets.some(s => s.constraints.length) && <p>No active structured constraints.</p>}
    {sets.filter(s => s.constraints.length).map(s => <div key={s.id}><p>Recorded by {s.created_by} · Asset revision {s.source_revision} · {new Date(s.created_at).toLocaleString()}</p>
      <ul>{s.constraints.map(c => <li key={c.id}>{c.constraint_type.replaceAll('_', ' ')}{c.value ? `: ${c.value}` : ''}{c.rationale ? ` — ${c.rationale}` : ''}</li>)}</ul>
    </div>)}
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
