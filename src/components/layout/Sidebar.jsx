import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  Building2,
  Phone,
  Trophy,
  TrendingUp,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/activity", label: "Activity", icon: Phone },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/levels", label: "Level Progress", icon: TrendingUp },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">O</div>
        <div>
          <div className="brand-title">Orion</div>
          <div className="brand-subtitle">Sales Simulator</div>
        </div>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}