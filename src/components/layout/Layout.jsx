import { NavLink } from "react-router-dom";
import { uiCopy } from "../../data/uiCopy";

const navItems = [
  { to: "/dashboard", label: uiCopy.nav.dashboard },
  { to: "/accounts", label: uiCopy.nav.accounts },
  { to: "/training", label: uiCopy.nav.training },
  { to: "/levels", label: uiCopy.nav.levels },
  { to: "/leaderboard", label: uiCopy.nav.leaderboard },
  { to: "/activity", label: uiCopy.nav.activity },
  { to: "/rep-metrics", label: uiCopy.nav.repMetrics },
  { to: "/manager-view", label: uiCopy.nav.managerView },
];

export default function Layout({ title, children }) {
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
          {uiCopy.footerNote}
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