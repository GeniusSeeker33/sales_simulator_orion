import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  Building2,
  Phone,
  Trophy,
  TrendingUp,
  Users,
  BarChart3,
  UserCog,
  Gamepad2,
  Medal,
} from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales-simulator", label: "AI Sales Simulator", icon: Gamepad2 },
  { to: "/training", label: "Training", icon: GraduationCap },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/activity", label: "Activity", icon: Phone },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/training-leaderboard", label: "Prize Leaderboard", icon: Medal },
  { to: "/levels", label: "Level Progress", icon: TrendingUp },
  { to: "/rep-metrics", label: "Rep Metrics", icon: BarChart3 },
  { to: "/manager-view", label: "Manager View", icon: UserCog },
  { to: "/employees", label: "Employees", icon: Users },
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