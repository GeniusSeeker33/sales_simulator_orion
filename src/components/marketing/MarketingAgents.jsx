import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { deriveAgentWork } from '../../lib/marketingAgentWork';
import AgentWorkCard from './AgentWorkCard';
import MarketingRunHistory from './MarketingRunHistory';

export default function MarketingAgents({ data, campaign, onRefresh }) {
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  if (campaign) return <MarketingRunHistory data={data} campaign={campaign} onRefresh={onRefresh} />;
  const history = params.get('view') === 'history' || params.has('run');
  const groups = deriveAgentWork(data);
  return <section className="marketing-agent-center">
    <div className="section-header"><div><h2>Agent Team Command Center</h2><p>Current work and human decisions across your workspace.</p></div><button className="btn-secondary" onClick={() => onRefresh().then(() => setError('')).catch(e => setError(e.message))}>Refresh work</button></div>
    <nav className="marketing-nav" aria-label="Agent views"><Link to="/marketing/agents" aria-current={!history ? 'page' : undefined}>Current work</Link><Link to="/marketing/agents?view=history" aria-current={history ? 'page' : undefined}>Run History</Link></nav>
    {error && <p role="alert">{error}</p>}
    {history ? <MarketingRunHistory key={params.get('run') || params.get('task') || 'history'} data={data} onRefresh={onRefresh} /> : <>
      <section aria-labelledby="agent-needs-you"><h2 id="agent-needs-you">Needs You <span>({groups.needsYou.length})</span></h2><p>The Agents badge counts these {groups.needsYou.length} unresolved work items. Related runs and asset decisions are grouped into one card per workflow or standalone asset.</p>{!groups.needsYou.length && <p>No current human action is needed for agent work.</p>}{groups.needsYou.map(work => <AgentWorkCard key={work.id} data={data} work={work} onRefresh={onRefresh} />)}</section>
      <section aria-labelledby="agent-working"><h2 id="agent-working">Working</h2>{!groups.working.length && <p>No agent workflows are currently running.</p>}{groups.working.map(work => <AgentWorkCard key={work.id} data={data} work={work} onRefresh={onRefresh} />)}</section>
      <section aria-labelledby="agent-completed"><h2 id="agent-completed">Recently Completed</h2><p>Latest 10 resolved workflows. Individual stage runs remain in Run History.</p>{!groups.recentlyCompleted.length && <p>No resolved workflows yet.</p>}{groups.recentlyCompleted.slice(0, 10).map(work => <AgentWorkCard key={work.id} data={data} work={work} onRefresh={onRefresh} />)}</section>
    </>}
  </section>;
}
