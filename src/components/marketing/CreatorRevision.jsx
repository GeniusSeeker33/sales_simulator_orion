import { useState } from 'react';
import { runMarketingAgent } from '../../lib/marketing';

export default function CreatorRevision({ data, campaign, asset, onRefresh }) {
  const [instructions, setInstructions] = useState(''), [submit, setSubmit] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function revise(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await runMarketingAgent({ workspace_id: data.workspace.id, campaign_id: campaign.id, agent_key: 'creator', purpose: 'Revise human requested changes',
        revision_asset_id: asset.id, expected_asset_revision: asset.revision, expected_campaign_revision: campaign.revision,
        supplemental_instructions: instructions, submit_for_review: submit });
    } catch (e) { setError(e.message); }
    finally { try { await onRefresh(); } catch { setError('Refresh failed. Inspect the run before retrying.'); } setBusy(false); }
  }
  return <form className="marketing-form" onSubmit={revise}>
    <h4>Send requested changes to Creator</h4>
    <p>Creator receives this revision, the current brief, human change-request notes and matching Guardian findings. Prior evidence is preserved.</p>
    <fieldset className="marketing-fieldset" disabled={busy}>
      <label className="form-field"><span>Supplemental revision instructions (optional)</span><textarea maxLength="4000" value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
      <label><input type="checkbox" checked={submit} onChange={e => setSubmit(e.target.checked)} /> Submit revised asset for human review</label>
      <button className="btn-primary" type="submit">{busy ? 'Creator revising…' : 'Send requested changes to Creator'}</button>
    </fieldset>
    {error && <p className="marketing-error" role="alert">{error}</p>}
  </form>;
}
