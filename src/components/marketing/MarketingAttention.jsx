import { Link } from 'react-router-dom';
import { ATTENTION_LEVELS, attentionLevel } from '../../lib/marketingAttention';

export function AttentionIndicator({ items }) {
  const level = attentionLevel(items), presentation = ATTENTION_LEVELS[level];
  return <span className={`marketing-attention-label ${level}`}><span aria-hidden="true">{presentation.icon}</span> {presentation.label}</span>;
}

export default function MarketingAttention({ items, onRefresh }) {
  return <section className="card marketing-attention-panel" aria-labelledby="marketing-attention-heading">
    <div className="section-header"><h2 id="marketing-attention-heading">Needs Your Attention</h2><button className="btn-secondary" onClick={onRefresh}>Refresh attention</button></div>
    <AttentionIndicator items={items} />
    <p>Workspace-wide signals from saved workflow evidence. Review roles still apply. Refresh to check for changes by other people.</p>
    {!items.length && <p>No current human action under the attention rules.</p>}
    <ul className="marketing-attention-list">{items.map(item => <li key={item.id} className={`marketing-attention-item ${item.severity}`}>
      <AttentionIndicator items={[item]} /><strong>{item.campaign}</strong><span>{item.name}</span>
      <p>{item.reason}</p><time dateTime={item.timestamp}>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Timestamp unavailable'}</time>
      <Link className="btn-secondary" to={item.href}>{item.action}</Link>
    </li>)}</ul>
  </section>;
}
