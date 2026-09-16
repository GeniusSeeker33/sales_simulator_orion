import { reconcileJoinOrionCandidates, APPLICATION_ENTITY } from './join-orion-candidate-import.mjs';
import { validateExclusionManifest } from './join-orion-exclusions.mjs';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Build the read-only recruiter projection from the governed reconciliation result.
 * The recording source ensures this view and the CLI use exactly the same eligibility engine.
 */
export async function buildJoinOrionIntakeReview({ source, target, workspaceId, exclusionManifest }) {
  let snapshot;
  const recordingSource = { read: async () => (snapshot = await source.read()) };
  const report = await reconcileJoinOrionCandidates({
    source: recordingSource, target, workspaceId, exclusionManifest, mode: 'dry-run',
  });
  const validated = exclusionManifest ? validateExclusionManifest(exclusionManifest) : null;
  const excluded = new Set(validated?.manifest.records.map(row => row.application_source_id) ?? []);
  const invalid = new Map(report.invalid_records.filter(row => row.record_type === 'application').map(row => [row.source_id, row.reason]));
  const mapping = new Map(report.skipped_records.filter(row => row.record_type === 'application').map(row => [row.source_id, row.reason]));
  const imported = new Set(report.already_imported_records
    .filter(row => row.source_entity === APPLICATION_ENTITY).map(row => row.source_id));
  const duplicates = new Map(report.potential_duplicates.map(row => [row.source_identity, row]));
  const documents = new Set(snapshot.documents.filter(row => row.document_type === 'resume').map(row => row.application_source_id));

  const items = snapshot.applications.map(application => {
    const id = text(application.source_id);
    const duplicate = duplicates.get(id);
    let state = 'ready_for_review', reason = 'Governed reconciliation found no blocking condition.';
    if (excluded.has(id?.toLowerCase())) { state = 'excluded'; reason = 'Explicitly excluded by the reviewed source exclusion manifest.'; }
    else if (invalid.has(id)) { state = 'invalid'; reason = invalid.get(id); }
    else if (mapping.has(id)) { state = 'source_mapping_attention'; reason = mapping.get(id); }
    else if (imported.has(id)) { state = 'already_imported'; reason = 'CRM provenance shows this source application was already imported.'; }
    else if (duplicate) { state = 'identity_review_required'; reason = duplicate.reason; }
    return {
      source_application_id: id,
      state,
      reason,
      actionable: state === 'ready_for_review' || state === 'identity_review_required',
      ready_for_import: state === 'ready_for_review',
      application_date: application.submitted_at instanceof Date ? application.submitted_at.toISOString() : application.submitted_at,
      candidate_name: [text(application.first_name), text(application.last_name)].filter(Boolean).join(' ') || 'Unnamed candidate',
      position_title: text(application.payload?.position_title),
      position_reference: text(application.job_ref),
      source_status: text(application.payload?.source_status) ?? text(application.source_status) ?? text(application.status),
      application_source: text(application.payload?.application_source),
      recruiter: text(application.owner_ref),
      resume_metadata_exists: documents.has(id),
      duplicate_evidence: duplicate ? {
        categories: duplicate.evidence_categories,
        crm_person_references: duplicate.conflicting_crm_person_refs,
        explanation: duplicate.reason,
      } : null,
      proposed_crm_mapping: { lifecycle_stage: 'applicant', application_type: 'candidate', application_status: application.status },
      provenance: { source_system: report.source_system, source_entity: APPLICATION_ENTITY, source_id: id },
      linkage: { learner: 'not_verified', employment: 'not_verified' },
    };
  });
  const actionableItems = items.filter(item => item.actionable);
  return {
    queue_version: 1,
    workspace: report.target_workspace,
    exclusion_manifest: report.exclusion_manifest,
    actionable_count: actionableItems.length,
    ready_count: actionableItems.filter(item => item.ready_for_import).length,
    identity_review_count: actionableItems.filter(item => item.state === 'identity_review_required').length,
    items: actionableItems,
    diagnostics: {
      invalid_count: items.filter(item => item.state === 'invalid').length,
      source_mapping_attention_count: items.filter(item => item.state === 'source_mapping_attention').length,
      excluded_count: items.filter(item => item.state === 'excluded').length,
      already_imported_count: items.filter(item => item.state === 'already_imported').length,
    },
    refreshed_at: new Date().toISOString(),
    refresh: 'manual',
    approval_boundary: 'read_only',
  };
}
