import { useEffect, useState } from 'react';
import { learnerClient } from '../../lib/learnerClient';
import { coachingCall } from '../../lib/coachingRecords';
import { exactReference, referenceKey, friendly } from '../../lib/reviewPresentation';
import { competencyVersion, coachingTargets } from '../../data/coachingTargets';
import { TechnicalDetails, Badge } from './ReviewPrimitives';
const rpc = { practice: 'read_reviewer_history', coaching: 'read_coaching_sessions', evidence: 'read_competency_evidence', bands: 'read_competency_band_reviews' };
export default function EvidencePicker({ scopeId, source, competency, selected, onChange, single = false }) {
  const [page, setPage] = useState(null);
  const [result, setResult] = useState(null);
  const key = JSON.stringify([scopeId, source, page, competency]);
  useEffect(() => {
    let live = true;
    const args = source === 'practice' ? { p_scope_id: scopeId, p_before: page?.started_at || null, p_before_id: page?.id || null } : { p_scope: scopeId, p_before: page?.created_at || null, p_before_id: page?.id || null };
    coachingCall(learnerClient, rpc[source], args).then(data => { if(live) setResult({key,data}); }).catch(e => { if(live) setResult({key,error:e.message}); });
    return () => {live=false;};
  }, [key, scopeId, source, page]);
  const fresh = result?.key === key;
  const records = fresh ? result?.data?.records?.slice(0,50) || [] : [];
  const options = source === 'practice' ? records.flatMap(r => [
    ...(r.status !== 'in_progress' ? [{...r, kind:'attempt'}] : []),
    ...(r.session && r.session.status !== 'in_progress' ? [{...r.session, kind:'simulation'}] : []),
  ]) : records.filter(r => !r.superseded_by && (!competency || r.competency_code === competency) && (!['evidence','bands'].includes(source) || r.competency_version === competencyVersion)).map(r => ({...r, ...(source === 'coaching' ? {kind:'coaching'} : {})}));
  const change = r => {
    const has = selected.some(s=>referenceKey(s)===referenceKey(r));
    onChange(has ? selected.filter(s=>referenceKey(s)!==referenceKey(r)) : single ? [exactReference(r)] : [...selected,exactReference(r)]);
  };
  return <fieldset className="review-picker"><legend>{single ? 'Choose one exact evidence record *' : 'Select current evidence records'}</legend>
    <p>Exact IDs and revisions are submitted automatically. The server rechecks access and source currency at publication. Non-scored states are context, not low proficiency.</p>
    {!fresh && <p role="status">Loading evidence…</p>}{fresh && result.error && <p role="alert">{result.error}</p>}
    {fresh && !result.error && !options.length && <p>No matching current records on this page. Load more or refresh the source history.</p>}
    {[...new Map(options.map(r=>[referenceKey(r),r])).values()].map(r=><div className="review-evidence-option" key={referenceKey(r)}><label><input type="checkbox" checked={selected.some(s=>referenceKey(s)===referenceKey(r))} onChange={()=>change(r)} />
      <span><strong>{r.competency_code ? `${r.competency_code} ${coachingTargets.find(t=>t.id===r.competency_code)?.label || ''}` : friendly(r.scenario_ref || 'Coaching session')} · {friendly(r.kind || source)}</strong><br/>{r.evidence_date || new Date(r.occurred_at || r.reviewed_at || r.started_at || r.created_at).toLocaleString()}<br/><Badge value={r.finding || r.outcome || r.progress_status || r.status}/>{source==='practice' && <Badge value={r.status === 'technical_failure' ? 'unscored' : r.assessment_status || 'unscored'}/>}{source === 'practice' && r.status === 'completed' && r.assessment_status === 'ai_unreviewed' && typeof r.ai_overall === 'number' && <span> · AI practice {r.ai_overall}/100 — supporting evidence</span>}</span></label>{(r.observed_behavior || r.rationale) && <p>{r.observed_behavior || r.rationale}</p>}<TechnicalDetails record={exactReference(r)}/></div>)}
    {selected.length > 0 && <details><summary>Selected references ({selected.length}) · remove or inspect</summary>{selected.map(r=><div key={referenceKey(r)}><TechnicalDetails record={r}/><button type="button" onClick={()=>onChange(selected.filter(s=>referenceKey(s)!==referenceKey(r)))}>Remove reference</button></div>)}</details>}
    {page && <button type="button" onClick={()=>setPage(null)}>Newest evidence</button>}
    {fresh && result?.data?.records?.length > 50 && <button type="button" onClick={()=>setPage(records.at(-1))}>Load more evidence</button>}
  </fieldset>;
}
