import { useEffect, useRef, useState } from "react";
import { learnerClient } from "../lib/learnerClient";
import { coachingCall } from "../lib/coachingRecords";
import { coachingTargets, competencyVersion } from "../data/coachingTargets";
function BandForm({ scopeId, correction, onSaved, onCancel }) {
  const [code, setCode] = useState(correction?.competency_code || "C01");
  const [outcome, setOutcome] = useState(""); // Explicit choice on every publication, including corrections.
  const [rationale, setRationale] = useState(correction?.rationale || "");
  const [reason, setReason] = useState("");
  const [references, setReferences] = useState(correction?.evidence.map(e => `${e.id} ${e.revision}`).join("\n") || "");
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function save(event) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let submission = pending;
      if (!submission) {
        const evidence = references.trim() ? references.trim().split(/\n/).map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length !== 2 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[0]) || !/^[1-9][0-9]*$/.test(parts[1])) throw new Error("Enter one competency evidence UUID and positive revision per line.");
          return { id: parts[0], revision: Number(parts[1]) };
        }) : [];
        submission = { p_id: crypto.randomUUID(), p_scope: scopeId, p_body: { competency_version: competencyVersion,
          competency_code: code, outcome, evidence, rationale, reviewed_at: new Date().toISOString(),
          supersedes_id: correction?.id || "", correction_reason: reason } };
        setPending(submission);
      }
      await coachingCall(learnerClient, "publish_competency_band_review", submission);
      onSaved();
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form className="card" onSubmit={save}>
    <h3>{correction ? "Correct band review with a new revision" : "Human competency-band review"}</h3>
    <p>Review the current human-reviewed competency evidence above. Decide one competency only, using its versioned behavioral anchors. No score averaging or attempt-count threshold. Failure, disputed and insufficient opportunity are non-scored context, never default reasons for a lower band.</p>
    <p><a href="https://github.com/GeniusSeeker33/geniusseeker-talent-success-platform/blob/8326efd1940509dd15510a474a57299f18e6ab76/data/competency-models/orion-sales-competencies.md" target="_blank" rel="noreferrer">Read the pinned competency definitions and B1-B5 behavioral anchors</a></p>
    <fieldset disabled={busy || !!pending}>
      <label>Competency — {competencyVersion} (draft)
        <select disabled={!!correction} value={code} onChange={e => setCode(e.target.value)}>{coachingTargets.map(t => <option key={t.id} value={t.id}>{t.id} · {t.label}</option>)}</select>
      </label>
      <label>Exact human-reviewed evidence (one UUID and revision per line, maximum 50)
        <textarea rows={5} value={references} onChange={e => setReferences(e.target.value)} placeholder="00000000-0000-4000-8000-000000000001 1" />
      </label>
      <p>Only current evidence for this competency/version and episode is accepted. Leave references empty only to defer because no evidence exists. Raw attempt, simulation and coaching IDs are not accepted here.</p>
      <label>Explicit human outcome<select required value={outcome} onChange={e => setOutcome(e.target.value)}>
        <option value="">Choose a band or defer</option>{["B1", "B2", "B3", "B4", "B5"].map(b => <option key={b}>{b}</option>)}
        <option value="defer">Defer — insufficient evidence, no band assigned</option>
      </select></label>
      <label>Required rationale (visible to learner)<textarea required maxLength={2000} value={rationale} onChange={e => setRationale(e.target.value)} /></label>
      <p>Write the decision rationale, not copied coaching narrative, AI feedback, transcripts, recordings or private artifacts. Review time is recorded when you publish.</p>
      {correction && <label>Correction reason<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{pending ? "Retry identical submission" : "Publish human review"}</button>
    <button type="button" disabled={busy} onClick={onCancel}>Cancel / check history before changing a failed request</button>
  </form>;
}
export default function CompetencyBandPanel({ scopeId = null }) {
  const [refreshId, setRefreshId] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const key = JSON.stringify([scopeId, cursor, refreshId]);
  const refresh = () => setRefreshId(n => n + 1);
  useEffect(() => {
    let live = true;
    coachingCall(learnerClient, "read_competency_band_reviews", { p_scope: scopeId, p_before: cursor?.created_at || null, p_before_id: cursor?.id || null })
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
    <h2>{scopeId ? "Episode band-review history" : "My band-review history"}</h2>
    <p>Individual human reviews, not an aggregate competency profile. No L1–L5, promotion, discipline or compensation changes. Defer assigns no band.</p>
    <button onClick={refresh}>Refresh reviews and access</button>
    {!fresh && <p role="status">Checking band-review access…</p>}
    {fresh && result.error && <p role="alert">{result.error}</p>}
    <div hidden={!fresh || !data}>
      {data && <p>Person {data.person_id} · Employment episode {data.employment_episode_id}</p>}
      {data?.can_create && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record: null })}>Review one competency</button>}
      {draft && <BandForm key={draft.key} scopeId={scopeId} correction={draft.record} onCancel={() => { setDraft(null); refresh(); }} onSaved={() => { setDraft(null); setCursor(null); refresh(); }} />}
      {data?.records.length === 0 && <p>No band reviews on this page.</p>}
      {data?.records.map(r => <article className="card" key={r.id}>
        <h3>{r.competency_code} · {r.outcome === "defer" ? "Defer — insufficient evidence, no band assigned" : r.outcome} · revision {r.revision}{r.superseded_by ? " — superseded" : " — unsuperseded review"}</h3>
        <p>{r.competency_version} · Reviewer {r.reviewer_user_id} · Reviewed {new Date(r.reviewed_at).toLocaleString()} · Recorded {new Date(r.created_at).toLocaleString()} · {r.status}</p>
        <p>{r.rationale}</p>
        <ul>{r.evidence.map(e => <li key={e.id}>Evidence {e.id} · revision {e.revision} · {e.finding} · {e.source_type}
          {e.superseded_by && <> · Evidence corrected by {e.superseded_by}; human reconsideration required, original decision retained.</>}</li>)}</ul>
        {!r.evidence.length && <p>No evidence was available for this deferred review.</p>}
        <p>Review {r.id}</p>
        {r.supersedes_id && <p>Corrects {r.supersedes_id}: {r.correction_reason}</p>}
        {r.superseded_by && <p>Replaced by {r.superseded_by}</p>}
        {r.can_correct && !draft && <button onClick={() => setDraft({ key: crypto.randomUUID(), record: r })}>Correct review</button>}
      </article>)}
      {cursor && <button onClick={() => setCursor(null)}>Newest reviews</button>}
      {data?.hasMore && <button onClick={() => { const last = data.records.at(-1); setCursor({ created_at: last.created_at, id: last.id }); }}>Older reviews</button>}
    </div>
  </section>;
}
