import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { learnerClient } from "../lib/learnerClient";
import { fetchReviewerHistory, reviewAssessmentLabel } from "../lib/reviewerHistory";

const date = value => value ? new Date(value).toLocaleString() : "Not ended";
export default function ReviewerHistory() {
  const [scopeId, setScopeId] = useState("");
  const [cursor, setCursor] = useState(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = JSON.stringify([scopeId, cursor, revision]);
  useEffect(() => {
    let live = true;
    fetchReviewerHistory(learnerClient, scopeId || null, cursor)
      .then(data => { if (live) setResult({ key: requestKey, data }); })
      .catch(error => { if (live) setResult({ key: requestKey, error: error.message }); });
    return () => { live = false; };
  }, [scopeId, cursor, requestKey]);
  useEffect(() => {
    const refresh = () => setRevision(n => n + 1);
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const current = result?.key === requestKey ? result : null;
  const data = current?.data;
  const selected = data?.scopes.find(scope => scope.id === scopeId);
  return <Layout title="Assigned learner history">
    <section className="card">
      <h2>Manager / coach read access</h2>
      <p>Only explicitly approved learner episodes are available. AI feedback is unreviewed supporting evidence, not competency approval or progression. Legacy browser records are excluded.</p>
      <button onClick={() => setRevision(n => n + 1)}>Refresh access and history</button>
      <button onClick={() => { setScopeId(""); setCursor(null); setRevision(n => n + 1); }}>Choose another approved scope</button>
      {!current ? <p role="status">Checking access…</p> : current.error ? <p role="alert">{current.error}</p> : <>
        <label>Approved learner / employment episode
          <select value={scopeId} onChange={event => { setScopeId(event.target.value); setCursor(null); }}>
            <option value="">Choose an approved episode</option>
            {data.scopes.map(scope => <option key={scope.id} value={scope.id}>
              {scope.organization_scope} · Person {scope.person_id} · Episode {scope.employment_episode_id} · {scope.reviewer_role}{scope.binding_retired ? " · historical binding" : ""}
            </option>)}
          </select>
        </label>
        {data.scopes.length === 0 && <p>No approved reviewer scope is available.</p>}
        {selected && <>
          <p>Person: {selected.person_id}<br />Employment episode: {selected.employment_episode_id}<br />
            Organization: {selected.organization_scope} · Role context: {selected.role_scope_ref}</p>
          <p>Up to 50 occurrences per page. Start/end timestamps use your browser timezone.</p>
          {data.records.length === 0 ? <p>No durable records in this page of the approved episode.</p> : data.records.map(record =>
            <article className="card" key={record.id}>
              <h3>{record.kind === "written" ? "Written practice" : "Simulation practice"} · {record.scenario_ref}</h3>
              <p>{record.status} · Started {date(record.started_at)} · Ended {date(record.ended_at)}</p>
              <p>{reviewAssessmentLabel(record)}</p>
              <p>Context version: {record.content_version} · Assessment criteria: {record.criteria_version || "None — unscored"}</p>
              <small>Attempt {record.id} · Source {record.source_environment} / {record.source_project}</small>
              {record.session && <p>Simulation session {record.session.id}<br />
                {record.session.scenario_ref} · {record.session.difficulty_ref || "Difficulty unspecified"} · {record.session.content_version}<br />
                {record.session.status} · Started {date(record.session.started_at)} · Ended {date(record.session.ended_at)}
              </p>}
            </article>)}
          {cursor && <button onClick={() => setCursor(null)}>Newest records</button>}
          {data.hasMore && <button onClick={() => {
            const last = data.records.at(-1); setCursor({ started_at: last.started_at, id: last.id });
          }}>Older records</button>}
        </>}
      </>}
    </section>
  </Layout>;
}
