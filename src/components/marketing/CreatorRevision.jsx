import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assetOrchestration, orchestrationRevisionRequest } from '../../lib/marketingRecovery';
import { commandMarketingOrchestration, runMarketingAgent } from '../../lib/marketing';

export default function CreatorRevision({ data, campaign, asset, onRefresh }) {
  const [instructions, setInstructions] = useState(''), [submit, setSubmit] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const orchestration = assetOrchestration(data, asset);
  const recovery = data.orchestration_recovery?.find(c => c.orchestration_id === orchestration?.id);
  async function revise(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (orchestration) await commandMarketingOrchestration(orchestrationRevisionRequest(data, orchestration, instructions));
      else await runMarketingAgent({ workspace_id: data.workspace.id, campaign_id: campaign.id, agent_key: 'creator', purpose: 'Revise human requested changes',
        revision_asset_id: asset.id, expected_asset_revision: asset.revision, expected_campaign_revision: campaign.revision,
        supplemental_instructions: instructions, submit_for_review: submit });
    } catch (e) { setError(e.message); }
    finally { try { await onRefresh(); } catch { setError('Refresh failed. Inspect the run before retrying.'); } setBusy(false); }
  }
  return <form className="marketing-form" onSubmit={revise}>
    <h4>{orchestration ? 'Revise with Agent Team' : 'Send requested changes to Creator'}</h4>
    {orchestration && <><p>This revision will continue the existing task workflow. Creator and constraint preflight run before Guardian; human approval remains a separate decision.</p><p>Revision cycles {orchestration.revision_cycles}/3 · <Link to={`/marketing/campaigns/${campaign.id}?task=${orchestration.task_id}`}>Open task workflow</Link></p>{recovery?.human_change_request && <p>Latest human requested changes: {recovery.human_change_request.notes}</p>}{!recovery?.eligible && <p>{recovery?.reason || 'Refresh to inspect workflow recovery availability.'}</p>}</>}
    <p>Creator receives this revision, the current brief, human change-request notes and matching Guardian findings. Prior evidence is preserved.</p>
    <fieldset className="marketing-fieldset" disabled={busy || (orchestration && !recovery?.eligible)}>
      <label className="form-field"><span>Supplemental revision instructions (optional)</span><textarea maxLength="4000" value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
      {!orchestration && <label><input type="checkbox" checked={submit} onChange={e => setSubmit(e.target.checked)} /> Submit revised asset for human review</label>}
      <button className="btn-primary" type="submit">{busy ? 'Creator revising…' : orchestration ? 'Revise with Agent Team' : 'Send requested changes to Creator'}</button>
    </fieldset>
    {error && <p className="marketing-error" role="alert">{error}</p>}
  </form>;
}
