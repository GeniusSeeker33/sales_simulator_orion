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
const refKey = r => r.kind + ":" + r.id + ":" + r.revision;

function CoachingForm({ scopeId, evidence, correction, onSaved, onCancel }) {
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
  // Preserve references selected on older pages. Only terminal records are selectable.
  const options = [...evidence.flatMap(a => [
    ...(a.status !== "in_progress" ? [{ kind: "attempt", id: a.id, revision: a.revision, label: a.scenario_ref }] : []),
    ...(a.session && a.session.status !== "in_progress" ? [{ kind: "simulation", id: a.session.id, revision: a.session.revision, label: a.session.scenario_ref }] : []),
  ]), ...form.evidence.map(r => ({ ...r, label: "Selected reference" }))];
  const unique = [...new Map(options.map(r => [refKey(r), r])).values()];
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
  return <form className="card" onSubmit={save}>
    <h3>{correction ? "Publish a correction" : "Record completed coaching"}</h3>
    <p>Visible to this learner and authorized episode reviewers. Write concise observations; do not paste transcripts, recordings, private notes, or sensitive third-party details. No competency band or level is awarded.</p>
    <fieldset disabled={busy || !!pending}>
      <label>Occurred at (local time, or ISO timestamp with timezone)
        <input required value={form.occurred_at} placeholder="2026-09-05T14:00:00-04:00" onChange={e => update("occurred_at", e.target.value)} />
      </label>
      <fieldset><legend>Competency targets — {competencyVersion} (draft references)</legend>
        {coachingTargets.map(t => <label key={t.id} style={{ display: "block" }}>
          <input type="checkbox" checked={form.targets.includes(t.id)} onChange={e => update("targets", e.target.checked ? [...form.targets, t.id] : form.targets.filter(v => v !== t.id))} />
          {t.id} · {t.label}
        </label>)}
      </fieldset>
      <fieldset><legend>Evidence from the reviewer history page (1–20 references)</legend>
        {unique.length === 0 && <p>No terminal evidence on this page. Use the history page controls to find an attempt or simulation.</p>}
        {unique.map(r => <label key={refKey(r)} style={{ display: "block" }}>
          <input type="checkbox" checked={form.evidence.some(v => refKey(v) === refKey(r))} onChange={e => update("evidence",
            e.target.checked ? [...form.evidence, { kind: r.kind, id: r.id, revision: r.revision }] : form.evidence.filter(v => refKey(v) !== refKey(r)))} />
          {r.kind} · {r.label} · {r.id} · revision {r.revision}
        </label>)}
      </fieldset>
      {fields.map(([key, label]) => <label key={key} style={{ display: "block" }}>{label}
        <textarea required maxLength={1500} value={form[key]} onChange={e => update(key, e.target.value)} />
      </label>)}
      <label>Optional follow-up date <input type="date" value={form.follow_up_on} onChange={e => update("follow_up_on", e.target.value)} /></label>
      <label>Development progress (not a proficiency band)
        <select value={form.progress_status} onChange={e => update("progress_status", e.target.value)}>
          {progressStatuses.map(s => <option key={s}>{s}</option>)}
        </select>
      </label>
      {correction && <label>Correction reason
        <textarea required maxLength={500} value={form.correction_reason} onChange={e => update("correction_reason", e.target.value)} />
      </label>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy} type="submit">{busy ? "Saving…" : pending ? "Retry identical submission" : "Publish completed coaching"}</button>
    {pending && !busy && <button type="button" onClick={() => { setPending(null); setError("Refresh history to check whether the prior request saved before submitting changed content."); }}>Unlock after checking history</button>}
    <button disabled={busy} type="button" onClick={onCancel}>Cancel</button>
  </form>;
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
export default function CoachingPanel({ scopeId = null, evidence = [] }) {
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
  return <section className="card">
    <h2>{scopeId ? "Episode coaching" : "My coaching"}</h2>
    <button onClick={refresh}>Refresh coaching and access</button>
    {!fresh && <p role="status">Checking coaching access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!allowed}>
      {data && <p>Person {data.person_id} · Employment episode {data.employment_episode_id}</p>}
      {data?.can_create && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record: null })}>Record coaching</button>}
      {draft && <CoachingForm key={draft.key} scopeId={scopeId} evidence={evidence} correction={draft.record}
        onSaved={() => { setDraft(null); setCursor(null); refresh(); }} onCancel={() => setDraft(null)} />}
      {data?.records.length === 0 && <p>No coaching sessions in this page of your authorized episode.</p>}
      {data?.records.map(record => <article className="card" key={record.id}>
        <h3>Coaching revision {record.revision}{record.superseded_by ? " — superseded" : " — current"}</h3>
        <p>Coach {record.coach_user_id} · Occurred {date(record.occurred_at)} · Published {date(record.created_at)}</p>
        <p>{record.competency_version} · Targets {record.targets.join(", ")} · Progress: {record.progress_status}</p>
        {fields.map(([field, label]) => <p key={field}><strong>{label}: </strong>{record[field]}</p>)}
        <p>Follow-up: {record.follow_up_on || "Not set"} · Session {record.id}</p>
        {record.supersedes_id && <p>Corrects {record.supersedes_id}: {record.correction_reason}</p>}
        {record.superseded_by && <p>Replaced by {record.superseded_by}. Responses below apply only to this original version.</p>}
        <ul>{record.evidence.map(r => <li key={refKey(r)}>{r.kind} {r.id}, revision {r.revision} · {r.scenario_ref} · {r.status}
          {r.status === "technical_failure" ? " — unscored technical failure" : ""}</li>)}</ul>
        <p>Evidence references retain their source type; AI practice is supporting evidence only. Coaching does not approve a competency band or progression level.</p>
        {record.responses.map(r => <p key={r.id}>{date(r.created_at)} · {r.acknowledged_at ? "Receipt acknowledged (not agreement)" : "Learner comment"}
          {r.comment && <> · {r.comment}</>}</p>)}
        {scopeId && record.can_correct && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record })}>Correct with a new version</button>}
        {!scopeId && !record.superseded_by && <LearnerResponse record={record} onSaved={refresh} />}
      </article>)}
      {cursor && <button onClick={() => setCursor(null)}>Newest coaching</button>}
      {data?.hasMore && <button onClick={() => { const last = data.records.at(-1); setCursor({ created_at: last.created_at, id: last.id }); }}>Older coaching</button>}
    </div>
  </section>;
}
