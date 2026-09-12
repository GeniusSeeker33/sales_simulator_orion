import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import MarketingNav from "../../components/marketing/MarketingNav";
import CampaignForm from "../../components/marketing/CampaignForm";
import CampaignWorkflow, { AssetLibrary } from "../../components/marketing/CampaignWorkflow";
import { useAuth } from "../../context/AuthContext";
import { readMarketingWorkspace, saveMarketingCampaign } from "../../lib/marketing";

const FUTURE = {
  agents: ["Agents", "Agent orchestration is deferred; agent-run attribution and safety constraints are ready."],
  analytics: ["Analytics", "Cross-channel event ingestion and reporting are deferred; attribution-ready events are modeled."],
  settings: ["Settings", "Workspace membership and configuration remain administrator-provisioned for now."],
};

const label = value => value.replaceAll("_", " ");
const money = (amount, currency = "USD") => amount == null ? "Not set" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export default function MarketingWorkspace() {
  const { section = "overview", campaignId } = useParams();
  const { session } = useAuth(); const navigate = useNavigate();
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function load() { const result = await readMarketingWorkspace(data?.workspace?.id); setData(result); setError(""); }
  useEffect(() => {
    let current = true;
    readMarketingWorkspace()
      .then(result => { if (current) setData(result); })
      .catch(nextError => { if (current) setError(nextError.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  const campaign = useMemo(() => data?.campaigns?.find(c => c.id === campaignId), [data, campaignId]);
  const canApprove = ["approver", "admin"].includes(data?.role);
  async function save(item) { await saveMarketingCampaign(data.workspace.id, item, campaign?.revision ?? null); await load(); navigate(`/marketing/campaigns/${item.id}`); }
  if (!section || !["overview", "campaigns", "content", "approvals", ...Object.keys(FUTURE)].includes(section)) return <Navigate to="/marketing/overview" replace />;
  return <Layout title="Marketing Command Center">
    <div className="marketing-heading"><div><span className="marketing-eyebrow">{data?.workspace?.name || "Workspace"}</span><p>Plan accountable, attributable campaigns with a human approval boundary.</p></div>{data && <span className="status-pill status-neutral">{label(data.role)}</span>}</div>
    <MarketingNav />
    {loading && <div className="card">Loading marketing workspace…</div>}
    {error && <div className="card marketing-error"><strong>Workspace unavailable.</strong><p>{error}</p><p>A marketing administrator must provision workspace membership.</p></div>}
    {!loading && data && section === "overview" && <Overview campaigns={data.campaigns} />}
    {!loading && data && section === "campaigns" && (campaignId === "new" || campaign ?
      campaign ? <><CampaignWorkflow data={data} campaign={campaign} onRefresh={load} /><details className="card marketing-record"><summary>Campaign settings & campaign approval</summary><CampaignForm key={`${campaign.id}:${campaign.revision}`} campaign={campaign} currentUserId={session.id} canApprove={canApprove} canWrite={data.role !== "viewer"} onSave={save} onCancel={() => navigate("/marketing/campaigns")} /></details></> :
      <CampaignForm key="new" currentUserId={session.id} canApprove={canApprove} canWrite={data.role !== "viewer"} onSave={save} onCancel={() => navigate("/marketing/campaigns")} /> :
      campaignId ? <div className="card marketing-error">Campaign not found. <Link to="/marketing/campaigns">Return to campaigns</Link>.</div> :
      <Campaigns campaigns={data.campaigns} canWrite={data.role !== "viewer"} />)}
    {!loading && data && ["content", "approvals"].includes(section) && <AssetLibrary key={section} data={data} reviewOnly={section === "approvals"} onRefresh={load} />}
    {!loading && data && FUTURE[section] && <Future title={FUTURE[section][0]} description={FUTURE[section][1]} />}
  </Layout>;
}

function Overview({ campaigns }) {
  const totalBudget = campaigns.reduce((sum, c) => sum + Number(c.budget_amount || 0), 0);
  const review = campaigns.filter(c => c.approval_state === "in_review").length;
  return <><section className="kpi-grid"><Kpi label="Campaigns" value={campaigns.length} note="Across this workspace"/><Kpi label="Active" value={campaigns.filter(c=>c.status==="active").length} note="Human-approved campaigns"/><Kpi label="Awaiting review" value={review} note="Human action required"/><Kpi label="Planned budget" value={money(totalBudget)} note="Campaign budgets entered"/></section>
    <div className="card"><div className="section-header"><div><h2>Recent campaigns</h2><p className="section-subtext">Latest campaign plans and approval state.</p></div><Link className="btn-primary" to="/marketing/campaigns/new">New campaign</Link></div><CampaignTable campaigns={campaigns}/></div></>;
}
function Kpi({label,value,note}) { return <div className="card"><div className="card-label">{label}</div><div className="card-value">{value}</div><div className="card-note">{note}</div></div>; }
function Campaigns({ campaigns, canWrite }) { return <div className="card"><div className="section-header"><div><h2>Campaigns</h2><p className="section-subtext">Create, plan and review workspace campaigns.</p></div>{canWrite && <Link className="btn-primary" to="/marketing/campaigns/new">New campaign</Link>}</div><CampaignTable campaigns={campaigns}/></div>; }
function CampaignTable({ campaigns }) { return campaigns.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign</th><th>Status</th><th>Approval</th><th>Dates</th><th>Budget</th></tr></thead><tbody>{campaigns.map(c=><tr key={c.id}><td><Link className="marketing-campaign-link" to={`/marketing/campaigns/${c.id}`}>{c.name}</Link><div className="admin-table-sub">{c.attribution_key}</div></td><td><span className="marketing-chip">{label(c.status)}</span></td><td><span className="marketing-chip">{label(c.approval_state)}</span></td><td>{c.starts_on || "—"} → {c.ends_on || "—"}</td><td>{money(c.budget_amount,c.budget_currency)}</td></tr>)}</tbody></table></div> : <div className="marketing-empty"><strong>No campaigns yet.</strong><p>Create the first attributable campaign for this workspace.</p></div>; }
function Future({ title, description }) { return <div className="card marketing-future"><span className="marketing-eyebrow">Future module</span><h2>{title}</h2><p>{description}</p><p>No simulated workflows or placeholder metrics are shown.</p></div>; }
