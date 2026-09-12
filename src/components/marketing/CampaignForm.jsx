import { useState } from "react";
import { APPROVAL_STATES, CAMPAIGN_STATUSES, createAttributionKey, splitList } from "../../lib/marketing";

export default function CampaignForm({ campaign, currentUserId, canApprove, canWrite = true, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    id: campaign?.id || crypto.randomUUID(), name: campaign?.name || "", description: campaign?.description || "",
    status: campaign?.status || "draft", approval_state: campaign?.approval_state || "draft",
    objectives: campaign?.objectives?.join(", ") || "", target_audiences: campaign?.target_audiences?.join(", ") || "",
    channels: campaign?.channels?.join(", ") || "", owner_user_id: campaign?.owner_user_id || currentUserId || "",
    budget_amount: campaign?.budget_amount ?? "", budget_currency: campaign?.budget_currency || "USD",
    starts_on: campaign?.starts_on || "", ends_on: campaign?.ends_on || "", attribution_key: campaign?.attribution_key || "",
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault(); setError("");
    if (form.status === "active" && form.approval_state !== "approved") return setError("Only an approved campaign can be activated.");
    setBusy(true);
    try {
      await onSave({ ...form, attribution_key: form.attribution_key || createAttributionKey(form.name, form.id),
        objectives: splitList(form.objectives), target_audiences: splitList(form.target_audiences), channels: splitList(form.channels) });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="card marketing-form" onSubmit={submit}>
    <div className="section-header"><div><h2>{campaign ? "Edit campaign" : "Create campaign"}</h2><p className="section-subtext">Campaign decisions remain human-owned and auditable.</p></div></div>
    {error && <div className="marketing-error" role="alert">{error}</div>}
    <fieldset disabled={!canWrite || busy} className="marketing-fieldset"><div className="marketing-form-grid">
      <label className="form-field marketing-wide"><span>Name</span><input required maxLength="160" name="name" value={form.name} onChange={change} /></label>
      <label className="form-field marketing-wide"><span>Description</span><textarea maxLength="4000" rows="3" name="description" value={form.description} onChange={change} /></label>
      <label className="form-field"><span>Status</span><select name="status" value={form.status} onChange={change}>{CAMPAIGN_STATUSES.map(x => <option key={x}>{x}</option>)}</select></label>
      <label className="form-field"><span>Approval</span><select name="approval_state" value={form.approval_state} onChange={change}>{APPROVAL_STATES.map(x => <option key={x} value={x} disabled={x === "approved" && !canApprove}>{x.replaceAll("_", " ")}</option>)}</select></label>
      <label className="form-field"><span>Start date</span><input type="date" name="starts_on" value={form.starts_on} onChange={change} /></label>
      <label className="form-field"><span>End date</span><input type="date" name="ends_on" value={form.ends_on} onChange={change} /></label>
      <label className="form-field"><span>Budget</span><input min="0" step="0.01" type="number" name="budget_amount" value={form.budget_amount} onChange={change} /></label>
      <label className="form-field"><span>Currency</span><input required pattern="[A-Z]{3}" maxLength="3" name="budget_currency" value={form.budget_currency} onChange={change} /></label>
      <label className="form-field marketing-wide"><span>Objectives (comma separated)</span><input name="objectives" value={form.objectives} onChange={change} /></label>
      <label className="form-field marketing-wide"><span>Target audiences (comma separated)</span><input name="target_audiences" value={form.target_audiences} onChange={change} /></label>
      <label className="form-field marketing-wide"><span>Channels (comma separated)</span><input name="channels" value={form.channels} onChange={change} placeholder="web, social, email, print" /></label>
      <label className="form-field marketing-wide"><span>Attribution key</span><input name="attribution_key" value={form.attribution_key} onChange={change} placeholder="Generated on save" /></label>
    </div>
    <p className="marketing-boundary">Agents may draft and submit for review, but only a human approver can approve. Publishing is intentionally unavailable in this foundation.</p>
    <div className="button-row">{canWrite && <button className="btn-primary" type="submit">{busy ? "Saving…" : "Save campaign"}</button>}<button className="btn-secondary" type="button" onClick={onCancel}>Cancel</button></div></fieldset>
  </form>;
}
