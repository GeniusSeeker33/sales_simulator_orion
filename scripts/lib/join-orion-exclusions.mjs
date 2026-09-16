import { createHash } from 'node:crypto';

export const EXCLUSION_SOURCE_SYSTEM = 'join-orion';
export const EXCLUSION_MANIFEST_VERSION = 1;
export const SUPPORTED_EXCLUSION_CLASSIFICATIONS = Object.freeze(['historical_test_data']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredText = (value, field, index) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Exclusion record ${index} requires non-empty ${field}`);
  return value.trim();
};

/** Validate and canonicalize the operator-controlled manifest. No candidate fields are accepted or inspected. */
export function validateExclusionManifest(input) {
  if (!input || input.manifest_version !== EXCLUSION_MANIFEST_VERSION) throw new Error('Exclusion manifest_version must be 1');
  if (input.source_system !== EXCLUSION_SOURCE_SYSTEM) throw new Error('Exclusion source_system must be join-orion');
  if (!Array.isArray(input.records)) throw new Error('Exclusion manifest records must be an array');
  const seen = new Set();
  const records = input.records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`Exclusion record ${index} must be an object`);
    const application_source_id = requiredText(record.application_source_id, 'application_source_id', index).toLowerCase();
    if (!UUID.test(application_source_id)) throw new Error(`Exclusion record ${index} has malformed application UUID`);
    if (seen.has(application_source_id)) throw new Error(`Duplicate exclusion manifest entry: ${application_source_id}`);
    seen.add(application_source_id);
    const classification = requiredText(record.classification, 'classification', index);
    if (!SUPPORTED_EXCLUSION_CLASSIFICATIONS.includes(classification)) throw new Error(`Unsupported exclusion classification: ${classification}`);
    const reason = requiredText(record.reason, 'reason', index);
    const reviewed_by = requiredText(record.reviewed_by, 'reviewed_by', index);
    const reviewed_at = requiredText(record.reviewed_at, 'reviewed_at', index);
    const parsed = new Date(reviewed_at);
    if (Number.isNaN(parsed.valueOf()) || !/[zZ]|[+-]\d\d:\d\d$/.test(reviewed_at)) throw new Error(`Exclusion record ${index} has invalid review timestamp`);
    return { application_source_id, classification, reason, reviewed_by, reviewed_at: parsed.toISOString() };
  }).sort((a, b) => a.application_source_id.localeCompare(b.application_source_id));
  const manifest = { manifest_version: EXCLUSION_MANIFEST_VERSION, source_system: EXCLUSION_SOURCE_SYSTEM, records };
  const fingerprint = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  return { manifest, fingerprint };
}

export function applyExclusions(snapshot, validated) {
  if (!validated) return { snapshot, metadata: null, excluded: { applications: 0, activities: 0, documents: 0, consents: 0, classification_counts: {} } };
  const ids = new Set(validated.manifest.records.map(row => row.application_source_id));
  const sourceIds = new Set(snapshot.applications.map(row => String(row.source_id).toLowerCase()));
  const unmatched = [...ids].filter(id => !sourceIds.has(id)).sort();
  if (unmatched.length) {
    const error = new Error(`Exclusion manifest contains application IDs not found in source: ${unmatched.join(', ')}`);
    error.unmatched_manifest_ids = unmatched;
    throw error;
  }
  const belongsToExcludedApplication = row => {
    const applicationId = row?.application_source_id ?? (row?.identity_scope === 'application' ? row?.source_identity_id : null);
    return typeof applicationId === 'string' && ids.has(applicationId.toLowerCase());
  };
  const excluded = {
    applications: snapshot.applications.filter(row => ids.has(String(row.source_id).toLowerCase())).length,
    activities: snapshot.activities.filter(belongsToExcludedApplication).length,
    documents: snapshot.documents.filter(belongsToExcludedApplication).length,
    consents: snapshot.consents.filter(belongsToExcludedApplication).length,
    classification_counts: {},
  };
  for (const row of validated.manifest.records) excluded.classification_counts[row.classification] = (excluded.classification_counts[row.classification] ?? 0) + 1;
  return {
    snapshot: { ...snapshot,
      applications: snapshot.applications.filter(row => !ids.has(String(row.source_id).toLowerCase())),
      activities: snapshot.activities.filter(row => !belongsToExcludedApplication(row)),
      documents: snapshot.documents.filter(row => !belongsToExcludedApplication(row)),
      consents: snapshot.consents.filter(row => !belongsToExcludedApplication(row)) },
    excluded,
    metadata: { manifest_version: validated.manifest.manifest_version, fingerprint: validated.fingerprint,
      manifest_entries: validated.manifest.records.length, source_records_found: ids.size, unmatched_manifest_ids: [],
      reviewers: [...new Set(validated.manifest.records.map(row => row.reviewed_by))].sort() },
  };
}
