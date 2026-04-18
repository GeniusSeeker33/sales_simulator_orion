import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/accounts", label: "Accounts" },
  { to: "/training", label: "Training" },
  { to: "/levels", label: "Levels" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/activity", label: "Activity" },
  { to: "/rep-metrics", label: "Rep Metrics" },
];

export default function Layout({ title, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Sales Simulator Orion</h1>
          <p className="sidebar-subtext">Performance, training, and compensation</p>
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