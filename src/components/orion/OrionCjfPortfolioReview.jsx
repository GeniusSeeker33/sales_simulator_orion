import { useMemo, useState } from "react";

/**
 * Development-only review panel. Supply rows from an authorized backend; never
 * bundle Orion customer data or a Supabase service key into the browser.
 * Does not grant ownership, mutate assignments, or start protection timers.
 */
export default function OrionCjfPortfolioReview({ rows = [], loading = false, error = null }) {
  const [search, setSearch] = useState("");
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const { enriched, distinctCount, conflictNumbers, missingCount } = useMemo(() => {
    const namesByNumber = new Map();
    for (const row of rows) {
      const number = row.customer_number?.trim();
      if (!number) continue;
      if (!namesByNumber.has(number)) namesByNumber.set(number, new Set());
      namesByNumber.get(number).add(row.source_account_name?.trim() || "");
    }
    const conflicts = new Set([...namesByNumber].filter(([, names]) => names.size > 1).map(([number]) => number));
    return {
      enriched: rows.map((row) => ({ ...row, conflict: !!row.customer_number && conflicts.has(row.customer_number) })),
      distinctCount: namesByNumber.size,
      conflictNumbers: conflicts,
      missingCount: rows.filter((row) => !row.customer_number?.trim()).length,
    };
  }, [rows]);
  const visible = enriched.filter((row) => {
    if (onlyConflicts && !row.conflict && row.customer_number) return false;
    return [row.customer_number, row.source_account_name].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()));
  });
  return (
    <section className="card" aria-label="CJF account portfolio review">
      <div className="section-header">
        <div>
          <h2>Chase Farmer (CJF) — Reported Customer Assignments</h2>
          <p className="section-subtext">Development review only · Not verified invoice-backed ownership</p>
        </div>
      </div>
      <p className="coach-text">{rows.length} source rows · {distinctCount} customer numbers · {conflictNumbers.size} numbers with differing names · {missingCount} without a number</p>
      {error && <p role="alert">{error}</p>}
      <div className="button-row">
        <input aria-label="Search customer number or name" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer number or name" />
        <label><input type="checkbox" checked={onlyConflicts} onChange={(e) => setOnlyConflicts(e.target.checked)} /> Review conflicts / missing numbers only</label>
      </div>
      {loading ? <p>Loading…</p> : (
        <div className="table-wrap">
          <table className="accounts-table">
            <thead><tr><th>Customer #</th><th>Source account name</th><th>Review</th></tr></thead>
            <tbody>{visible.map((row) => (
              <tr key={row.source_row}>
                <td>{row.customer_number || "Missing"}</td>
                <td>{row.source_account_name}</td>
                <td>{!row.customer_number ? "Missing number" : row.conflict ? "Name conflict" : "Unverified assignment"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
