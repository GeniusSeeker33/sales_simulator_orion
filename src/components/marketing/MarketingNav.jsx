import { NavLink } from "react-router-dom";
import { attentionCounts, attentionLevel, ATTENTION_LEVELS } from '../../lib/marketingAttention';

const sections = [
  ["overview", "Overview"], ["campaigns", "Campaigns"], ["content", "Content"],
  ["approvals", "Approvals"], ["agents", "Agents"], ["analytics", "Analytics"], ["settings", "Settings"],
];

export default function MarketingNav({ items, agentWork = [] }) {
  const counts = { ...attentionCounts(items), agents: agentWork.length };
  const agentItems = agentWork.map(w => ({ severity: w.severity }));
  return <nav className="marketing-nav" aria-label="Marketing workspace">
    {sections.map(([path, label]) => {
      const level = attentionLevel(path === 'agents' ? agentItems : items.filter(item => item.scope === path));
      return <NavLink key={path} aria-label={label} aria-describedby={counts[path] ? `attention-count-${path}` : undefined} to={`/marketing/${path}`} className={({ isActive }) => isActive ? "active" : ""}>{label}
        {counts[path] > 0 && <span id={`attention-count-${path}`} className={`marketing-attention-label ${level}`} aria-label={`${counts[path]} unresolved items: ${ATTENTION_LEVELS[level].label}`}>{ATTENTION_LEVELS[level].icon} {counts[path]}</span>}
      </NavLink>;
    })}
  </nav>;
}
