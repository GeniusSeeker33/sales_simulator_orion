import { useReviewReport } from "./review/reviewReport";
import { Badge, TechnicalDetails, RecentRecords, FormCard } from "./review/ReviewPrimitives";
import EvidencePicker from "./review/EvidencePicker";
import { friendly } from "../lib/reviewPresentation";
import { useEffect, useRef, useState } from "react";
import { learnerClient } from "../lib/learnerClient";
import { coachingCall, readCoaching, progressStatuses } from "../lib/coachingRecords";
import { coachingTargets, competencyVersion } from "../data/coachingTargets";
const fields = [
  ["observed_behavior", "Observed behavior"], ["strengths", "Strengths"],
  ["development_opportunity", "Development opportunity"], ["next_action", "Assigned practice / next action"],
];
const date = v => v ? new Date(v).toLocaleString() : "Not set";
const empty = () => ({ occurred_at: "", targets: [], evidence: [], observed_behavior: "", strengths: "",
  development_opportunity: "", next_action: "", follow_up_on: "", progress_status: "follow_up_pending",
  supersedes_id: "", correction_reason: "" });

function CoachingForm({ scopeId, correction, onSaved, onCancel }) {
  const [form, setForm] = useState(() => correction ? {
    ...empty(), ...Object.fromEntries(fields.map(([key]) => [key, correction[key]])),
    occurred_at: correction.occurred_at, targets: correction.targets,
    evidence: correction.evidence.map(({ kind, id, revision }) => ({ kind, id, revision })),
    follow_up_on: correction.follow_up_on || "", progress_status: correction.progress_status,
    supersedes_id: correction.id,
  } : empty());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const lock = useRef(false);
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let submission = pending;
      if (!submission) {
        const occurred = new Date(form.occurred_at);
        if (!Number.isFinite(occurred.getTime()) || !form.targets.length || !form.evidence.length) throw new Error("Add an occurrence time, competency targets, and exact evidence references.");
        submission = { p_id: crypto.randomUUID(), p_scope: scopeId, p_body: { ...form, occurred_at: occurred.toISOString() } };
        setPending(submission);
      }
      await coachingCall(learnerClient, "publish_coaching_session", submission);
      setPending(null); onSaved();
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <FormCard onSubmit={save}>
    <h3>{correction ? "Publish a correction" : "Record completed coaching"}</h3>
    <p>Visible to this learner and authorized episode reviewers. Write concise observations; do not paste transcripts, recordings, private notes, or sensitive third-party details. No competency band or level is awarded.</p>
    <fieldset disabled={busy || !!pending}>
      <label>Occurred at * (local time, or ISO timestamp with timezone)
        <input aria-required="true" required value={form.occurred_at} placeholder="2026-09-05T14:00:00-04:00" onChange={e => update("occurred_at", e.target.value)} />
      </label>
      <fieldset><legend>Competency targets * — {competencyVersion} (draft references)</legend>
        {coachingTargets.map(t => <label key={t.id} style={{ display: "block" }}>
          <input type="checkbox" checked={form.targets.includes(t.id)} onChange={e => update("targets", e.target.checked ? [...form.targets, t.id] : form.targets.filter(v => v !== t.id))} />
          {t.id} · {t.label}
        </label>)}
      </fieldset>
      <EvidencePicker scopeId={scopeId} source="practice" selected={form.evidence} onChange={refs => update("evidence", refs)} />
      {fields.map(([key, label]) => <label key={key} style={{ display: "block" }}>{label} *
        <textarea aria-required="true" required maxLength={1500} value={form[key]} onChange={e => update(key, e.target.value)} />
      </label>)}
      <label>Optional follow-up date <input type="date" value={form.follow_up_on} onChange={e => update("follow_up_on", e.target.value)} /></label>
      <label>Development progress (not a proficiency band)
        <select value={form.progress_status} onChange={e => update("progress_status", e.target.value)}>
          {progressStatuses.map(s => <option key={s} value={s}>{friendly(s)}</option>)}
        </select>
      </label>
      {correction && <label>Correction reason
        <textarea aria-required="true" required maxLength={500} value={form.correction_reason} onChange={e => update("correction_reason", e.target.value)} />
      </label>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy} type="submit">{busy ? "Saving…" : pending ? "Retry identical submission" : "Publish completed coaching"}</button>
    {pending && !busy && <button type="button" onClick={() => { setPending(null); setError("Refresh history to check whether the prior request saved before submitting changed content."); }}>Unlock after checking history</button>}
    <button disabled={busy} type="button" onClick={onCancel}>Cancel</button>
  </FormCard>;
}
function LearnerResponse({ record, onSaved }) {
  const [ack, setAck] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const lock = useRef(false);
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const submission = pending || { p_id: crypto.randomUUID(), p_session: record.id, p_ack: ack, p_comment: comment };
      setPending(submission);
      await coachingCall(learnerClient, "respond_to_coaching", submission);
      setPending(null); setAck(false); setComment(""); onSaved();
    } catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={save}>
    <p>Acknowledgment is receipt, not agreement. Comments are visible to authorized reviewers and append to this exact version.</p>
    <fieldset disabled={busy || !!pending}>
      <label><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I acknowledge receipt of revision {record.revision}</label>
      <label>Optional learner comment<textarea maxLength={1500} value={comment} onChange={e => setComment(e.target.value)} /></label>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy || (!ack && !comment.trim())}> {pending ? "Retry response" : "Save learner response"}</button>
  </form>;
}
export default function CoachingPanel({ scopeId = null }) {
  const [revision, setRevision] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const key = JSON.stringify([scopeId, cursor, revision]);
  useEffect(() => {
    let live = true;
    readCoaching(learnerClient, scopeId, cursor).then(data => { if (live) setResult({ key, data }); })
      .catch(error => { if (live) setResult({ key, error: error.message }); });
    return () => { live = false; };
  }, [scopeId, cursor, key]);
  useEffect(() => {
    const refresh = () => setRevision(n => n + 1);
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  // Keep draft mounted during refresh, but hide content until the fresh authorization succeeds.
  const data = result?.data;
  const fresh = result?.key === key;
  const allowed = fresh && !!data;
  const refresh = () => setRevision(n => n + 1);
  useReviewReport("coaching", fresh ? data : null);
  return <section className="card review-section" id="review-coaching">
    <h2>{scopeId ? "Coaching" : "My coaching"}</h2>
    <button onClick={refresh}>Refresh coaching and access</button>
    {!fresh && <p role="status">Checking coaching access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!allowed}>
      {data && <TechnicalDetails record={{ person_id: data.person_id, employment_episode_id: data.employment_episode_id }} />}
      {data?.can_create && !draft && <button data-create className="review-primary" onClick={() => setDraft({ key: crypto.randomUUID(), record: null })}>Record Coaching</button>}
      {draft && <CoachingForm key={draft.key} scopeId={scopeId} correction={draft.record}
        onSaved={() => { setDraft(null); setCursor(null); refresh(); }} onCancel={() => setDraft(null)} />}
      {data?.records.length === 0 && <p>No coaching sessions in this page of your authorized episode.</p>}
      <RecentRecords records={data?.records}>{record => <article className="card" key={record.id}>
        <h3>Coaching · {date(record.occurred_at)}</h3><Badge value={record.progress_status} />{record.superseded_by && <Badge value="superseded" />}
        <p>Competency targets: {record.targets.join(", ")} · Revision {record.revision}</p>
        <p><strong>Observed behavior:</strong> {record.observed_behavior}</p><p><strong>Next action:</strong> {record.next_action}</p>
        <p>Follow-up: {record.follow_up_on || "Not set"}</p>
        <details><summary>Read coaching details and learner responses</summary><p><strong>Strengths:</strong> {record.strengths}</p><p><strong>Development opportunity:</strong> {record.development_opportunity}</p>
          {record.responses.map(r => <p key={r.id}>{date(r.created_at)} · {r.acknowledged_at ? "Receipt acknowledged (not agreement)" : "Learner comment"}{r.comment && <> · {r.comment}</>}</p>)}
        </details>
        {record.supersedes_id && <p>Correction: {record.correction_reason}</p>}{record.superseded_by && <p>This version was replaced. Responses apply only to the original version.</p>}
        <TechnicalDetails record={record}/>
        {scopeId && record.can_correct && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record })}>Correct with a new version</button>}
        {!scopeId && !record.superseded_by && <LearnerResponse record={record} onSaved={refresh} />}
      </article>}</RecentRecords>
      {cursor && <button onClick={() => setCursor(null)}>Newest coaching</button>}
      {data?.hasMore && <button onClick={() => { const last = data.records.at(-1); setCursor({ created_at: last.created_at, id: last.id }); }}>Older coaching</button>}
    </div>
  </section>;
}
