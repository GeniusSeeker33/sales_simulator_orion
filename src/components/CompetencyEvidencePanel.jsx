import { useReviewReport } from "./review/reviewReport";
import { Badge, TechnicalDetails, RecentRecords, FormCard } from "./review/ReviewPrimitives";
import EvidencePicker from "./review/EvidencePicker";
import { friendly } from "../lib/reviewPresentation";
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
      if (!form.evidence.id) throw new Error("Choose an evidence record.");
      const submission = pending || { p_id: crypto.randomUUID(), p_scope: scopeId, p_body: form };
      setPending(submission);
      await coachingCall(learnerClient, "publish_competency_evidence", submission);
      onSaved();
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <FormCard onSubmit={save}>
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
      <EvidencePicker key={form.source_type} scopeId={scopeId} source={form.source_type === "human_coaching" ? "coaching" : "practice"} single
        selected={form.evidence.id ? [form.evidence] : []} onChange={refs => update("evidence", refs[0] || {kind: form.source_type === "human_coaching" ? "coaching" : "attempt", id: "", revision: 1})} />
      <label>Observed behavior summary *<textarea aria-required="true" required maxLength={1500} value={form.observed_behavior} onChange={e => update("observed_behavior", e.target.value)} /></label>
      <label>Finding (not a proficiency score)<select value={form.finding} onChange={e => update("finding", e.target.value)}>{findings.map(f => <option key={f} value={f}>{friendly(f)}</option>)}</select></label>
      <label>Evidence date (UTC calendar date)<input type="date" required value={form.evidence_date} onChange={e => update("evidence_date", e.target.value)} /></label>
      {correction && <label>Correction reason *<textarea aria-required="true" required maxLength={500} value={form.correction_reason} onChange={e => update("correction_reason", e.target.value)} /></label>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{pending ? "Retry identical submission" : "Publish human finding"}</button>
    <button type="button" disabled={busy} onClick={onCancel}>Cancel / check history</button>
  </FormCard>;
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
  useReviewReport("evidence", fresh ? data : null);
  return <section className="card review-section" id="review-evidence">
    <h2>{scopeId ? "Competency Evidence" : "My competency evidence"}</h2>
    <p>Human findings about one observation. AI practice remains supporting evidence only; no proficiency bands, progression levels or employee rankings. Technical failure, insufficient opportunity and disputed are unscored states.</p>
    <button onClick={refresh}>Refresh evidence and access</button>
    {!fresh && <p role="status">Checking evidence access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!fresh || !data}>
      {data && <TechnicalDetails record={{ person_id: data.person_id, employment_episode_id: data.employment_episode_id }} />}
      {data?.can_create && !draft && <button data-create className="review-primary" onClick={() => setDraft({ key: crypto.randomUUID(), record: null })}>Record Competency Evidence</button>}
      {draft && <EvidenceForm key={draft.key} scopeId={scopeId} correction={draft.record} onCancel={() => { setDraft(null); refresh(); }} onSaved={() => { setDraft(null); setCursor(null); refresh(); }} />}
      {data?.records.length === 0 && <p>No competency evidence on this page.</p>}
      <RecentRecords records={data?.records}>{r => <article className="card" key={r.id}>
        <h3>{r.competency_code} · <Badge value={r.finding}/></h3><p>{r.evidence_date} · {friendly(r.source_type)} · Revision {r.revision}</p>
        <p>{r.observed_behavior}</p>{r.source_type === "ai_practice" && <p>AI practice — supporting evidence only; this finding does not verify an AI assessment.</p>}
        {r.source_superseded_by && <p role="status">Source coaching was corrected. Human reconsideration is required.</p>}
        {r.supersedes_id && <p>Correction: {r.correction_reason}</p>}{r.superseded_by && <Badge value="superseded"/>}
        <TechnicalDetails record={r}/>{r.can_correct && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record: r })}>Correct finding</button>}
      </article>}</RecentRecords>
      {cursor && <button onClick={() => setCursor(null)}>Newest evidence</button>}
      {data?.hasMore && <button onClick={() => { const last = data.records.at(-1); setCursor({ created_at: last.created_at, id: last.id }); }}>Older evidence</button>}
    </div>
  </section>;
}
