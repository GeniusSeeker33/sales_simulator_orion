import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ASSET_TYPES, TASK_STATUSES, readMarketingAssetHistory, saveMarketingBrief, saveMarketingTask, splitList, writeMarketingAsset } from "../../lib/marketing";

import { AttentionIndicator } from "./MarketingAttention";
import TaskOrchestration from "./TaskOrchestration";
import { ConstraintEditor, ConstraintManager } from "./HumanConstraints";
import CreatorRevision from "./CreatorRevision";
const label = value => value.replaceAll("_", " ");
const briefFields = [
  ["objectives", "Campaign objectives (comma separated)", 4000],
  ["target_audiences", "Audience (comma separated)", 4000],
  ["offer", "Offer / value proposition", 4000],
  ["primary_cta", "Primary CTA", 1000],
  ["key_message", "Key message", 4000],
  ["channels", "Channels (comma separated)", 4000],
  ["requirements", "Constraints / requirements", 8000],
  ["notes", "Notes", 8000],
];

// Mutation errors stay next to the form; failed refreshes never masquerade as success.
function MutationForm({ children, onSave, disabled = false, button = "Save" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <form className="marketing-form" onSubmit={submit}>
    {error && <p className="marketing-error" role="alert">{error}</p>}
    <fieldset disabled={busy || disabled} className="marketing-fieldset">{children}
      {!disabled && <button className="btn-primary" type="submit">{busy ? "Saving…" : button}</button>}
    </fieldset>
  </form>;
}

export default function CampaignWorkflow({ data, campaign, onRefresh }) {
  const [params] = useSearchParams();
  const tasks = data.tasks.filter(t => t.campaign_id === campaign.id);
  const assets = data.assets.filter(a => a.campaign_id === campaign.id);
  const canWrite = data.role !== "viewer";
  return <div className="marketing-workflow">
    <section className="card"><h2>{campaign.name}</h2><AttentionIndicator items={data.attention.filter(item => item.campaign_id === campaign.id)} /><p className="marketing-eyebrow">Brief → Tasks → Assets → QA → Approval</p>
      <p>{tasks.filter(t => t.status === "done").length}/{tasks.length} tasks done · {assets.length} assets · {assets.filter(a => a.approval_state === "in_review").length} awaiting QA · {assets.filter(a => a.approval_state === "approved").length} approved</p>
      <p className="section-subtext">Asset approval records a human review decision. Campaign approval and activation remain separate campaign decisions.</p>
    </section>
    <section className="card"><h2>Campaign brief</h2>
      <BriefForm key={`${campaign.id}:${campaign.revision}`} data={data} campaign={campaign} canWrite={canWrite} onRefresh={onRefresh} />
    </section>
    <section className="card"><h2>Tasks</h2>
      {!tasks.length && <p>No tasks yet. Add the steps needed to execute this brief.</p>}
      {tasks.map(task => <details key={`${task.id}:${task.revision}`} open={params.get("task") === task.id ? true : undefined} className="marketing-record"><summary>{task.title} · {label(task.status)} · Due {task.due_on || "not set"}</summary>
        <TaskForm data={data} campaign={campaign} task={task} canWrite={canWrite} onRefresh={onRefresh} />
        <TaskOrchestration data={data} campaign={campaign} task={task} onRefresh={onRefresh} />
      </details>)}
      {canWrite && <details key={`new:${campaign.id}:${tasks.length}`} className="marketing-record"><summary>Add task</summary><TaskForm data={data} campaign={campaign} canWrite onRefresh={onRefresh} /></details>}
    </section>
    <AssetLibrary data={data} campaign={campaign} onRefresh={onRefresh} />
  </div>;
}

function BriefForm({ data, campaign, canWrite, onRefresh }) {
  const [form, setForm] = useState(() => Object.fromEntries(briefFields.map(([key]) => [key, Array.isArray(campaign[key]) ? campaign[key].join(", ") : campaign[key] || ""])));
  const [metrics, setMetrics] = useState(() => data.kpis.filter(k => k.campaign_id === campaign.id).map(k => ({ name: k.name, target_value: k.target_value ?? "", unit: k.unit })));
  async function save() {
    await saveMarketingBrief(data.workspace.id, campaign, { ...form, objectives: splitList(form.objectives), target_audiences: splitList(form.target_audiences), channels: splitList(form.channels), kpis: metrics });
    await onRefresh();
  }
  return <MutationForm disabled={!canWrite || campaign.status === "active"} onSave={save} button="Save brief">
    <div className="marketing-form-grid">{briefFields.map(([key, title, max]) => <label className="form-field" key={key}><span>{title}</span><textarea rows="2" maxLength={max} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
    <h3>Success metrics</h3>
    {metrics.length === 0 && <p>No success metrics set.</p>}
    {metrics.map((metric, index) => <div className="marketing-metric" key={index}>
      {[['name', 'Metric'], ['target_value', 'Target'], ['unit', 'Unit']].map(([key, title]) => <label className="form-field" key={key}><span>{title}</span><input required={key !== "target_value"} maxLength={key === "name" ? 160 : 80} type={key === "target_value" ? "number" : "text"} step="any" value={metric[key]} onChange={e => setMetrics(metrics.map((m, i) => i === index ? { ...m, [key]: e.target.value } : m))} /></label>)}
      {canWrite && <button type="button" className="btn-secondary" onClick={() => setMetrics(metrics.filter((_, i) => i !== index))}>Remove metric {index + 1}</button>}
    </div>)}
    {canWrite && <button type="button" className="btn-secondary" disabled={metrics.length >= 30} onClick={() => setMetrics([...metrics, { name: "", target_value: "", unit: "count" }])}>Add metric</button>}
    <p className="marketing-boundary">Saving a revised brief resets campaign approval to draft. Pause an active campaign before changing its brief.</p>
  </MutationForm>;
}

function TaskForm({ data, campaign, task, canWrite, onRefresh }) {
  const [form, setForm] = useState(() => ({ title: task?.title || "", status: task?.status || "todo", owner_user_id: task?.owner_user_id || "", due_on: task?.due_on || "" }));
  const [newId] = useState(() => crypto.randomUUID());
  const change = e => setForm({ ...form, [e.target.name]: e.target.value });
  return <MutationForm disabled={!canWrite} button={task ? "Save task" : "Create task"} onSave={async () => { await saveMarketingTask(data.workspace.id, campaign.id, task || { id: newId }, form); await onRefresh(); }}>
    <div className="marketing-form-grid">
      <label className="form-field"><span>Task title</span><input name="title" required maxLength="240" value={form.title} onChange={change} /></label>
      <label className="form-field"><span>Task status</span><select name="status" value={form.status} onChange={change}>{TASK_STATUSES.map(s => <option value={s} key={s}>{label(s)}</option>)}</select></label>
      <label className="form-field"><span>Owner</span><select name="owner_user_id" value={form.owner_user_id} onChange={change}><option value="">Unassigned</option>{data.members.map(m => <option value={m.user_id} key={m.user_id}>{m.user_id} ({m.role})</option>)}</select></label>
      <label className="form-field"><span>Due date</span><input type="date" name="due_on" value={form.due_on} onChange={change} /></label>
    </div>
  </MutationForm>;
}

export function AssetLibrary({ data, campaign, reviewOnly = false, onRefresh }) {
  const [params] = useSearchParams();
  const assets = data.assets.filter(a => (!campaign || a.campaign_id === campaign.id) && (!reviewOnly || ["in_review", "changes_requested"].includes(a.approval_state)));
  return <section className="card"><h2>{reviewOnly ? "Approvals" : campaign ? "Assets, QA & approval" : "Content"}</h2>
    <p>{reviewOnly ? "Assets awaiting human review or a requested revision across this workspace. Open an asset to inspect its brief, content and review history." : "Text drafts and creative briefs linked to their campaign."}</p>
    {!assets.length && <p className="marketing-empty">{reviewOnly ? "No assets awaiting review." : "No assets yet. Create a draft from a campaign."}</p>}
    {assets.map(asset => <details className="marketing-record" open={params.get("asset") === asset.id ? true : undefined} key={`${asset.id}:${asset.revision}`}><summary>{asset.name} · {label(asset.asset_type)} · {label(asset.approval_state)} · <AttentionIndicator items={data.attention.filter(item => item.asset_id === asset.id)} /></summary>
      {params.get("asset") === asset.id && params.get("revision") && Number(params.get("revision")) !== asset.revision && <p role="status">This link referred to revision {params.get("revision")}. The asset is now revision {asset.revision}; review the current content below before deciding. Earlier revisions remain in Asset history.</p>}
      <AssetDetail data={data} asset={asset} onRefresh={onRefresh} />
    </details>)}
    {campaign && data.role !== "viewer" && <details key={`new:${campaign.id}:${assets.length}`} className="marketing-record"><summary>Add draft asset</summary><AssetEditor data={data} campaignId={campaign.id} onRefresh={onRefresh} /></details>}
  </section>;
}

function AssetDetail({ data, asset, onRefresh }) {
  const campaign = data.campaigns.find(c => c.id === asset.campaign_id);
  const canApprove = ["approver", "admin"].includes(data.role);
  const canWrite = data.role !== "viewer" && asset.publication_state === "unpublished";
  const currentConstraints = (data.human_constraint_sets || []).find(s => s.asset_id === asset.id && !s.superseded);
  const [constraintBaseId] = useState(currentConstraints?.id || null);
  const [constraints, setConstraints] = useState(() => (currentConstraints?.constraints || []).map(rule => Object.fromEntries(Object.entries(rule).filter(([key]) => key !== 'id'))));
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState("approve");
  return <div className="marketing-workflow">
    <p>Campaign: <Link to={`/marketing/campaigns/${campaign.id}`}>{campaign.name}</Link> · Asset revision {asset.revision}</p>
    <details><summary>Campaign context</summary><dl className="marketing-context">{briefFields.map(([key, title]) => <div key={key}><dt>{title.replace(" (comma separated)", "")}</dt><dd>{Array.isArray(campaign[key]) ? campaign[key].join(", ") || "Not set" : campaign[key] || "Not set"}</dd></div>)}</dl>
      <h4>Success metrics</h4>{data.kpis.filter(k => k.campaign_id === campaign.id).map(k => <p key={k.id}>{k.name}: {k.target_value ?? "Not set"} {k.unit}</p>)}
    </details>
    <p className="section-subtext">Created by {asset.created_by} via {asset.created_via} · {new Date(asset.created_at).toLocaleString()}</p>
    <pre className="marketing-asset-content">{asset.content || "Empty draft"}</pre>
    <ConstraintManager key={currentConstraints?.id || "none"} data={data} asset={asset} onRefresh={onRefresh} />
    {canWrite && asset.approval_state !== "in_review" && <details><summary>Edit draft{asset.approval_state === "approved" ? " (resets approval)" : ""}</summary><AssetEditor data={data} campaignId={campaign.id} asset={asset} onRefresh={onRefresh} /></details>}
    {canWrite && ["draft", "changes_requested"].includes(asset.approval_state) && <MutationForm button="Submit for review" onSave={async () => { await writeMarketingAsset(data.workspace.id, campaign.id, asset, "submit", {}); await onRefresh(); }}><p>Submit this saved revision for human QA review.</p></MutationForm>}
    {canApprove && asset.approval_state === "in_review" && <MutationForm button="Record human decision" onSave={async () => { await writeMarketingAsset(data.workspace.id, campaign.id, asset, action, { notes, ...(action === "request_changes" ? { human_constraints: constraints, constraint_set_id: constraintBaseId } : {}) }); await onRefresh(); }}>
      <label className="form-field"><span>Review decision</span><select value={action} onChange={e => setAction(e.target.value)}><option value="approve">Approve</option><option value="request_changes">Request changes</option></select></label>
      <label className="form-field"><span>Review notes / requested changes</span><textarea rows="3" required={action === "request_changes"} maxLength="8000" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {action === "request_changes" && <ConstraintEditor value={constraints} onChange={setConstraints} />}
      <p className="marketing-boundary">Your decision and the reviewed asset revision will be preserved in the audit history.</p>
    </MutationForm>}
    {!canApprove && asset.approval_state === "in_review" && <p>A workspace approver or admin must review this asset.</p>}
    {canWrite && asset.created_via === "agent" && asset.approval_state === "changes_requested" && <CreatorRevision data={data} campaign={campaign} asset={asset} onRefresh={onRefresh} />}
    <AssetHistory workspaceId={data.workspace.id} assetId={asset.id} />
  </div>;
}

function AssetEditor({ data, campaignId, asset, onRefresh }) {
  const [form, setForm] = useState(() => ({ name: asset?.name || "", asset_type: asset?.asset_type || "social_copy", content: asset?.content || "" }));
  const [newId] = useState(() => crypto.randomUUID());
  return <MutationForm button={asset ? "Save draft" : "Create draft asset"} onSave={async () => { await writeMarketingAsset(data.workspace.id, campaignId, asset || { id: newId }, "save", form); await onRefresh(); }}>
    <label className="form-field"><span>Asset name</span><input required maxLength="160" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label className="form-field"><span>Asset type</span><select value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })}>{ASSET_TYPES.map(t => <option value={t} key={t}>{label(t)}</option>)}</select></label>
    <label className="form-field"><span>Draft content</span><textarea rows="10" maxLength="50000" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></label>
  </MutationForm>;
}

function AssetHistory({ workspaceId, assetId }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let current = true;
    readMarketingAssetHistory(workspaceId, assetId).then(result => { if (current) setHistory(result); }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [workspaceId, assetId, open]);
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>Review & revision history</summary>
    {error && <p className="marketing-error" role="alert">{error}</p>}
    {!history && !error && <p>Loading history…</p>}
    {history?.length === 0 && <p>No workflow history recorded for this legacy asset.</p>}
    {history?.map(h => <article className="marketing-record" key={h.id}><strong>{label(h.action)} · revision {h.snapshot.revision}</strong>
      <p>{h.actor_user_id} ({h.actor_type}) · {new Date(h.occurred_at).toLocaleString()}</p>{h.agent_run_id && <Link to={`/marketing/agents?run=${h.agent_run_id}`}>Inspect agent run {h.agent_run_id}</Link>}<p className="marketing-preserve">{h.notes || "No review notes"}</p>
      <details><summary>Recorded asset content</summary><pre className="marketing-asset-content">{h.snapshot.content}</pre></details>
    </article>)}
  </details>;
}
