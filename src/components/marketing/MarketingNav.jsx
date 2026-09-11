import { NavLink } from "react-router-dom";

const sections = [
  ["overview", "Overview"], ["campaigns", "Campaigns"], ["content", "Content"],
  ["approvals", "Approvals"], ["agents", "Agents"], ["analytics", "Analytics"], ["settings", "Settings"],
];

export default function MarketingNav() {
  return <nav className="marketing-nav" aria-label="Marketing workspace">
    {sections.map(([path, label]) => <NavLink key={path} to={`/marketing/${path}`} className={({ isActive }) => isActive ? "active" : ""}>{label}</NavLink>)}
  </nav>;
}
