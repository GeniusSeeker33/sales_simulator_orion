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
import { employees } from "../data/employees";

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
  const [importedIds, setImportedIds] = useState(() =>
    new Set(loadAccounts().map((a) => a.id))
  );
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
    saveAccounts([newAccount, ...accounts]);
    setImportedIds(new Set([...importedIds, accountId]));
    showToast(
      assignRep
        ? `Added "${newAccount.dealerName}" → ${assignRep}`
        : `Added "${newAccount.dealerName}" to Accounts`
    );
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ffl) => {
                const accountId = `ffl-${ffl.id}`;
                const alreadyImported = importedIds.has(accountId);
                return (
                  <tr key={ffl.id}>
                    <td>
                      <strong>{ffl.businessName || "—"}</strong>
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
