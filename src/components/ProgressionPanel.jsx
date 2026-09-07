import { useReviewReport } from "./review/reviewReport";
import { Badge, TechnicalDetails, RecentRecords, FormCard } from "./review/ReviewPrimitives";
import EvidencePicker from "./review/EvidencePicker";
import { friendly } from "../lib/reviewPresentation";
import { useEffect, useRef, useState } from "react";
import { learnerClient } from "../lib/learnerClient";
import { coachingCall } from "../lib/coachingRecords";
import { progressionVersion, progressionOutcomes, parseProgressionRefs, initialProgressionOutcome } from "../lib/progressionReviews";
const refsText = refs => (refs || []).map(e => `${e.id} ${e.revision}`).join("\n");
function ProgressionForm({ scopeId, snapshot, correction, onSaved, onCancel }) {
  const [outcome, setOutcome] = useState(initialProgressionOutcome);
  const [bands, setBands] = useState(refsText(correction?.bands));
  const [supporting, setSupporting] = useState(refsText(correction?.supporting_evidence));
  const [rationale, setRationale] = useState(correction?.rationale || "");
  const [plan, setPlan] = useState(correction?.development_plan || "");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const baseline = correction?.current_level || snapshot.current_level;
  const advances = outcome.startsWith("advance_");
  async function save(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let submission = pending;
      if (!submission) {
        if (!progressionOutcomes(baseline).includes(outcome)) throw new Error("Explicitly choose a progression outcome.");
        submission = { p_id: crypto.randomUUID(), p_scope: scopeId, p_body: {
          framework_version: progressionVersion, competency_version: progressionVersion,
          expected_history_id: snapshot.current_history_id, outcome,
          bands: parseProgressionRefs(bands), supporting_evidence: parseProgressionRefs(supporting),
          rationale, development_plan: plan, framework_requirements_confirmed: confirmed,
          reviewed_at: new Date().toISOString(), supersedes_id: correction?.id || "", correction_reason: reason,
        } }; setPending(submission);
      }
      await coachingCall(learnerClient, "publish_progression_review", submission); onSaved();
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <FormCard onSubmit={save}>
    <h3>{correction ? "Correct latest progression decision" : "Human progression review"}</h3>
    <p>Decision baseline {baseline}; official level when opened {snapshot.current_level}.  The server rejects a changed history reference.</p>
    {correction && <p>A correction reconsiders the original baseline. Replacing an advancement with remain/defer retracts that advancement through a new correction event; it is not a disciplinary decision. Earlier history remains visible.</p>}
    <p><a href="https://github.com/GeniusSeeker33/geniusseeker-talent-success-platform/blob/8326efd1940509dd15510a474a57299f18e6ab76/data/training-levels/orion-l1-l5.md" target="_blank" rel="noreferrer">Read the pinned framework, competency minima, evidence coverage and human approval requirements</a></p>
    <fieldset disabled={busy || !!pending}>
      <EvidencePicker scopeId={scopeId} source="bands" selected={parseProgressionRefs(bands)} onChange={refs => setBands(refsText(refs))} />
      <p>Use reviews above for this episode/version. Advancement needs one non-deferred review for each C01–C15 plus human confirmation of all target-level requirements. This is no automatic qualification or promotion.</p>
      <details><summary>Optional supporting human-reviewed evidence</summary><EvidencePicker scopeId={scopeId} source="evidence" selected={parseProgressionRefs(supporting)} onChange={refs => setSupporting(refsText(refs))} /></details>
      <p>No direct AI/practice/coaching IDs or artifact links. Missing opportunity, disputed evidence and technical failure never automatically count against the learner.</p>
      <label>Explicit human outcome *<select required value={outcome} onChange={e => setOutcome(e.target.value)}>
        <option value="">Choose remain, adjacent advancement, or defer</option>
        {progressionOutcomes(baseline).map(o => <option key={o} value={o}>{friendly(o)}</option>)}
      </select></label>
      <label>Required rationale *<textarea aria-required="true" required maxLength={2000} value={rationale} onChange={e => setRationale(e.target.value)} /></label>
      <label>Development priorities / next-step plan{!advances && " (required)"} *<textarea aria-required="true" required={!advances} maxLength={2000} value={plan} onChange={e => setPlan(e.target.value)} /></label>
      <label><input type="checkbox" required={advances} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have verified the framework's target minima, contextual/work evidence, required human approvals and any prospective specialty requirements. Required for advancement; no AI score or count substitutes for this review.</label>
      {correction && <label>Correction reason *<textarea aria-required="true" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      <p>Use concise learner-visible rationale, not copied coaching narratives, transcripts, recordings, AI feedback or private artifacts.</p>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{pending ? "Retry identical submission" : "Publish human progression decision"}</button>
    <button type="button" disabled={busy} onClick={onCancel}>Cancel / check history</button>
  </FormCard>;
}
export default function ProgressionPanel({ scopeId = null }) {
  const [refreshId, setRefreshId] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const key = JSON.stringify([scopeId, cursor, refreshId]);
  const refresh = () => setRefreshId(n => n + 1);
  useEffect(() => {
    let live = true;
    coachingCall(learnerClient, "read_progression_reviews", { p_scope: scopeId, p_before: cursor })
      .then(data => { if (live) setResult({ key, data: { ...data, records: data.records.slice(0, 50), hasMore: data.records.length > 50 } }); })
      .catch(error => { if (live) setResult({ key, error: error.message }); });
    return () => { live = false; };
  }, [key, scopeId, cursor]);
  useEffect(() => {
    const reload = () => setRefreshId(n => n + 1);
    const timer = setInterval(reload, 30000); window.addEventListener("focus", reload);
    return () => { clearInterval(timer); window.removeEventListener("focus", reload); };
  }, []);
  const fresh = result?.key === key; const data = result?.data;
  const open = record => setDraft({ key: crypto.randomUUID(), record, snapshot: { current_level: data.current_level, current_history_id: data.current_history_id } });
  useReviewReport("progression", fresh ? data : null);
  return <section className="card review-section" id="review-progression">
    <h2>{scopeId ? "Progression" : "My progression and official level history"}</h2>
    <p>Explicit human development decisions. No automatic promotion, discipline, compensation or employee ranking.</p>
    <button onClick={refresh}>Refresh progression and access</button>
    {!fresh && <p role="status">Checking progression access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!fresh || !data}>
      {data && <p>Official level: {data.current_level || "Unavailable — verified initial confirmation required"} · {progressionVersion}</p>}
      {data?.initial_confirmation && <details><summary>View initial human confirmation · {data.initial_confirmation.level}</summary><p>{data.initial_confirmation.rationale}</p><TechnicalDetails record={data.initial_confirmation}/></details>}
      {data?.can_create && !draft && <button data-create className="review-primary" onClick={() => open(null)}>Review Progression</button>}
      {draft && <ProgressionForm key={draft.key} scopeId={scopeId} snapshot={draft.snapshot} correction={draft.record} onCancel={() => { setDraft(null); refresh(); }} onSaved={() => { setDraft(null); setCursor(null); refresh(); }} />}
      {data?.records.length === 0 && <p>No progression reviews on this page.</p>}
      <RecentRecords records={data?.records}>{r => <article className="card" key={r.id}>
        <h3><Badge value={r.outcome}/></h3><p>Reviewed {new Date(r.reviewed_at).toLocaleString()} · Baseline {r.current_level} · Revision {r.revision}</p>
        <p>{r.rationale}</p><p><strong>Next-step plan:</strong> {r.development_plan || "Not specified for advancement"}</p>
        <p>{r.bands.length} band reviews · {r.supporting_evidence.length} supporting evidence references</p>
        {[...r.bands,...r.supporting_evidence].some(e=>e.superseded_by) && <p role="status">Source reviews were corrected. Human reconsideration is required.</p>}
        {r.level_event ? <p>Official history: {friendly(r.level_event.event_kind)} → <Badge value={r.level_event.level}/></p> : <p>No level-history change.</p>}
        {r.supersedes_id && <p>Correction: {r.correction_reason}</p>}{r.superseded_by && <Badge value="superseded"/>}
        <TechnicalDetails record={r}/>{r.can_correct && !draft && <button onClick={() => open(r)}>Correct latest decision</button>}
      </article>}</RecentRecords>
      {cursor && <button onClick={() => setCursor(null)}>Newest decisions</button>}
      {data?.hasMore && <button onClick={() => setCursor(data.records.at(-1).sequence_no)}>Older decisions and level events</button>}
    </div>
  </section>;
}
