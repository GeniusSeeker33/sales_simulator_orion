import { useEffect, useState } from "react";
import OrionCjfPortfolioReview from "../components/orion/OrionCjfPortfolioReview";
import { loadCjfPortfolio, signInOrionDev, signOutOrionDev } from "../lib/orionPortfolioClient";

// Separate read-only route: does not use the legacy learner login or local FFL claim store.
export default function OrionDevPortfolio() {
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loadCjfPortfolio().then((result) => {
      if (!live) return;
      setRows(result.rows);
      setError(result.error || "");
      setLoading(false);
    }).catch(() => {
      if (live) { setError("Could not load portfolio."); setLoading(false); }
    });
    return () => { live = false; };
  }, [revision]);
  return <main style={{ minHeight: "100vh", padding: "40px 24px", background: "#0b1020", color: "#e5e7eb" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1>Orion FFL Ownership — Development</h1>
      <p>Private, read-only review of Chase Farmer's imported customer accounts. No live account assignments are changed.</p>
      <form onSubmit={async (event) => {
        event.preventDefault();
        setNotice("");
        const result = await signInOrionDev("desiree@orionwholesaleonline.com", password);
        setPassword("");
        if (result.error) setNotice(result.error);
        else { setNotice("Development login accepted."); setRevision((n) => n + 1); }
      }} style={{ padding: 20, marginBottom: 24, border: "1px solid #334155", borderRadius: 12 }}>
        <h2>Development administrator sign-in</h2>
        <p>desiree@orionwholesaleonline.com</p>
        <label htmlFor="orion-dev-password">Development Supabase password</label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          <input id="orion-dev-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required style={{ padding: 12, minWidth: 260 }} />
          <button type="submit" style={{ padding: 12 }}>Sign in</button>
          <button type="button" onClick={async () => {
            await signOutOrionDev();
            setRows([]);
            setNotice("Signed out.");
            setRevision((n) => n + 1);
          }}>Sign out</button>
          <button type="button" onClick={() => setRevision((n) => n + 1)}>Refresh</button>
        </div>
        {notice && <p role="status">{notice}</p>}
      </form>
      <OrionCjfPortfolioReview rows={rows} loading={loading} error={error} />
    </div>
  </main>;
}
