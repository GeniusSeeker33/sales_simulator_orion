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
  return <form className="card" onSubmit={save}>
    <h3>{correction ? "Correct latest progression decision" : "Human progression review"}</h3>
    <p>Decision baseline {baseline}; official level when opened {snapshot.current_level}. History reference {snapshot.current_history_id}. The server rejects a changed history reference.</p>
    {correction && <p>A correction reconsiders the original baseline. Replacing an advancement with remain/defer retracts that advancement through a new correction event; it is not a disciplinary decision. Earlier history remains visible.</p>}
    <p><a href="https://github.com/GeniusSeeker33/geniusseeker-talent-success-platform/blob/8326efd1940509dd15510a474a57299f18e6ab76/data/training-levels/orion-l1-l5.md" target="_blank" rel="noreferrer">Read the pinned framework, competency minima, evidence coverage and human approval requirements</a></p>
    <fieldset disabled={busy || !!pending}>
      <label>Current band review UUID and revision, one per line<textarea rows={5} value={bands} onChange={e => setBands(e.target.value)} /></label>
      <p>Use reviews above for this episode/version. Advancement needs one non-deferred review for each C01–C15 plus human confirmation of all target-level requirements. This is no automatic qualification or promotion.</p>
      <label>Optional supporting human-reviewed competency evidence UUID and revision, one per line<textarea value={supporting} onChange={e => setSupporting(e.target.value)} /></label>
      <p>No direct AI/practice/coaching IDs or artifact links. Missing opportunity, disputed evidence and technical failure never automatically count against the learner.</p>
      <label>Explicit human outcome<select required value={outcome} onChange={e => setOutcome(e.target.value)}>
        <option value="">Choose remain, adjacent advancement, or defer</option>
        {progressionOutcomes(baseline).map(o => <option key={o}>{o}</option>)}
      </select></label>
      <label>Required rationale<textarea required maxLength={2000} value={rationale} onChange={e => setRationale(e.target.value)} /></label>
      <label>Development priorities / next-step plan{!advances && " (required)"}<textarea required={!advances} maxLength={2000} value={plan} onChange={e => setPlan(e.target.value)} /></label>
      <label><input type="checkbox" required={advances} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have verified the framework's target minima, contextual/work evidence, required human approvals and any prospective specialty requirements. Required for advancement; no AI score or count substitutes for this review.</label>
      {correction && <label>Correction reason<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      <p>Use concise learner-visible rationale, not copied coaching narratives, transcripts, recordings, AI feedback or private artifacts.</p>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{pending ? "Retry identical submission" : "Publish human progression decision"}</button>
    <button type="button" disabled={busy} onClick={onCancel}>Cancel / check history before changing a failed request</button>
  </form>;
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
  return <section className="card">
    <h2>{scopeId ? "Episode progression and official level history" : "My progression and official level history"}</h2>
    <p>Explicit human development decisions. No automatic promotion, discipline, compensation or employee ranking.</p>
    <button onClick={refresh}>Refresh progression and access</button>
    {!fresh && <p role="status">Checking progression access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!fresh || !data}>
      {data && <p>Person {data.person_id} · Employment episode {data.employment_episode_id} · Official level: {data.current_level || "Unavailable — verified initial confirmation required"} · {progressionVersion}</p>}
      {data?.initial_confirmation && <article className="card"><h3>Initial human confirmation: {data.initial_confirmation.level}</h3><p>{data.initial_confirmation.rationale}</p><p>Approved by {data.initial_confirmation.approved_by} · Recorded {new Date(data.initial_confirmation.created_at).toLocaleString()} · History {data.initial_confirmation.id}</p></article>}
      {data?.can_create && !draft && <button onClick={() => open(null)}>Review progression</button>}
      {draft && <ProgressionForm key={draft.key} scopeId={scopeId} snapshot={draft.snapshot} correction={draft.record} onCancel={() => { setDraft(null); refresh(); }} onSaved={() => { setDraft(null); setCursor(null); refresh(); }} />}
      {data?.records.length === 0 && <p>No progression reviews on this page.</p>}
      {data?.records.map(r => <article className="card" key={r.id}>
        <h3>{r.outcome} · revision {r.revision}{r.superseded_by ? " — superseded" : ""}</h3>
        <p>Baseline {r.current_level} · {r.framework_version} · Reviewer {r.reviewer_user_id} · Reviewed {new Date(r.reviewed_at).toLocaleString()} · Recorded {new Date(r.created_at).toLocaleString()}</p>
        <p>{r.rationale}</p><p>Development plan: {r.development_plan || "Not specified for advancement"}</p>
        <ul>{r.bands.map(e => <li key={e.id}>{e.competency_code} · {e.outcome} · Band review {e.id}, revision {e.revision}{e.superseded_by && <> · Corrected by {e.superseded_by}; human reconsideration required.</>}</li>)}</ul>
        <ul>{r.supporting_evidence.map(e => <li key={e.id}>Supporting human evidence {e.id}, revision {e.revision} · {e.finding}{e.superseded_by && <> · Corrected by {e.superseded_by}; human reconsideration required.</>}</li>)}</ul>
        {r.level_event ? <p>Official history event: {r.level_event.event_kind} → {r.level_event.level} · {r.level_event.id} · Previous {r.level_event.previous_history_id} · Recorded {new Date(r.level_event.created_at).toLocaleString()}</p> : <p>No level-history change.</p>}
        <p>Review {r.id} · Starting history {r.from_history_id}</p>
        {r.supersedes_id && <p>Corrects {r.supersedes_id}: {r.correction_reason}</p>}
        {r.superseded_by && <p>Replaced by {r.superseded_by}</p>}
        {r.can_correct && !draft && <button onClick={() => open(r)}>Correct latest decision</button>}
      </article>)}
      {cursor && <button onClick={() => setCursor(null)}>Newest decisions</button>}
      {data?.hasMore && <button onClick={() => setCursor(data.records.at(-1).sequence_no)}>Older decisions and level events</button>}
    </div>
  </section>;
}
