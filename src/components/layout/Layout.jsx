import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { uiCopy } from "../../data/uiCopy";

const REP_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/sales-simulator", label: "AI Sales Simulator" },
  { to: "/training", label: "Training" },
  { to: "/accounts", label: "Accounts" },
  { to: "/activity", label: "Activity" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/training-leaderboard", label: "Prize Leaderboard" },
  { to: "/levels", label: "Level Progress" },
  { to: "/rep-metrics", label: "Rep Metrics" },
];

const MANAGER_NAV = [
  ...REP_NAV,
  { to: "/manager-view", label: "Manager View", divider: true },
  { to: "/employees", label: "Employees" },
];

const ADMIN_NAV = [
  ...MANAGER_NAV,
  { to: "/admin-view", label: "Admin View", divider: true },
  { to: "/admin/import", label: "Import Data" },
];

function getNavItems(role) {
  if (role === "admin") return ADMIN_NAV;
  if (role === "manager") return MANAGER_NAV;
  return REP_NAV;
}

export default function Layout({ title, children }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = getNavItems(session?.role);
  const firstName = session?.name?.split(" ")[0] || "You";
  const roleLabel = session?.role === "admin" ? "Admin" : session?.role === "manager" ? "Manager" : "Sales Rep";

  function handleLogout() {
    logout();
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
            <div key={item.to}>
              {item.divider && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>

        {session && (
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                marginTop: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#eef2ff" }}>
                {session.name}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#97a3c6", marginTop: 2 }}>
                {roleLabel}{session.repCode ? ` · ${session.repCode}` : ""}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "7px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "#97a3c6",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <div className="sidebar-footer-note">{uiCopy.footerNote}</div>
      </aside>

      <main className="main-content">
        <header className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">{title}</h1>
          </div>
          {session && (
            <div style={{ fontSize: "0.85rem", color: "#97a3c6" }}>
              Welcome back, <strong style={{ color: "#eef2ff" }}>{firstName}</strong>
            </div>
          )}
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
