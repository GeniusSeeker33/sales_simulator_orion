import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import {
  PACE_REPORT_ROWS,
  PACE_REPORT_META,
  PACE_REPORT_COLUMNS,
  TEAMS,
  summarize,
} from "../data/paceReport";

function fmtCurrency(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtPercent(n) {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

function fmtCell(value, format) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "currency") return fmtCurrency(value);
  if (format === "percent") return fmtPercent(value);
  if (typeof value === "number") return value.toLocaleString("en-US");
  return value;
}

function paceStatus(paceToGoal) {
  if (!paceToGoal) return { label: "—", cls: "status-neutral" };
  if (paceToGoal >= 1) return { label: "On Pace", cls: "status-positive" };
  if (paceToGoal >= 0.85) return { label: "Watch", cls: "status-neutral" };
  return { label: "Behind", cls: "status-risk" };
}

const SORT_OPTIONS = [
  { key: "ptgDesc", label: "Pace To Goal (high → low)" },
  { key: "ptgAsc", label: "Pace To Goal (low → high)" },
  { key: "paceDesc", label: "Pace $ (high → low)" },
  { key: "salesDesc", label: "Total Sales (high → low)" },
  { key: "needDesc", label: "Daily Revenue Needed (high → low)" },
  { key: "tenureAsc", label: "Tenure Month (asc)" },
  { key: "nameAsc", label: "Name (A → Z)" },
];

function sortRows(rows, mode) {
  const copy = [...rows];
  switch (mode) {
    case "ptgAsc":
      return copy.sort((a, b) => (a.paceToGoal || 0) - (b.paceToGoal || 0));
    case "paceDesc":
      return copy.sort((a, b) => b.pace - a.pace);
    case "salesDesc":
      return copy.sort((a, b) => b.totalSales - a.totalSales);
    case "needDesc":
      return copy.sort((a, b) => b.dailyRevenueNeeded - a.dailyRevenueNeeded);
    case "tenureAsc":
      return copy.sort((a, b) => (a.tenureMonth || 0) - (b.tenureMonth || 0));
    case "nameAsc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "ptgDesc":
    default:
      return copy.sort((a, b) => (b.paceToGoal || 0) - (a.paceToGoal || 0));
  }
}

function applyDropship(row, includeDropship) {
  if (!includeDropship || !row.dropshipSales) return row;
  const totalSales = (row.totalSales || 0) + (row.dropshipSales || 0);
  const dailyAverage = totalSales / row.shippingDay;
  const pace = dailyAverage * row.totalShippingDaysInMonth;
  const paceToGoal = row.personalGoal > 0 ? pace / row.personalGoal : 0;
  return { ...row, totalSales, dailyAverage, pace, paceToGoal };
}

export default function PaceReport() {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState("ptgDesc");
  const [includeDropship, setIncludeDropship] = useState(false);

  const allRowsAdjusted = useMemo(
    () => PACE_REPORT_ROWS.map((r) => applyDropship(r, includeDropship)),
    [includeDropship]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = allRowsAdjusted;
    if (teamFilter !== "ALL") {
      rows = rows.filter((r) => r.team === teamFilter);
    }
    if (q) {
      rows = rows.filter(
        (r) =>
          r.repCode.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }
    return sortRows(rows, sortMode);
  }, [search, teamFilter, sortMode, allRowsAdjusted]);

  const teamSummary = useMemo(() => summarize(filtered), [filtered]);
  const companySummary = useMemo(
    () => summarize(allRowsAdjusted),
    [allRowsAdjusted]
  );

  const teamCounts = useMemo(() => {
    const counts = {};
    for (const t of TEAMS) {
      counts[t] = PACE_REPORT_ROWS.filter((r) => r.team === t).length;
    }
    return counts;
  }, []);

  const totalDropship = useMemo(
    () => PACE_REPORT_ROWS.reduce((s, r) => s + (r.dropshipSales || 0), 0),
    []
  );

  return (
    <Layout title="Pace Report">
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
          <h2 style={{ margin: 0 }}>Live Pace Report</h2>
          <p
            className="section-subtext"
            style={{ margin: "4px 0 0", fontSize: "0.88rem" }}
          >
            Same daily report Orion runs in production — mirrored 1:1 from{" "}
            <code>public."Pace Report"</code>.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
            fontSize: "0.88rem",
            color: "#97a3c6",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div>
              <strong style={{ color: "#eef2ff" }}>
                Shipping Day {PACE_REPORT_META.shippingDay} of{" "}
                {PACE_REPORT_META.totalShippingDaysInMonth}
              </strong>
            </div>
            <div>Report date: {PACE_REPORT_META.reportDate}</div>
            <div style={{ opacity: 0.7, fontSize: "0.78rem" }}>
              Source: {PACE_REPORT_META.source}
            </div>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: includeDropship
                ? "rgba(61,220,151,0.12)"
                : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
              fontSize: "0.82rem",
              color: includeDropship ? "#8dddb8" : "#dce5ff",
            }}
          >
            <input
              type="checkbox"
              checked={includeDropship}
              onChange={(e) => setIncludeDropship(e.target.checked)}
            />
            Include dropship ({fmtCurrency(totalDropship)} co-wide)
          </label>
        </div>
      </section>

      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">
            Company Sales MTD{" "}
            {includeDropship ? "(incl. dropship)" : "(no dropship)"}
          </div>
          <div className="card-value">
            {fmtCurrency(
              includeDropship
                ? PACE_REPORT_META.companyMonthlySalesNoDropship + totalDropship
                : PACE_REPORT_META.companyMonthlySalesNoDropship
            )}
          </div>
          <div className="card-note">
            Today: {fmtCurrency(PACE_REPORT_META.companyTodaySalesNoDropship)}
            {includeDropship && (
              <>
                {" · "}
                <span style={{ color: "#8dddb8" }}>
                  +{fmtCurrency(totalDropship)} dropship MTD
                </span>
              </>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Team Pace (Projected)</div>
          <div className="card-value">
            {fmtCurrency(companySummary.totalPace)}
          </div>
          <div className="card-note">
            Pace To Goal{" "}
            <strong
              style={{
                color:
                  companySummary.teamPaceToGoal >= 1 ? "#8dddb8" : "#ffd666",
              }}
            >
              {fmtPercent(companySummary.teamPaceToGoal)}
            </strong>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Reps On Pace</div>
          <div className="card-value" style={{ color: "#8dddb8" }}>
            {companySummary.onPace}
            <span style={{ fontSize: "1rem", opacity: 0.6 }}>
              {" "}
              / {companySummary.totalReps}
            </span>
          </div>
          <div className="card-note">Pace To Goal ≥ 100%</div>
        </div>
        <div className="card">
          <div className="card-label">Reps Behind</div>
          <div className="card-value" style={{ color: "#ff9b9b" }}>
            {companySummary.behind}
            <span style={{ fontSize: "1rem", opacity: 0.6 }}>
              {" "}
              / {companySummary.totalReps}
            </span>
          </div>
          <div className="card-note">Pace To Goal &lt; 85%</div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Rep-Level Pace</h2>
            <p
              className="section-subtext"
              style={{ margin: "4px 0 0", fontSize: "0.85rem" }}
            >
              {teamFilter === "ALL"
                ? `All ${PACE_REPORT_ROWS.length} reps`
                : `${teamFilter} team — ${teamCounts[teamFilter]} reps`}
              {search.trim() && `, filtered by "${search.trim()}"`}.
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
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {[
            { key: "ALL", label: `All (${PACE_REPORT_ROWS.length})` },
            ...TEAMS.map((t) => ({
              key: t,
              label: `${t} (${teamCounts[t]})`,
            })).filter((t) => teamCounts[t.key] > 0),
          ].map((t) => {
            const active = teamFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTeamFilter(t.key)}
                className={active ? "btn-primary" : "btn-secondary"}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.82rem",
                  borderRadius: 999,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="table-wrap">
          <table
            className="accounts-table"
            style={{ fontSize: "0.82rem", minWidth: 1900 }}
          >
            <thead>
              <tr>
                {PACE_REPORT_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      textAlign: col.align === "right" ? "right" : "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = paceStatus(row.paceToGoal);
                return (
                  <tr key={row.repCode}>
                    {PACE_REPORT_COLUMNS.map((col) => {
                      const value = row[col.key];
                      const isPtg = col.key === "paceToGoal";
                      const overrideColor = isPtg
                        ? row.paceToGoal >= 1
                          ? "#8dddb8"
                          : row.paceToGoal >= 0.85
                          ? "#ffd666"
                          : row.paceToGoal > 0
                          ? "#ff9b9b"
                          : undefined
                        : undefined;

                      return (
                        <td
                          key={col.key}
                          style={{
                            textAlign:
                              col.align === "right" ? "right" : "left",
                            whiteSpace: "nowrap",
                            color: overrideColor,
                            fontWeight: isPtg ? 700 : 400,
                          }}
                        >
                          {fmtCell(value, col.format)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center" }}>
                      <span className={`status-pill ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filtered.length > 0 && (
                <tr
                  style={{
                    background: "rgba(61,220,151,0.08)",
                    fontWeight: 700,
                    borderTop: "2px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <td colSpan={3}>
                    {teamFilter === "ALL" ? "Company Total" : `${teamFilter} Total`}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {filtered.length} reps
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtCurrency(teamSummary.totalSales)}
                  </td>
                  <td />
                  <td style={{ textAlign: "right" }}>
                    {fmtCurrency(teamSummary.totalPace)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtCurrency(teamSummary.totalGoal)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color:
                        teamSummary.teamPaceToGoal >= 1 ? "#8dddb8" : "#ffd666",
                    }}
                  >
                    {fmtPercent(teamSummary.teamPaceToGoal)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {fmtCurrency(teamSummary.totalMinGoal)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {teamSummary.totalSoldTo.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {teamSummary.soldToGoal.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {teamSummary.totalCaptures.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {teamSummary.captureGoal.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {teamSummary.monthlyOrders.toLocaleString()}
                  </td>
                  <td />
                  <td style={{ textAlign: "right" }}>
                    {teamSummary.ordersToday.toLocaleString()}
                  </td>
                  <td />
                  <td />
                  <td style={{ textAlign: "right" }}>
                    {PACE_REPORT_META.shippingDay}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {PACE_REPORT_META.totalShippingDaysInMonth}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "#97a3c6",
              fontSize: "0.9rem",
            }}
          >
            No reps match those filters.
          </div>
        )}
      </section>

      <section
        className="card"
        style={{ marginTop: 16, fontSize: "0.85rem", color: "#97a3c6" }}
      >
        <h3 style={{ marginTop: 0, color: "#eef2ff" }}>How pace is calculated</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>Daily Average</strong> = Total Sales ÷ Shipping Day
          </li>
          <li>
            <strong>Pace</strong> = Daily Average × Total Shipping Days in Month
          </li>
          <li>
            <strong>Pace To Goal</strong> = Pace ÷ Personal Goal
          </li>
          <li>
            <strong>Daily Revenue Needed</strong> = Personal Goal ÷ Total
            Shipping Days in Month (the steady daily pace required to hit goal
            in a full month)
          </li>
          <li>
            <strong>Min Goal</strong> comes from the Orion KPI roadmap by tenure
            month. <strong>Personal Goal</strong> is each rep's individually-set
            stretch.
          </li>
          <li>
            Dropship revenue is tracked separately and shown via the per-rep{" "}
            <code>dropshipSales</code> field (not blended into Total Sales).
          </li>
        </ul>
      </section>
    </Layout>
  );
}
