import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import {
  FFL_LICENSE_TYPES,
  US_STATES,
  fflToAccount,
  getStateCounts,
  getTotalFFLCount,
  searchFFL,
} from "../lib/fflStore";
import { loadAccounts, saveAccounts } from "../lib/accountStore";
import { loadClaims, setClaim, clearClaim } from "../lib/fflClaimsStore";
import {
  employees,
  getEmployeeByCode,
  getEmployeeFullName,
} from "../data/employees";

const PAGE_SIZE = 25;

const HERO_STATES = ["IN", "MI", "OH", "KY", "IL", "TX", "FL", "PA"];

export default function FFLProspects() {
  const navigate = useNavigate();
  const [state, setState] = useState("IN");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [licenseType, setLicenseType] = useState("01");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [totalFFLs, setTotalFFLs] = useState(null);
  const [stateCounts, setStateCounts] = useState([]);
  const [accountsSnapshot, setAccountsSnapshot] = useState(() => loadAccounts());
  const [claims, setClaims] = useState(() => loadClaims());
  // Track which row is open in inline-edit mode so only one dropdown shows at a time.
  const [editingFflId, setEditingFflId] = useState(null);
  const importedIds = useMemo(
    () => new Set(accountsSnapshot.map((a) => a.id)),
    [accountsSnapshot]
  );
  // Normalized dealer-name → assignedRep code, built once from the Orion account book.
  // Used to answer "does an Orion rep already own this FFL?" by name match (no shared key exists).
  const ownerByName = useMemo(() => {
    const map = new Map();
    for (const a of accountsSnapshot) {
      if (!a.assignedRep) continue;
      const key = normalizeDealerName(a.dealerName);
      if (key && !map.has(key)) map.set(key, { repCode: a.assignedRep, dealerName: a.dealerName });
    }
    return map;
  }, [accountsSnapshot]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await getTotalFFLCount();
      if (!cancelled) setTotalFFLs(count);
    })();
    (async () => {
      const counts = await getStateCounts(HERO_STATES);
      if (!cancelled) setStateCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { rows, total, error } = await searchFFL({
        state: state || undefined,
        query: query || undefined,
        city: city || undefined,
        licenseType: licenseType || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });

      if (cancelled) return;

      if (error) {
        setError(error);
        setRows([]);
        setTotal(0);
      } else {
        setRows(rows);
        setTotal(total);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [state, query, city, licenseType, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const repOptions = useMemo(
    () =>
      [...employees]
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map((e) => ({ code: e.code, label: `${e.firstName} ${e.lastName} (${e.code})` })),
    []
  );

  const [assignRep, setAssignRep] = useState("");

  const showToast = (msg, tone = "positive") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2400);
  };

  const handleConvert = (ffl) => {
    const accounts = loadAccounts();
    const accountId = `ffl-${ffl.id}`;
    if (accounts.some((a) => a.id === accountId)) {
      showToast("Already in your Accounts list", "neutral");
      return;
    }
    const newAccount = fflToAccount(ffl, {
      assignedRepCode: assignRep || null,
    });
    const next = [newAccount, ...accounts];
    saveAccounts(next);
    setAccountsSnapshot(next);
    const repEmp = assignRep ? getEmployeeByCode(assignRep) : null;
    const repName = repEmp ? `${getEmployeeFullName(repEmp)} (${assignRep})` : assignRep;
    showToast(
      assignRep
        ? `Added "${newAccount.dealerName}" → ${repName}`
        : `Added "${newAccount.dealerName}" to Accounts`
    );
  };

  const handleClaim = (ffl, repCode) => {
    const next = setClaim(ffl.id, repCode);
    setClaims(next);
    setEditingFflId(null);
    const repLabel = repLabelFor(repCode);
    showToast(`Claimed "${ffl.businessName || ffl.licenseeName}" → ${repLabel}`);
  };

  const handleClearClaim = (ffl) => {
    const next = clearClaim(ffl.id);
    setClaims(next);
    setEditingFflId(null);
    showToast("Cleared claim", "neutral");
  };

  const handlePracticeCall = (ffl) => {
    const account = fflToAccount(ffl, { assignedRepCode: assignRep || null });
    navigate("/sales-simulator", {
      state: { account, isColdCall: true },
    });
  };

  const resetFilters = () => {
    setState("");
    setQuery("");
    setCity("");
    setLicenseType("");
    setPage(0);
  };

  return (
    <Layout title="FFL Prospect Hub">
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 1000,
            padding: "12px 18px",
            borderRadius: 10,
            background:
              toast.tone === "positive" ? "rgba(61,220,151,0.15)" : "rgba(129,140,248,0.15)",
            border: `1px solid ${
              toast.tone === "positive" ? "rgba(61,220,151,0.35)" : "rgba(129,140,248,0.35)"
            }`,
            color: toast.tone === "positive" ? "#3ddc97" : "#a5b4fc",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {toast.msg}
        </div>
      )}

      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">National FFL Database</div>
          <div className="card-value">
            {totalFFLs == null ? "…" : totalFFLs.toLocaleString()}
          </div>
          <div className="card-note">Active federal firearms license holders</div>
        </div>
        {stateCounts.slice(0, 3).map((s) => (
          <div className="card" key={s.state}>
            <div className="card-label">{s.state} Dealers</div>
            <div className="card-value">{s.count.toLocaleString()}</div>
            <div className="card-note">FFLs in {s.state}</div>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-header">
          <div>
            <h2>Search the National FFL Database</h2>
            <p className="section-subtext">
              Filter by state, name, city, or license type. Convert any prospect into a managed account with one click.
            </p>
          </div>
          <button className="btn-secondary" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>

        <div
          className="button-row"
          style={{ flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}
        >
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(0);
            }}
            style={{ minWidth: 110 }}
          >
            <option value="">All States</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={licenseType}
            onChange={(e) => {
              setLicenseType(e.target.value);
              setPage(0);
            }}
            style={{ minWidth: 240 }}
          >
            <option value="">All License Types</option>
            {FFL_LICENSE_TYPES.map((lt) => (
              <option key={lt.code} value={lt.code}>
                {lt.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Business or licensee name…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            style={{ minWidth: 240 }}
          />

          <input
            type="text"
            placeholder="City"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(0);
            }}
            style={{ minWidth: 160 }}
          />

          <select
            value={assignRep}
            onChange={(e) => setAssignRep(e.target.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">Assign to… (optional)</option>
            {repOptions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="feedback-row" style={{ marginBottom: 12 }}>
          <span>
            {loading ? "Searching…" : `${total.toLocaleString()} matching FFL${total === 1 ? "" : "s"}`}
          </span>
          <span>
            Page {page + 1} of {totalPages.toLocaleString()}
          </span>
        </div>

        {error && (
          <div
            className="insight-box"
            style={{
              borderColor: "rgba(248,113,113,0.4)",
              background: "rgba(248,113,113,0.08)",
            }}
          >
            <div className="card-label">Supabase Error</div>
            <p className="coach-text">{error}</p>
            <p className="coach-text" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              Most common causes: Row Level Security not enabled with a public SELECT policy, or the table name doesn't match <code>FFL_holders</code>.
            </p>
          </div>
        )}

        <div className="table-wrap">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Licensee</th>
                <th>City</th>
                <th>State</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Rep Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ffl) => {
                const accountId = `ffl-${ffl.id}`;
                const alreadyImported = importedIds.has(accountId);
                const owner = lookupOwner(ffl, ownerByName, claims);
                return (
                  <tr key={ffl.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong>{ffl.businessName || "—"}</strong>
                        <LookupLinks ffl={ffl} />
                      </div>
                      {ffl.premiseStreet && (
                        <div style={{ color: "#97a3c6", fontSize: "0.78rem", marginTop: 2 }}>
                          {ffl.premiseStreet}, {ffl.premiseZip}
                        </div>
                      )}
                    </td>
                    <td>{ffl.licenseeName || "—"}</td>
                    <td>{ffl.premiseCity || "—"}</td>
                    <td>{ffl.premiseState || "—"}</td>
                    <td>{ffl.phone || "—"}</td>
                    <td>{ffl.licenseType}</td>
                    <td>
                      <RepOwnerCell
                        ffl={ffl}
                        owner={owner}
                        isEditing={editingFflId === ffl.id}
                        repOptions={repOptions}
                        onStartEdit={() => setEditingFflId(ffl.id)}
                        onCancelEdit={() => setEditingFflId(null)}
                        onClaim={(repCode) => handleClaim(ffl, repCode)}
                        onClear={() => handleClearClaim(ffl)}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn-secondary"
                          onClick={() => handlePracticeCall(ffl)}
                          style={{ whiteSpace: "nowrap" }}
                          title="Practice a cold call against this dealer in the AI Simulator"
                        >
                          🎯 Practice Cold Call
                        </button>
                        <button
                          className={alreadyImported ? "btn-secondary" : "btn-primary"}
                          onClick={() => handleConvert(ffl)}
                          disabled={alreadyImported}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {alreadyImported ? "✓ In Accounts" : "+ Convert to Account"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && rows.length === 0 && !error && (
          <p className="coach-text" style={{ marginTop: 12 }}>
            No FFLs matched your filters. Try widening the state or clearing the search.
          </p>
        )}

        <div
          className="button-row"
          style={{ marginTop: 16, justifyContent: "space-between" }}
        >
          <button
            className="btn-secondary"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0 || loading}
          >
            ← Previous
          </button>
          <button
            className="btn-secondary"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            Next →
          </button>
        </div>
      </section>

      {/* Lookup helper info banner */}
      <div
        className="insight-box"
        style={{
          marginTop: 16,
          background: "rgba(129,140,248,0.06)",
          borderColor: "rgba(129,140,248,0.25)",
        }}
      >
        <div className="card-label">Verify Before You Dial</div>
        <p className="coach-text">
          Use the <strong>🔎 Search</strong> and <strong>🗺️ Maps</strong> icons next to each business name to confirm the dealer is still operating and has a real storefront or website before committing to a call. Watch for the "Permanently closed" tag in Google Maps and missing or empty Google Business listings — both are signs the FFL is dormant.
        </p>
      </div>

      {stateCounts.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <div>
              <h2>Territory Overview</h2>
              <p className="section-subtext">
                FFL dealer counts across Orion's growth states.
              </p>
            </div>
          </div>
          <div className="detail-grid">
            {stateCounts.map((s) => (
              <div className="mini-stat" key={s.state}>
                <span>{s.state}</span>
                <strong>{s.count.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}

// Strip suffixes, punctuation, and casing so "VELOCITY AMMUNITION SALES LLC"
// and "Velocity Ammunition Sales, LLC" collapse to the same key.
function normalizeDealerName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|llc|inc|incorporated|co|company|corp|corporation|lp|llp|pllc|ltd|limited|dba|usa)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function repLabelFor(repCode) {
  if (!repCode) return null;
  const emp = getEmployeeByCode(repCode);
  return emp ? `${getEmployeeFullName(emp)} (${repCode})` : repCode;
}

// Resolve ownership for one FFL. Explicit claims always win over name matches
// so reps can correct false negatives (DBAs, parent-LLC names) and false positives.
function lookupOwner(ffl, ownerByName, claims) {
  const claim = claims?.[ffl.id];
  if (claim?.repCode) {
    return {
      source: "claim",
      repCode: claim.repCode,
      repLabel: repLabelFor(claim.repCode),
      dealerName: null,
    };
  }
  const candidates = [ffl.businessName, ffl.licenseeName].filter(Boolean);
  for (const name of candidates) {
    const hit = ownerByName.get(normalizeDealerName(name));
    if (hit) {
      return {
        source: "match",
        repCode: hit.repCode,
        repLabel: repLabelFor(hit.repCode),
        dealerName: hit.dealerName,
      };
    }
  }
  return null;
}

function RepOwnerCell({
  ffl,
  owner,
  isEditing,
  repOptions,
  onStartEdit,
  onCancelEdit,
  onClaim,
  onClear,
}) {
  if (isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <select
          autoFocus
          defaultValue={owner?.repCode || ""}
          onChange={(e) => {
            if (e.target.value) onClaim(e.target.value);
          }}
          style={{ minWidth: 200, fontSize: "0.82rem" }}
        >
          <option value="">Select rep…</option>
          {repOptions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        {owner?.source === "claim" && (
          <button
            className="btn-secondary"
            onClick={onClear}
            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
            title="Remove the manual claim — name match (if any) will be restored"
          >
            Clear
          </button>
        )}
        <button
          className="btn-secondary"
          onClick={onCancelEdit}
          style={{ padding: "4px 8px", fontSize: "0.75rem" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (owner) {
    const isClaim = owner.source === "claim";
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          title={
            isClaim
              ? "Manually claimed by a rep — overrides name matching"
              : `Matched on dealer name "${owner.dealerName}" from the Orion account book`
          }
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: 6,
            background: isClaim
              ? "rgba(129,140,248,0.15)"
              : "rgba(61,220,151,0.12)",
            border: `1px solid ${
              isClaim ? "rgba(129,140,248,0.4)" : "rgba(61,220,151,0.3)"
            }`,
            color: isClaim ? "#a5b4fc" : "#3ddc97",
            fontSize: "0.78rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {isClaim ? "★ " : ""}
          {owner.repLabel}
        </span>
        <button
          onClick={onStartEdit}
          title="Change ownership"
          style={{
            background: "transparent",
            border: "none",
            color: "#97a3c6",
            cursor: "pointer",
            fontSize: "0.85rem",
            padding: "2px 4px",
          }}
        >
          ✎
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#97a3c6", fontSize: "0.82rem", fontStyle: "italic" }}>
        Prospect
      </span>
      <button
        onClick={onStartEdit}
        style={{
          background: "transparent",
          border: "1px solid rgba(129,140,248,0.3)",
          borderRadius: 6,
          color: "#a5b4fc",
          cursor: "pointer",
          fontSize: "0.72rem",
          padding: "2px 8px",
          fontWeight: 600,
        }}
      >
        Claim
      </button>
    </div>
  );
}

function LookupLinks({ ffl }) {
  const name = (ffl.businessName || ffl.licenseeName || "").trim();
  if (!name) return null;

  const locationParts = [ffl.premiseCity, ffl.premiseState].filter(Boolean).join(" ");
  const searchQuery = encodeURIComponent(
    `"${name}" ${locationParts} firearms dealer`
  );
  const mapsQuery = encodeURIComponent(`${name} ${locationParts}`);

  const searchUrl = `https://www.google.com/search?q=${searchQuery}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const iconStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#a5b4fc",
    fontSize: "0.85rem",
    textDecoration: "none",
    cursor: "pointer",
    transition: "background 0.15s",
  };

  const stop = (e) => e.stopPropagation();

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        title="Open Google Search for this business — check for website, reviews, and 'Permanently closed' status"
        style={iconStyle}
      >
        🔎
      </a>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        title="Open Google Maps — see storefront photos, hours, and current status"
        style={iconStyle}
      >
        🗺️
      </a>
    </span>
  );
}
