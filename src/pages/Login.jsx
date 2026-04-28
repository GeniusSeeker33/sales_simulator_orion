
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 320));

    const result = login(email, password);

    if (result.success) {
      navigate(result.redirect, { replace: true });
    } else {
      setError(result.error);
    }

    setLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <div style={styles.brand}>
          <div style={styles.brandMark}>O</div>
          <div>
            <div style={styles.brandTitle}>Orion Wholesale</div>
            <div style={styles.brandSub}>Sales Intelligence Platform</div>
          </div>
        </div>

        <h2 style={styles.heading}>Sign In</h2>
        <p style={styles.sub}>Enter your Orion credentials to access your dashboard.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@orionwholesaleonline.com"
              required
              autoComplete="username"
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={styles.hint}>
          <p>
            <strong>Employee login:</strong> your Orion email + your employee code followed by <code>@Orion</code>
            <br />
            Example: <code>CJF@Orion</code> for Chase Farmer
          </p>
          <p>
            <strong>Admin / Executive access:</strong> contact Desiree Thayer for credentials.
          </p>
        </div>

        <div style={styles.poweredBy}>
          Powered by{" "}
          <a href="https://geniusseeker.com" target="_blank" rel="noopener noreferrer" style={styles.poweredByLink}>
            GeniusSeeker
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b1020 0%, #11172b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 24,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 32,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #3ddc97, #1e9e6b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "1.3rem",
    color: "#0b1020",
    flexShrink: 0,
  },
  brandTitle: {
    fontWeight: 800,
    fontSize: "1.1rem",
    color: "#eef2ff",
  },
  brandSub: {
    fontSize: "0.82rem",
    color: "#97a3c6",
    marginTop: 2,
  },
  heading: {
    margin: "0 0 6px",
    fontSize: "1.5rem",
    fontWeight: 800,
    color: "#eef2ff",
  },
  sub: {
    margin: "0 0 28px",
    color: "#97a3c6",
    fontSize: "0.9rem",
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#c8d2f0",
  },
  input: {
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#eef2ff",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.2s",
  },
  errorBox: {
    background: "rgba(248, 113, 113, 0.12)",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fca5a5",
    fontSize: "0.88rem",
  },
  btn: {
    padding: "13px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #3ddc97, #1e9e6b)",
    color: "#0b1020",
    fontWeight: 800,
    fontSize: "1rem",
    cursor: "pointer",
    marginTop: 4,
  },
  hint: {
    marginTop: 24,
    padding: "14px 16px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "#97a3c6",
    fontSize: "0.78rem",
    lineHeight: 1.55,
  },
  poweredBy: {
    marginTop: 20,
    textAlign: "center",
    fontSize: "0.75rem",
    color: "rgba(151,163,198,0.5)",
  },
  poweredByLink: {
    color: "#3ddc97",
    textDecoration: "none",
    fontWeight: 600,
  },
};
