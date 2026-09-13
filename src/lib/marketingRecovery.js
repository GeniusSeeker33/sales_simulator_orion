// Requests carry the exact read-model versions the human inspected. The server rechecks all of them.
export function orchestrationRevisionRequest(data, orchestration, instructions = '') {
  const context = data.orchestration_recovery?.find(c => c.orchestration_id === orchestration.id);
  if (!context?.eligible) throw new Error(context?.reason || 'Refresh the workflow before requesting a revision.');
  return { workspace_id: data.workspace.id, id: orchestration.id, action: 'revise', expected_revision: orchestration.revision,
    asset_revision: context.asset_revision, task_revision: context.task_revision, campaign_revision: context.campaign_revision,
    constraint_set_ids: context.constraint_set_ids, instructions };
}

export function assetOrchestration(data, asset) {
  return (data.orchestrations || []).filter(o => o.workspace_id === data.workspace.id && o.campaign_id === asset.campaign_id && o.asset_id === asset.id)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
}
