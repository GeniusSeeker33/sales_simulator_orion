import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import {
  COMMISSION_META,
  COMMISSION_TOTALS,
  COMMISSION_REP_ROWS,
  COMMISSION_CUSTOMERS_BY_REP,
} from "../data/commissionReportLive";

function fmtCurrency(n, fractionDigits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fractionDigits,
  });
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US");
}

function pctOfYTD(part, ytd) {
  if (!ytd) return null;
  return part / ytd;
}

const REP_SORT = [
  { key: "ytdDesc", label: "YTD Net (high → low)" },
  { key: "mtdDesc", label: "MTD Net (high → low)" },
  { key: "paidDesc", label: "Paid Invoice (high → low)" },
  { key: "soldDesc", label: "Sold-To Customers (high → low)" },
  { key: "captDesc", label: "Captures (high → low)" },
  { key: "custDesc", label: "Customer Count (high → low)" },
  { key: "nameAsc", label: "Name (A → Z)" },
];

function sortRepsBy(rows, mode) {
  const copy = [...rows];
  switch (mode) {
    case "mtdDesc":
      return copy.sort((a, b) => b.mtdNet - a.mtdNet);
    case "paidDesc":
      return copy.sort((a, b) => b.paidInv - a.paidInv);
    case "soldDesc":
      return copy.sort((a, b) => b.mtdSoldTo - a.mtdSoldTo);
    case "captDesc":
      return copy.sort((a, b) => b.mtdCaptured - a.mtdCaptured);
    case "custDesc":
      return copy.sort((a, b) => b.customerCount - a.customerCount);
    case "nameAsc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "ytdDesc":
    default:
      return copy.sort((a, b) => b.ytdNet - a.ytdNet);
  }
}

export default function CommissionReport() {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("ytdDesc");
  const [selectedRep, setSelectedRep] = useState(null);
  const [activeOnly, setActiveOnly] = useState(false);

  const filteredReps = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = COMMISSION_REP_ROWS;
    if (activeOnly) {
      rows = rows.filter((r) => r.mtdNet > 0);
    }
    if (q) {
      rows = rows.filter(
        (r) =>
          r.repCode.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }
    return sortRepsBy(rows, sortMode);
  }, [search, sortMode, activeOnly]);

  const selectedRow = useMemo(
    () => COMMISSION_REP_ROWS.find((r) => r.repCode === selectedRep) || null,
    [selectedRep]
  );

  const selectedCustomers = selectedRow
    ? COMMISSION_CUSTOMERS_BY_REP[selectedRep] || []
    : [];

  return (
    <Layout title="Commission Report">
      <section
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Commission Report (YTD)</h2>
          <p
            className="section-subtext"
            style={{ margin: "4px 0 0", fontSize: "0.88rem" }}
          >
            Mirrors Orion's <code>PBI_Commissions_Customer_Detail</code> Power
            BI feed — customer-level invoiced + paid dollars rolled up by rep.
          </p>
        </div>
        <div
          style={{ textAlign: "right", fontSize: "0.88rem", color: "#97a3c6" }}
        >
          <div>
            <strong style={{ color: "#eef2ff" }}>
              Report date {COMMISSION_META.reportDate}
            </strong>
          </div>
          <div>
            Period: {COMMISSION_META.periodStart} → {COMMISSION_META.periodEnd}
          </div>
          <div style={{ opacity: 0.7, fontSize: "0.78rem" }}>
            Source: {COMMISSION_META.source}
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Company YTD Net Invoiced</div>
          <div className="card-value">
            {fmtCurrency(COMMISSION_TOTALS.ytdNet)}
          </div>
          <div className="card-note">{COMMISSION_TOTALS.reps} reps tracked</div>
        </div>
        <div className="card">
          <div className="card-label">Current MTD Net</div>
          <div className="card-value">
            {fmtCurrency(COMMISSION_TOTALS.mtdNet)}
          </div>
          <div className="card-note">
            {fmtCurrency(COMMISSION_TOTALS.paidInv)} paid
          </div>
        </div>
        <div className="card">
          <div className="card-label">Customer Relationships</div>
          <div className="card-value">{fmtNum(COMMISSION_TOTALS.customers)}</div>
          <div className="card-note">Across all reps in the period</div>
        </div>
        <div className="card">
          <div className="card-label">Qualifying Activity (MTD)</div>
          <div className="card-value">
            {fmtNum(COMMISSION_TOTALS.soldTo)}
          </div>
          <div className="card-note">
            sold-to · {fmtNum(COMMISSION_TOTALS.captures)} captures
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Per-Rep Commission Rollup</h2>
            <p
              className="section-subtext"
              style={{ margin: "4px 0 0", fontSize: "0.85rem" }}
            >
              {activeOnly
                ? `${filteredReps.length} reps with MTD activity`
                : `${filteredReps.length} of ${COMMISSION_REP_ROWS.length} reps`}
              {search.trim() && `, filtered by "${search.trim()}"`}. Click a row
              to see that rep's customer detail.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.85rem",
                color: "#dce5ff",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              MTD-active only
            </label>
            <input
              type="text"
              placeholder="Search rep code or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#eef2ff",
                minWidth: 200,
                fontSize: "0.88rem",
              }}
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#eef2ff",
                fontSize: "0.88rem",
              }}
            >
              {REP_SORT.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table
            className="accounts-table"
            style={{ fontSize: "0.85rem", minWidth: 1100 }}
          >
            <thead>
              <tr>
                <th>Rep Code</th>
                <th>Name</th>
                <th style={{ textAlign: "right" }}>Customers</th>
                <th style={{ textAlign: "right" }}>MTD Net</th>
                <th style={{ textAlign: "right" }}>Paid Inv</th>
                <th style={{ textAlign: "right" }}>YTD Net</th>
                <th style={{ textAlign: "right" }}>Prior Period</th>
                <th style={{ textAlign: "right" }}>Sold-To</th>
                <th style={{ textAlign: "right" }}>Captures</th>
              </tr>
            </thead>
            <tbody>
              {filteredReps.map((rep) => {
                const active = rep.repCode === selectedRep;
                return (
                  <tr
                    key={rep.repCode}
                    className={active ? "row-active" : ""}
                    onClick={() =>
                      setSelectedRep(active ? null : rep.repCode)
                    }
                    style={{
                      cursor: "pointer",
                      outline: active
                        ? "1px solid rgba(61,220,151,0.3)"
                        : undefined,
                    }}
                  >
                    <td>
                      <strong>{rep.repCode}</strong>
                    </td>
                    <td>{rep.name}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmtNum(rep.customerCount)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtCurrency(rep.mtdNet)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtCurrency(rep.paidInv)}
                    </td>
                    <td
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      {fmtCurrency(rep.ytdNet)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtCurrency(rep.priorNet)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtNum(rep.mtdSoldTo)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmtNum(rep.mtdCaptured)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow && (
        <section className="card" style={{ marginTop: 16 }}>
          <div
            className="section-header"
            style={{ flexWrap: "wrap", gap: 12 }}
          >
            <div>
              <h2 style={{ margin: 0 }}>
                {selectedRow.name} ({selectedRow.repCode}) — Customer Detail
              </h2>
              <p
                className="section-subtext"
                style={{ margin: "4px 0 0", fontSize: "0.85rem" }}
              >
                {selectedCustomers.length} customers · sorted by YTD spend.
                Sold-To and Captures highlighted.
              </p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setSelectedRep(null)}
            >
              Close
            </button>
          </div>

          <div className="table-wrap">
            <table
              className="accounts-table"
              style={{ fontSize: "0.83rem", minWidth: 1000 }}
            >
              <thead>
                <tr>
                  <th>Customer No.</th>
                  <th>Customer Name</th>
                  <th style={{ textAlign: "right" }}>MTD Net</th>
                  <th style={{ textAlign: "right" }}>Paid Inv</th>
                  <th style={{ textAlign: "right" }}>YTD Net</th>
                  <th style={{ textAlign: "right" }}>% of Rep YTD</th>
                  <th style={{ textAlign: "center" }}>Sold-To</th>
                  <th style={{ textAlign: "center" }}>Capture</th>
                </tr>
              </thead>
              <tbody>
                {selectedCustomers.map((c, i) => {
                  const pct = pctOfYTD(c.ytdNet, selectedRow.ytdNet);
                  return (
                    <tr key={`${c.customerCode}-${i}`}>
                      <td>
                        <strong>{c.customerCode || "—"}</strong>
                      </td>
                      <td>{c.customerName || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        {fmtCurrency(c.mtdNet)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmtCurrency(c.paidInv)}
                      </td>
                      <td
                        style={{ textAlign: "right", fontWeight: 700 }}
                      >
                        {fmtCurrency(c.ytdNet)}
                      </td>
                      <td
                        style={{ textAlign: "right", color: "#97a3c6" }}
                      >
                        {pct ? `${(pct * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {c.mtdSoldTo ? (
                          <span className="status-pill status-positive">
                            ✓
                          </span>
                        ) : (
                          <span style={{ color: "#97a3c6" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {c.mtdCaptured ? (
                          <span className="status-pill status-positive">
                            ✓
                          </span>
                        ) : (
                          <span style={{ color: "#97a3c6" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section
        className="card"
        style={{ marginTop: 16, fontSize: "0.85rem", color: "#97a3c6" }}
      >
        <h3 style={{ marginTop: 0, color: "#eef2ff" }}>About this report</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>YTD Net Invoiced</strong> is the full year-to-date invoiced
            revenue per rep — the commission-calc input.
          </li>
          <li>
            <strong>Paid Invoice</strong> is the dollars actually paid in the
            current period. Comp plan KPI requires{" "}
            <em>shipped, invoiced, and paid in full</em>.
          </li>
          <li>
            <strong>Sold-To</strong> = customer hit the ≥ $1,000 invoiced
            threshold for the month.{" "}
            <strong>Capture</strong> = new account (or dormant 12+ months).
          </li>
          <li>
            Click a rep row to drill into their customer book — same data
            granularity Power BI exports to Orion's finance team.
          </li>
        </ul>
      </section>
    </Layout>
  );
}
