import { useEffect, useRef, useState } from "react";
import { learnerClient } from "../lib/learnerClient";
import { coachingCall } from "../lib/coachingRecords";
import { coachingTargets, competencyVersion } from "../data/coachingTargets";
const findings = ["supports", "does_not_yet_support", "insufficient_opportunity", "technical_failure", "disputed"];
function EvidenceForm({ scopeId, correction, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({ competency_version: competencyVersion,
    competency_code: correction?.competency_code || "C01", source_type: correction?.source_type || "ai_practice",
    evidence: correction ? { kind: correction.evidence.kind, id: correction.evidence.id, revision: correction.evidence.revision } : { kind: "attempt", id: "", revision: 2 },
    observed_behavior: correction?.observed_behavior || "", finding: correction?.finding || "insufficient_opportunity",
    evidence_date: correction?.evidence_date || "", supersedes_id: correction?.id || "", correction_reason: "" }));
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  async function save(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const submission = pending || { p_id: crypto.randomUUID(), p_scope: scopeId, p_body: form };
      setPending(submission);
      await coachingCall(learnerClient, "publish_competency_evidence", submission);
      onSaved();
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form className="card" onSubmit={save}>
    <h3>{correction ? "Correct finding with a new revision" : "Record human-reviewed evidence"}</h3>
    <p>Use one exact source ID and revision from practice history or coaching above. Review that version before publishing. Write a concise observation, never paste AI feedback, transcripts, recordings, private notes or personal details.</p>
    <fieldset disabled={busy || !!pending}>
      <label>Competency — {competencyVersion} (draft)
        <select value={form.competency_code} onChange={e => update("competency_code", e.target.value)}>
          {coachingTargets.map(t => <option key={t.id} value={t.id}>{t.id} · {t.label || t.name}</option>)}
        </select>
      </label>
      <label>Source type<select value={form.source_type} onChange={e => { update("source_type", e.target.value); update("evidence", { kind: e.target.value === "human_coaching" ? "coaching" : "attempt", id: "", revision: 1 }); }}>
        <option value="ai_practice">AI practice context — supporting evidence only</option>
        <option value="human_coaching">Human coaching — exact completed session</option>
        <option disabled value="real_world_work">Real-world work — no governed source available</option>
      </select></label>
      <label>Record kind<select value={form.evidence.kind} onChange={e => update("evidence", { ...form.evidence, kind: e.target.value, id: "" })}>
        {form.source_type === "human_coaching" ? <option value="coaching">Coaching</option> : <><option value="attempt">Training attempt (written or simulation)</option><option value="simulation">Simulation session</option></>}
      </select></label>
      <label>Exact source record UUID<input required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={form.evidence.id} onChange={e => update("evidence", { ...form.evidence, id: e.target.value })} /></label>
      <label>Source revision<input type="number" required min="1" step="1" value={form.evidence.revision} onChange={e => update("evidence", { ...form.evidence, revision: Number(e.target.value) })} /></label>
      <label>Observed behavior summary<textarea required maxLength={1500} value={form.observed_behavior} onChange={e => update("observed_behavior", e.target.value)} /></label>
      <label>Finding (not a proficiency score)<select value={form.finding} onChange={e => update("finding", e.target.value)}>{findings.map(f => <option key={f}>{f}</option>)}</select></label>
      <label>Evidence date (UTC calendar date)<input type="date" required value={form.evidence_date} onChange={e => update("evidence_date", e.target.value)} /></label>
      {correction && <label>Correction reason<textarea required maxLength={500} value={form.correction_reason} onChange={e => update("correction_reason", e.target.value)} /></label>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{pending ? "Retry identical submission" : "Publish human finding"}</button>
    <button type="button" disabled={busy} onClick={onCancel}>Cancel / check history before changing a failed request</button>
  </form>;
}
export default function CompetencyEvidencePanel({ scopeId = null }) {
  const [refreshId, setRefreshId] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const key = JSON.stringify([scopeId, cursor, refreshId]);
  const refresh = () => setRefreshId(n => n + 1);
  useEffect(() => {
    let live = true;
    coachingCall(learnerClient, "read_competency_evidence", { p_scope: scopeId, p_before: cursor?.created_at || null, p_before_id: cursor?.id || null })
      .then(data => { if (live) setResult({ key, data: { ...data, records: data.records.slice(0, 50), hasMore: data.records.length > 50 } }); })
      .catch(error => { if (live) setResult({ key, error: error.message }); });
    return () => { live = false; };
  }, [key, scopeId, cursor]);
  useEffect(() => {
    const reload = () => setRefreshId(n => n + 1);
    const timer = setInterval(reload, 30000); window.addEventListener("focus", reload);
    return () => { clearInterval(timer); window.removeEventListener("focus", reload); };
  }, []);
  const fresh = result?.key === key;
  const data = result?.data;
  return <section className="card">
    <h2>{scopeId ? "Episode competency evidence" : "My competency evidence"}</h2>
    <p>Human findings about one observation. AI practice remains supporting evidence only; no proficiency bands, progression levels or employee rankings. Technical failure, insufficient opportunity and disputed are unscored states.</p>
    <button onClick={refresh}>Refresh evidence and access</button>
    {!fresh && <p role="status">Checking evidence access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!fresh || !data}>
      {data && <p>Person {data.person_id} · Employment episode {data.employment_episode_id}</p>}
      {data?.can_create && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record: null })}>Record competency evidence</button>}
      {draft && <EvidenceForm key={draft.key} scopeId={scopeId} correction={draft.record} onCancel={() => { setDraft(null); refresh(); }} onSaved={() => { setDraft(null); setCursor(null); refresh(); }} />}
      {data?.records.length === 0 && <p>No competency evidence on this page.</p>}
      {data?.records.map(r => <article className="card" key={r.id}>
        <h3>{r.competency_code} · {r.finding} · revision {r.revision}{r.superseded_by ? " — superseded" : " — current"}</h3>
        <p>{r.competency_version} · Reviewer {r.reviewer_user_id} · Evidence date {r.evidence_date} · Published {new Date(r.created_at).toLocaleString()}</p>
        <p>{r.observed_behavior}</p>
        <p>{r.source_type} · {r.evidence.kind} {r.evidence.id} · source revision {r.evidence.revision} · {r.evidence.status}</p>
        <p>Source {r.evidence.source_system}/{r.evidence.source_entity} · {r.evidence.source_environment}/{r.evidence.source_project}</p>
        {r.source_type === "ai_practice" && <p>AI practice context includes written exercises; this finding does not imply an AI assessment exists or is verified.</p>}
        {r.source_superseded_by && <p>Source coaching was corrected by {r.source_superseded_by}. This finding retains the reviewed version and requires human reconsideration.</p>}
        <p>Evidence record {r.id}</p>
        {r.supersedes_id && <p>Corrects {r.supersedes_id}: {r.correction_reason}</p>}
        {r.superseded_by && <p>Replaced by {r.superseded_by}</p>}
        {r.can_correct && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record: r })}>Correct finding</button>}
      </article>)}
      {cursor && <button onClick={() => setCursor(null)}>Newest evidence</button>}
      {data?.hasMore && <button onClick={() => { const last = data.records.at(-1); setCursor({ created_at: last.created_at, id: last.id }); }}>Older evidence</button>}
    </div>
  </section>;
}
