import { NavLink, useNavigate } from "react-router-dom";
import { uiCopy } from "../../data/uiCopy";
import { useAuth } from "../../context/AuthContext";

const repNavItems = [
  { to: "/dashboard", label: uiCopy.nav.dashboard },
  { to: "/accounts", label: uiCopy.nav.accounts },
  { to: "/training", label: uiCopy.nav.training },
  { to: "/levels", label: uiCopy.nav.levels },
  { to: "/leaderboard", label: uiCopy.nav.leaderboard },
  { to: "/activity", label: uiCopy.nav.activity },
  { to: "/rep-metrics", label: uiCopy.nav.repMetrics },
];

const managerNavItems = [
  ...repNavItems,
  { to: "/manager-view", label: uiCopy.nav.managerView },
  { to: "/employees", label: uiCopy.nav.employees },
];

export default function Layout({ title, children }) {
  const { isManager, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const navItems = isManager ? managerNavItems : repNavItems;

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>{uiCopy.appName}</h1>
          <p className="sidebar-subtext">{uiCopy.appSubtext}</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer-note">
          {profile?.full_name && (
            <div style={{ marginBottom: 8, fontWeight: 600, color: "#eef2ff" }}>
              {profile.full_name}
            </div>
          )}
          <div style={{ marginBottom: 10, textTransform: "capitalize", color: "#8dddb8", fontSize: "0.82rem" }}>
            {profile?.role ?? "rep"}
          </div>
          <button className="btn-secondary" style={{ width: "100%", padding: "8px 12px", fontSize: "0.85rem" }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-topbar">
          <div>
            <h1 className="page-title">{title}</h1>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
