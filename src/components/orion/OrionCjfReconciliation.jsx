import { useEffect, useState } from "react";
import { loadCjfReviewQueue, saveCjfReview } from "../../lib/orionPortfolioClient";

const options = [
  ["needs_bc_verification", "Needs Business Central verification"],
  ["name_variant", "Possible alternate name"],
  ["separate_accounts", "Likely separate accounts"],
  ["missing_customer_number", "Missing customer number"],
];
export default function OrionCjfReconciliation({ revision }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loadCjfReviewQueue().then(({ rows, error }) => {
      if (!live) return;
      setRows(rows);
      setError(error || "");
      setLoading(false);
    });
    return () => { live = false; };
  }, [revision, refresh]);
  if (loading) return <p>Loading reconciliation queue…</p>;
  if (error) return <p role="alert">Reconciliation queue: {error}</p>;
  return <section style={{ border: "1px solid #334155", borderRadius: 12, padding: 20, marginTop: 24 }}>
    <h2>Administrator reconciliation queue</h2>
    <p>{rows.length} flagged source rows. Review notes are saved separately; no ownership changes or invoice verification occur here.</p>
    {notice && <p role="status">{notice}</p>}
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th>Customer #</th><th>Imported name</th><th>Review decision</th><th>Notes</th><th>Action</th></tr></thead>
        <tbody>{rows.map((row) => {
          const draft = drafts[row.source_row] || { decision: row.decision || "needs_bc_verification", notes: row.notes || "" };
          return <tr key={row.source_row}>
            <td style={{ padding: 8 }}>{row.customer_number || "MISSING"}</td>
            <td style={{ padding: 8 }}>{row.source_account_name}</td>
            <td style={{ padding: 8 }}><select aria-label={`Decision for row ${row.source_row}`} value={draft.decision} onChange={(e) => setDrafts((p) => ({ ...p, [row.source_row]: { ...draft, decision: e.target.value } }))}>{options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></td>
            <td style={{ padding: 8 }}><input aria-label={`Notes for row ${row.source_row}`} value={draft.notes} maxLength={2000} placeholder="Reason or next step" onChange={(e) => setDrafts((p) => ({ ...p, [row.source_row]: { ...draft, notes: e.target.value } }))} /></td>
            <td style={{ padding: 8 }}><button type="button" disabled={saving === row.source_row} onClick={async () => {
              setSaving(row.source_row);
              const result = await saveCjfReview(row.source_row, draft.decision, draft.notes);
              setSaving(null);
              setNotice(result.error || `Saved review for row ${row.source_row}`);
              if (!result.error) setRefresh((n) => n + 1);
            }}>{saving === row.source_row ? "Saving…" : "Save review"}</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
