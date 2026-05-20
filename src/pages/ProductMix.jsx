import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import {
  PRODUCT_MIX_META,
  PRODUCT_MIX_COMPANY_TOTALS,
  PRODUCT_MIX_CATEGORIES,
  PRODUCT_MIX_COMPANY_TOP_ITEMS,
  PRODUCT_MIX_REP_ROWS,
  PRODUCT_MIX_REP_TOP_ITEMS,
} from "../data/productMixLive";
import { PACE_LIVE_TEAMS } from "../data/paceReportLive";
import { getEmployeeByCode, getEmployeeFullName } from "../data/employees";

function fmtCurrency(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtPercent(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US");
}

function repDisplayName(code) {
  const emp = getEmployeeByCode(code);
  if (emp) return getEmployeeFullName(emp);
  return code;
}

const HEADLINE_CATEGORIES = [
  "PISTOL",
  "RIFLE",
  "AMMO",
  "SHOOTING ACCESSORIES",
  "SUPPRESSORS",
  "OPTICS",
];

const SORT_OPTIONS = [
  { key: "salesDesc", label: "Total Sales (high → low)" },
  { key: "gpDesc", label: "Gross Margin % (high → low)" },
  { key: "gpAsc", label: "Gross Margin % (low → high)" },
  { key: "accDesc", label: "Accessories % (high → low)" },
  { key: "accAsc", label: "Accessories % (low → high)" },
  { key: "opticsDesc", label: "Optics % (high → low)" },
  { key: "nameAsc", label: "Rep Code (A → Z)" },
];

function shareOf(row, cat) {
  return row.categories?.[cat]?.share || 0;
}

function sortReps(rows, mode) {
  const copy = [...rows];
  switch (mode) {
    case "gpDesc":
      return copy.sort((a, b) => b.gpMargin - a.gpMargin);
    case "gpAsc":
      return copy.sort((a, b) => a.gpMargin - b.gpMargin);
    case "accDesc":
      return copy.sort(
        (a, b) =>
          shareOf(b, "SHOOTING ACCESSORIES") - shareOf(a, "SHOOTING ACCESSORIES")
      );
    case "accAsc":
      return copy.sort(
        (a, b) =>
          shareOf(a, "SHOOTING ACCESSORIES") - shareOf(b, "SHOOTING ACCESSORIES")
      );
    case "opticsDesc":
      return copy.sort((a, b) => shareOf(b, "OPTICS") - shareOf(a, "OPTICS"));
    case "nameAsc":
      return copy.sort((a, b) => a.repCode.localeCompare(b.repCode));
    case "salesDesc":
    default:
      return copy.sort((a, b) => b.totalSales - a.totalSales);
  }
}

function buildCoachingCallouts(reps) {
  const meaningful = reps.filter((r) => r.totalSales >= 250000);
  if (meaningful.length === 0) return [];

  const avgAcc =
    meaningful.reduce((s, r) => s + shareOf(r, "SHOOTING ACCESSORIES"), 0) /
    meaningful.length;
  const avgGp =
    meaningful.reduce((s, r) => s + r.gpMargin, 0) / meaningful.length;

  const lowAccessories = [...meaningful]
    .sort(
      (a, b) =>
        shareOf(a, "SHOOTING ACCESSORIES") - shareOf(b, "SHOOTING ACCESSORIES")
    )
    .slice(0, 5);

  const lowMargin = [...meaningful]
    .sort((a, b) => a.gpMargin - b.gpMargin)
    .slice(0, 5);

  const noOptics = meaningful
    .filter((r) => shareOf(r, "OPTICS") < 0.005)
    .slice(0, 5);

  return [
    {
      title: "Reps under-indexing on accessories",
      detail: `Team avg is ${fmtPercent(
        avgAcc
      )}. These reps could move 1–2 points of margin by attaching accessories to every pistol/rifle sale.`,
      reps: lowAccessories.map((r) => ({
        repCode: r.repCode,
        name: repDisplayName(r.repCode),
        value: fmtPercent(shareOf(r, "SHOOTING ACCESSORIES")),
        sales: r.totalSales,
      })),
    },
    {
      title: "Reps with lowest gross margin",
      detail: `Team avg gross margin is ${fmtPercent(
        avgGp
      )}. These reps are leaning on low-margin SKUs — coaching opportunity on bundling.`,
      reps: lowMargin.map((r) => ({
        repCode: r.repCode,
        name: repDisplayName(r.repCode),
        value: fmtPercent(r.gpMargin),
        sales: r.totalSales,
      })),
    },
    {
      title: "Reps with effectively zero optics",
      detail:
        "Optics is < 0.5% of revenue across the team. Big white-space category if reps were trained to attach.",
      reps: noOptics.map((r) => ({
        repCode: r.repCode,
        name: repDisplayName(r.repCode),
        value: fmtPercent(shareOf(r, "OPTICS")),
        sales: r.totalSales,
      })),
    },
  ];
}

export default function ProductMix() {
  const [sortMode, setSortMode] = useState("salesDesc");
  const [search, setSearch] = useState("");
  const [minSales, setMinSales] = useState(0);
  const [selectedRep, setSelectedRep] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = PRODUCT_MIX_REP_ROWS;
    if (minSales > 0) rows = rows.filter((r) => r.totalSales >= minSales);
    if (q) {
      rows = rows.filter((r) => {
        const name = repDisplayName(r.repCode).toLowerCase();
        return r.repCode.toLowerCase().includes(q) || name.includes(q);
      });
    }
    return sortReps(rows, sortMode);
  }, [search, sortMode, minSales]);

  const callouts = useMemo(
    () => buildCoachingCallouts(PRODUCT_MIX_REP_ROWS),
    []
  );

  const selectedRow = useMemo(
    () => PRODUCT_MIX_REP_ROWS.find((r) => r.repCode === selectedRep) || null,
    [selectedRep]
  );
  const selectedItems = selectedRep
    ? PRODUCT_MIX_REP_TOP_ITEMS[selectedRep] || []
    : [];

  return (
    <Layout title="Product Mix">
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
          <h2 style={{ margin: 0 }}>Product Mix & Margin</h2>
          <p
            className="section-subtext"
            style={{ margin: "4px 0 0", fontSize: "0.88rem" }}
          >
            Aggregated from <code>Sales Shipment-Line</code> (
            {fmtNum(PRODUCT_MIX_META.transactionCount)} transactions).
            Category breakdown, gross margin, and top-selling SKUs by rep.
          </p>
        </div>
        <div
          style={{ textAlign: "right", fontSize: "0.88rem", color: "#97a3c6" }}
        >
          <div>
            <strong style={{ color: "#eef2ff" }}>
              {PRODUCT_MIX_META.periodStart} → {PRODUCT_MIX_META.periodEnd}
            </strong>
          </div>
          <div>{PRODUCT_MIX_COMPANY_TOTALS.repCount} reps · 22 categories</div>
          <div style={{ opacity: 0.7, fontSize: "0.78rem" }}>
            Source: {PRODUCT_MIX_META.source}
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Total Shipped Sales</div>
          <div className="card-value">
            {fmtCurrency(PRODUCT_MIX_COMPANY_TOTALS.totalSales)}
          </div>
          <div className="card-note">YTD through report date</div>
        </div>
        <div className="card">
          <div className="card-label">Gross Profit</div>
          <div className="card-value">
            {fmtCurrency(PRODUCT_MIX_COMPANY_TOTALS.grossProfit)}
          </div>
          <div className="card-note">
            <strong style={{ color: "#8dddb8" }}>
              {fmtPercent(PRODUCT_MIX_COMPANY_TOTALS.gpMargin)}
            </strong>{" "}
            company GP margin
          </div>
        </div>
        <div className="card">
          <div className="card-label">Top Category</div>
          <div className="card-value">{PRODUCT_MIX_CATEGORIES[0]?.category}</div>
          <div className="card-note">
            {fmtCurrency(PRODUCT_MIX_CATEGORIES[0]?.sales)} ·{" "}
            {fmtPercent(PRODUCT_MIX_CATEGORIES[0]?.share)}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Optics Share</div>
          <div className="card-value" style={{ color: "#ff9b9b" }}>
            {fmtPercent(
              PRODUCT_MIX_CATEGORIES.find((c) => c.category === "OPTICS")
                ?.share || 0
            )}
          </div>
          <div className="card-note">Largest untapped category</div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px" }}>Company Category Mix</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PRODUCT_MIX_CATEGORIES.slice(0, 12).map((cat) => {
            const bar = Math.max(2, cat.share * 100);
            const isTop = cat.share >= 0.05;
            return (
              <div
                key={cat.category}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 100px 90px 90px",
                  gap: 12,
                  alignItems: "center",
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={cat.category}
                >
                  {cat.category}
                </div>
                <div
                  style={{
                    height: 14,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 7,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${bar}%`,
                      height: "100%",
                      background: isTop
                        ? "linear-gradient(90deg,#3ddc97,#5fb3ff)"
                        : "rgba(151,163,198,0.5)",
                    }}
                  />
                </div>
                <div style={{ textAlign: "right", color: "#97a3c6" }}>
                  {fmtCurrency(cat.sales)}
                </div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>
                  {fmtPercent(cat.share)}
                </div>
                <div style={{ textAlign: "right", color: "#8dddb8" }}>
                  GP {fmtPercent(cat.gpMargin, 0)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {callouts.map((c) => (
          <div key={c.title} className="card">
            <h3 style={{ margin: "0 0 4px", color: "#eef2ff" }}>{c.title}</h3>
            <p
              className="section-subtext"
              style={{
                margin: "0 0 12px",
                fontSize: "0.82rem",
                lineHeight: 1.45,
              }}
            >
              {c.detail}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {c.reps.map((r) => (
                <div
                  key={r.repCode}
                  onClick={() => setSelectedRep(r.repCode)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(61,220,151,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.03)")
                  }
                >
                  <div>
                    <strong>{r.repCode}</strong>{" "}
                    <span style={{ color: "#97a3c6" }}>{r.name}</span>
                  </div>
                  <div>
                    <span style={{ color: "#ff9b9b", fontWeight: 700 }}>
                      {r.value}
                    </span>{" "}
                    <span style={{ color: "#97a3c6", fontSize: "0.78rem" }}>
                      · {fmtCurrency(r.sales)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Rep-Level Mix</h2>
            <p
              className="section-subtext"
              style={{ margin: "4px 0 0", fontSize: "0.85rem" }}
            >
              {filtered.length} of {PRODUCT_MIX_REP_ROWS.length} reps. Click a
              row to see that rep's top 20 items.
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
            <select
              value={minSales}
              onChange={(e) => setMinSales(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#eef2ff",
                fontSize: "0.85rem",
              }}
            >
              <option value={0}>All reps</option>
              <option value={100000}>≥ $100K sales</option>
              <option value={500000}>≥ $500K sales</option>
              <option value={1000000}>≥ $1M sales</option>
            </select>
            <input
              type="text"
              placeholder="Search rep…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#eef2ff",
                minWidth: 180,
                fontSize: "0.85rem",
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
                fontSize: "0.85rem",
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

        <div className="table-wrap">
          <table
            className="accounts-table"
            style={{ fontSize: "0.82rem", minWidth: 1200 }}
          >
            <thead>
              <tr>
                <th>Rep</th>
                <th>Team</th>
                <th style={{ textAlign: "right" }}>Total Sales</th>
                <th style={{ textAlign: "right" }}>GP %</th>
                {HEADLINE_CATEGORIES.map((cat) => (
                  <th
                    key={cat}
                    style={{ textAlign: "right", whiteSpace: "nowrap" }}
                  >
                    %{cat.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const team = PACE_LIVE_TEAMS[r.repCode] || "—";
                const active = r.repCode === selectedRep;
                return (
                  <tr
                    key={r.repCode}
                    className={active ? "row-active" : ""}
                    onClick={() =>
                      setSelectedRep(active ? null : r.repCode)
                    }
                    style={{
                      cursor: "pointer",
                      outline: active
                        ? "1px solid rgba(61,220,151,0.3)"
                        : undefined,
                    }}
                  >
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong>{r.repCode}</strong>
                        <span
                          style={{ color: "#97a3c6", fontSize: "0.78rem" }}
                        >
                          {repDisplayName(r.repCode)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{ color: "#97a3c6", fontSize: "0.82rem" }}
                      >
                        {team}
                      </span>
                    </td>
                    <td
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      {fmtCurrency(r.totalSales)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        color:
                          r.gpMargin >= 0.15
                            ? "#8dddb8"
                            : r.gpMargin >= 0.12
                            ? "#ffd666"
                            : "#ff9b9b",
                        fontWeight: 700,
                      }}
                    >
                      {fmtPercent(r.gpMargin)}
                    </td>
                    {HEADLINE_CATEGORIES.map((cat) => {
                      const share = shareOf(r, cat);
                      return (
                        <td
                          key={cat}
                          style={{
                            textAlign: "right",
                            color:
                              share === 0
                                ? "#5a6580"
                                : share >= 0.4
                                ? "#5fb3ff"
                                : undefined,
                          }}
                        >
                          {share > 0 ? fmtPercent(share, 0) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {repDisplayName(selectedRow.repCode)} ({selectedRow.repCode}) —
                Top 20 Items
              </h2>
              <p
                className="section-subtext"
                style={{ margin: "4px 0 0", fontSize: "0.85rem" }}
              >
                {fmtCurrency(selectedRow.totalSales)} total ·{" "}
                {fmtPercent(selectedRow.gpMargin)} GP margin
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
              style={{ fontSize: "0.83rem", minWidth: 900 }}
            >
              <thead>
                <tr>
                  <th>Item No.</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Sales</th>
                  <th style={{ textAlign: "right" }}>GP %</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item, i) => (
                  <tr key={`${item.itemNo}-${i}`}>
                    <td>
                      <strong>{item.itemNo}</strong>
                    </td>
                    <td style={{ maxWidth: 380 }}>{item.description}</td>
                    <td>
                      <span
                        style={{
                          color: "#97a3c6",
                          fontSize: "0.78rem",
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>{fmtNum(item.qty)}</td>
                    <td
                      style={{ textAlign: "right", fontWeight: 700 }}
                    >
                      {fmtCurrency(item.sales)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        color:
                          item.gpMargin >= 0.15
                            ? "#8dddb8"
                            : item.gpMargin >= 0.10
                            ? "#ffd666"
                            : "#ff9b9b",
                      }}
                    >
                      {fmtPercent(item.gpMargin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px" }}>Company Top 25 SKUs</h2>
        <div className="table-wrap">
          <table
            className="accounts-table"
            style={{ fontSize: "0.83rem", minWidth: 900 }}
          >
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Description</th>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Sales</th>
                <th style={{ textAlign: "right" }}>GP %</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_MIX_COMPANY_TOP_ITEMS.map((item, i) => (
                <tr key={`${item.itemNo}-${i}`}>
                  <td>
                    <strong>{item.itemNo}</strong>
                  </td>
                  <td style={{ maxWidth: 420 }}>{item.description}</td>
                  <td>
                    <span style={{ color: "#97a3c6", fontSize: "0.78rem" }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{fmtNum(item.qty)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {fmtCurrency(item.sales)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color:
                        item.gpMargin >= 0.15
                          ? "#8dddb8"
                          : item.gpMargin >= 0.10
                          ? "#ffd666"
                          : "#ff9b9b",
                    }}
                  >
                    {fmtPercent(item.gpMargin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
