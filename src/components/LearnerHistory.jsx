import { useEffect, useState } from "react";
import { loadLearnerHistory } from "../lib/learnerRecords";
export default function LearnerHistory({ revision = 0 }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadLearnerHistory().then(data => { if (live) { setRows(data); setError(""); } })
      .catch(e => { if (live) { setRows(null); setError(e.message); } });
    return () => { live = false; };
  }, [revision]);
  return <section className="card simulator-panel">
    <h2>My saved practice</h2>
    <p>Latest 50 verified learner records. Practice feedback is not an approved competency or level. Legacy browser records remain unattributed and are excluded.</p>
    {error ? <p role="alert">{error}</p> : rows === null ? <p>Loading history…</p> : rows.length === 0 ? <p>No saved records in your current access scope.</p> :
      <ul>{rows.map(row => <li key={row.id}>
        {new Date(row.started_at).toLocaleString()} · {row.kind} · {row.scenario_ref} · {row.status}
        {row.ai_score ? ` · AI practice feedback (unreviewed): ${row.ai_score.overall}/100` : " · Unscored"}
        <small> · Record {row.id}</small>
      </li>)}</ul>}
  </section>;
}
