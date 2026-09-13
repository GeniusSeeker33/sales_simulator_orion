import { Link } from 'react-router-dom';
const explanations = {
  guardian_output_schema_invalid:'Guardian returned an unsupported response shape.',
  constraint_evaluation_mismatch:'Guardian did not provide one valid evaluation per effective rule.',
  effective_policy_changed:'The effective policy changed after this review started.',
  asset_revision_changed:'The asset revision changed after this review started.',
  campaign_revision_changed:'The campaign brief changed after this review started.',
  task_revision_changed:'The assigned task changed after this review started.',
  permission_revoked:'The initiating user no longer had permission to complete this review.',
  run_expired:'The review exceeded its allowed execution window.',
  guardian_persistence_failed:'The server could not confirm that the review result was saved.',
  guardian_model_failed:'The model request did not complete successfully.',
  guardian_result_rejected:'The stored evidence does not identify the precise rejection reason.',
};
export default function GuardianEvidence({ evidence }) {
  if (!evidence) return null;
  return <section aria-label="Guardian technical evidence"><h4>Guardian technical evidence</h4>
    <p>Guardian · {evidence.status} · Stage run <Link to={`/marketing/agents?run=${evidence.id}`}>{evidence.id}</Link></p>
    <p>Asset revision: {evidence.asset_revision}</p>
    <p>Policy snapshot: {(evidence.policy_versions || []).map(p => `${p.source_scope || 'Human review'} ${p.id}`).join(' + ') || 'No structured policy versions'}</p>
    {evidence.error_code && <p>Error: {evidence.error_code}</p>}
    {evidence.technical_reason && <p>Technical reason: {evidence.technical_reason} — {explanations[evidence.technical_reason] || 'Inspect the recorded review evidence.'}</p>}
    <p>Started: {new Date(evidence.started_at).toLocaleString()} · Completed: {evidence.ended_at ? new Date(evidence.ended_at).toLocaleString() : 'Not completed'}</p>
    {evidence.retry_of && <p>Retry of <Link to={`/marketing/agents?run=${evidence.retry_of}`}>{evidence.retry_of}</Link></p>}
  </section>;
}
