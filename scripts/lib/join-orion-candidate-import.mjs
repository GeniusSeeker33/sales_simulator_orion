import { createHash } from 'node:crypto';

export const SOURCE_SYSTEM = 'join-orion';
export const APPLICATION_ENTITY = 'candidate_applications';
export const ACTIVITY_ENTITY = 'candidate_activity';

export const APPLICATION_STATUS_MAP = Object.freeze({
  draft: 'draft', submitted: 'submitted', in_review: 'in_review', qualified: 'qualified',
  approved: 'approved', rejected: 'rejected', withdrawn: 'withdrawn', hired: 'hired',
});
export const ACTIVITY_TYPE_MAP = Object.freeze({
  form_submission: 'form_submission', note: 'note', call: 'call', email: 'email',
  meeting: 'meeting', interview: 'interview', status_change: 'status_change', task: 'task', document: 'document',
});

const nonEmpty = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const timestamp = value => {
  if (!nonEmpty(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
};
const normalizedEmail = value => nonEmpty(value)?.toLowerCase() ?? null;
const provenanceKey = (entity, id) => `${SOURCE_SYSTEM}\u0000${entity}\u0000${id}`;
const sorted = values => [...values].sort((a, b) => a.localeCompare(b));

function issue(kind, recordType, sourceId, reason, extra = {}) {
  return { kind, record_type: recordType, source_id: sourceId ?? null, reason, ...extra };
}

export function validateCanonicalExport(input) {
  if (!input || input.contract_version !== 1 || !Array.isArray(input.applications) ||
      !Array.isArray(input.activities) || !Array.isArray(input.documents) || !Array.isArray(input.consents)) {
    throw new Error('Source adapter must return canonical contract_version 1 with applications, activities, documents, and consents arrays');
  }
  return input;
}

/** Reconcile a verified, canonical adapter export. The function itself never writes. */
export async function reconcileJoinOrionCandidates({ source, target, workspaceId, mode = 'dry-run', operator = null }) {
  if (!nonEmpty(workspaceId)) throw new Error('A target workspace is required');
  if (mode !== 'dry-run' && mode !== 'apply') throw new Error('Mode must be dry-run or apply');
  if (mode === 'apply' && !nonEmpty(operator)) throw new Error('Apply mode requires an attributable operator');

  const snapshot = validateCanonicalExport(await source.read());
  if (mode === 'apply') {
    const revalidated = validateCanonicalExport(await source.read());
    if (JSON.stringify(revalidated) !== JSON.stringify(snapshot)) {
      throw new Error('Source changed between validation reads; no writes were attempted');
    }
  }
  const workspace = await target.getWorkspace(workspaceId);
  if (!workspace || workspace.id !== workspaceId) throw new Error('Target workspace does not exist or does not match the requested workspace');
  const state = await target.inspect(workspaceId, SOURCE_SYSTEM);
  if (state.workspace_id !== workspaceId) throw new Error('Target adapter returned foreign-workspace state');

  const invalid = [], skipped = [], conflicts = [], duplicateQueue = [];
  const identities = new Map(), applications = [], activities = [], documents = [], consents = [];
  const seen = { applications: new Set(), activities: new Set(), documents: new Set(), consents: new Set() };

  for (const raw of snapshot.applications) {
    const sourceId = nonEmpty(raw.source_id), identityId = nonEmpty(raw.source_identity_id);
    if (!sourceId || !identityId || (!nonEmpty(raw.first_name) && !nonEmpty(raw.last_name)) || !timestamp(raw.submitted_at)) {
      invalid.push(issue('invalid', 'application', sourceId, 'missing authoritative ID, source identity, candidate name, or valid submitted_at'));
      continue;
    }
    if (seen.applications.has(sourceId)) {
      invalid.push(issue('invalid', 'application', sourceId, 'duplicate authoritative source application ID')); continue;
    }
    seen.applications.add(sourceId);
    const status = APPLICATION_STATUS_MAP[nonEmpty(raw.status)];
    if (!status) {
      skipped.push(issue('skipped', 'application', sourceId, 'unknown application status', { source_status: raw.status ?? null })); continue;
    }
    const person = { source_id: identityId, first_name: nonEmpty(raw.first_name) ?? '', last_name: nonEmpty(raw.last_name) ?? '',
      preferred_name: nonEmpty(raw.preferred_name) ?? '', email: nonEmpty(raw.email), phone: nonEmpty(raw.phone) };
    const prior = identities.get(identityId);
    if (prior && (normalizedEmail(prior.email) !== normalizedEmail(person.email) || prior.first_name !== person.first_name || prior.last_name !== person.last_name)) {
      conflicts.push({ source_identity: identityId, conflicting_crm_person_refs: [], reason: 'inconsistent identity fields across source applications',
        evidence_categories: ['authoritative_source_id', 'contact_fields'], recommended_action: 'verify source provenance' });
      skipped.push(issue('skipped', 'application', sourceId, 'source identity has conflicting fields')); continue;
    }
    identities.set(identityId, prior ?? person);
    applications.push({ source_id: sourceId, source_identity_id: identityId, status, job_ref: nonEmpty(raw.job_ref),
      submitted_at: timestamp(raw.submitted_at), assigned_source_ref: nonEmpty(raw.owner_ref),
      source_created_at: timestamp(raw.source_created_at), source_updated_at: timestamp(raw.source_updated_at),
      payload: raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload) ? raw.payload : {} });
  }

  const usableIdentityIds = new Set(applications.map(row => row.source_identity_id));
  for (const identityId of [...identities.keys()]) if (!usableIdentityIds.has(identityId)) identities.delete(identityId);
  const emails = new Map();
  for (const person of identities.values()) if (normalizedEmail(person.email)) {
    const email = normalizedEmail(person.email), list = emails.get(email) ?? []; list.push(person.source_id); emails.set(email, list);
  }
  for (const [email, ids] of emails) if (ids.length > 1) for (const identityId of sorted(ids)) duplicateQueue.push({
    source_identity: identityId, conflicting_crm_person_refs: [], reason: 'distinct source identities share an email',
    evidence_categories: ['email'], recommended_action: 'review identity', email,
  });
  for (const person of identities.values()) {
    const exact = state.people_by_provenance[provenanceKey(APPLICATION_ENTITY, person.source_id)];
    const matches = (state.people_by_email[normalizedEmail(person.email)] ?? []).filter(id => id !== exact?.id);
    if (!exact && matches.length) duplicateQueue.push({ source_identity: person.source_id, conflicting_crm_person_refs: sorted(matches),
      reason: 'email matches CRM person without governed Join-Orion provenance', evidence_categories: ['email'], recommended_action: 'review identity' });
  }

  const validApplications = new Set(applications.map(row => row.source_id));
  for (const raw of snapshot.activities) {
    const sourceId = nonEmpty(raw.source_id), identityId = nonEmpty(raw.source_identity_id), type = ACTIVITY_TYPE_MAP[nonEmpty(raw.type)];
    if (!sourceId || !identityId || !nonEmpty(raw.summary) || !timestamp(raw.occurred_at)) {
      invalid.push(issue('invalid', 'activity', sourceId, 'missing authoritative ID, source identity, summary, or valid occurred_at')); continue;
    }
    if (seen.activities.has(sourceId)) { invalid.push(issue('invalid', 'activity', sourceId, 'duplicate authoritative source activity ID')); continue; }
    seen.activities.add(sourceId);
    if (!type) { skipped.push(issue('skipped', 'activity', sourceId, 'unknown activity type', { source_type: raw.type ?? null })); continue; }
    if (!usableIdentityIds.has(identityId)) { skipped.push(issue('skipped', 'activity', sourceId, 'source identity has no importable application')); continue; }
    const applicationId = nonEmpty(raw.application_source_id);
    if (applicationId && !validApplications.has(applicationId) && !state.application_ids[provenanceKey(APPLICATION_ENTITY, applicationId)]) {
      skipped.push(issue('skipped', 'activity', sourceId, 'referenced application is not importable')); continue;
    }
    activities.push({ source_id: sourceId, source_identity_id: identityId, application_source_id: applicationId,
      type, direction: ['inbound', 'outbound', 'internal'].includes(raw.direction) ? raw.direction : null,
      summary: raw.summary.trim(), occurred_at: timestamp(raw.occurred_at), metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {} });
  }

  for (const raw of snapshot.documents) {
    const sourceId = nonEmpty(raw.source_id), identityId = nonEmpty(raw.source_identity_id), storagePath = nonEmpty(raw.storage_path);
    if (!sourceId || !identityId || !nonEmpty(raw.document_type) || !storagePath || storagePath.includes('://')) {
      invalid.push(issue('invalid', 'document', sourceId, 'requires authoritative IDs, type, and an opaque non-URL storage_path')); continue;
    }
    if (seen.documents.has(sourceId)) { invalid.push(issue('invalid', 'document', sourceId, 'duplicate authoritative source document ID')); continue; }
    seen.documents.add(sourceId);
    if (!usableIdentityIds.has(identityId)) { skipped.push(issue('skipped', 'document', sourceId, 'source identity has no importable application')); continue; }
    documents.push({ source_id: sourceId, source_identity_id: identityId, application_source_id: nonEmpty(raw.application_source_id),
      source_entity: nonEmpty(raw.source_entity), document_type: raw.document_type.trim(), storage_path: storagePath,
      original_filename: nonEmpty(raw.original_filename), metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {} });
  }

  for (const raw of snapshot.consents) {
    const sourceId = nonEmpty(raw.source_id), identityId = nonEmpty(raw.source_identity_id), capturedAt = timestamp(raw.captured_at);
    if (!sourceId || !identityId || !['email','phone','sms','postal','other'].includes(raw.channel) ||
        !['unknown','opted_in','opted_out'].includes(raw.status) || !nonEmpty(raw.purpose) || !capturedAt ||
        !raw.evidence || typeof raw.evidence !== 'object' || Array.isArray(raw.evidence) || !Object.keys(raw.evidence).length) {
      invalid.push(issue('invalid', 'consent', sourceId, 'consent requires authoritative IDs, valid values, timestamp, purpose, and actual evidence')); continue;
    }
    if (seen.consents.has(sourceId)) { invalid.push(issue('invalid', 'consent', sourceId, 'duplicate authoritative source consent ID')); continue; }
    seen.consents.add(sourceId);
    if (!usableIdentityIds.has(identityId)) { skipped.push(issue('skipped', 'consent', sourceId, 'source identity has no importable application')); continue; }
    consents.push({ source_id: sourceId, source_identity_id: identityId, source_entity: nonEmpty(raw.source_entity), channel: raw.channel,
      status: raw.status, purpose: raw.purpose.trim(), captured_at: capturedAt, evidence: raw.evidence });
  }

  const already = [];
  const absent = (entity, rows) => rows.filter(row => {
    const exists = state.provenance.has(provenanceKey(row.source_entity ?? entity, row.source_id));
    if (exists) already.push({ source_entity: row.source_entity ?? entity, source_id: row.source_id });
    return !exists;
  });
  const people = [...identities.values()].filter(row => {
    const exists = state.provenance.has(provenanceKey(APPLICATION_ENTITY, row.source_id));
    if (exists) already.push({ source_entity: APPLICATION_ENTITY, source_id: row.source_id });
    return !exists;
  });
  const plan = { people, applications: absent(APPLICATION_ENTITY, applications), activities: absent(ACTIVITY_ENTITY, activities),
    documents: absent(null, documents.filter(d => d.source_entity)), consents: absent(null, consents.filter(c => c.source_entity)) };
  for (const row of documents.filter(d => !d.source_entity)) skipped.push(issue('skipped', 'document', row.source_id, 'verified source_entity is required'));
  for (const row of consents.filter(c => !c.source_entity)) skipped.push(issue('skipped', 'consent', row.source_id, 'verified source_entity is required'));

  const digest = createHash('sha256').update(JSON.stringify({ workspaceId, snapshot })).digest('hex').slice(0, 20);
  const report = { report_version: 1, run_id: `join-orion-${digest}-${mode}`, source_system: SOURCE_SYSTEM,
    target_workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name }, mode, operator: operator ?? null,
    inspected: { source_applications: snapshot.applications.length, source_activities: snapshot.activities.length,
      source_documents: snapshot.documents.length, source_consents: snapshot.consents.length, unique_source_identities: new Set(snapshot.applications.map(r => nonEmpty(r.source_identity_id)).filter(Boolean)).size },
    proposed: { people: plan.people.length, applications: plan.applications.length, activities: plan.activities.length,
      documents: plan.documents.length, consents: plan.consents.length }, already_imported: already.length,
    already_imported_records: already, updates: 0,
    potential_duplicates: duplicateQueue, identity_conflicts: conflicts, invalid_records: invalid, skipped_records: skipped,
    writes_performed: 0, batches: [], generated_at: new Date().toISOString() };
  if (mode === 'apply') {
    const result = await target.apply({ workspaceId, sourceSystem: SOURCE_SYSTEM, operator: operator.trim(), runId: report.run_id, plan });
    report.writes_performed = result.writes;
    report.batches = result.batches;
  }
  return report;
}

export function formatReconciliationReport(report) {
  const line = (label, value) => `${label.padEnd(28)} ${String(value).padStart(6)}`;
  return ['Join-Orion Candidate Reconciliation', '', line('Source applications:', report.inspected.source_applications),
    line('Source activities:', report.inspected.source_activities), line('Unique source identities:', report.inspected.unique_source_identities), '',
    line('Proposed people:', report.proposed.people), line('Proposed applications:', report.proposed.applications),
    line('Proposed activities:', report.proposed.activities), line('Proposed documents:', report.proposed.documents),
    line('Proposed consents:', report.proposed.consents), '', line('Already imported:', report.already_imported),
    line('Potential duplicates:', report.potential_duplicates.length), line('Identity conflicts:', report.identity_conflicts.length),
    line('Invalid records:', report.invalid_records.length), line('Skipped:', report.skipped_records.length), '',
    line('Writes performed:', report.writes_performed), `Mode: ${report.mode === 'apply' ? 'APPLY' : 'DRY RUN'}`,
    `Run: ${report.run_id}`, `Workspace: ${report.target_workspace.name} (${report.target_workspace.id})`].join('\n');
}
