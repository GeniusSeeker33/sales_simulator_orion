import { validateExclusionManifest } from './join-orion-exclusions.mjs';

const ORION_WORKSPACE = Object.freeze({ name: 'Orion', slug: 'orion' });

const normalizedRow = row => ({
  application_source_id: String(row.application_source_id).toLowerCase(),
  classification: row.classification,
  reason: row.reason,
  reviewed_by: row.reviewed_by,
  reviewed_at: row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : new Date(row.reviewed_at).toISOString(),
});

const sameGovernance = (left, right) => ['classification', 'reason', 'reviewed_by', 'reviewed_at']
  .every(field => left[field] === right[field]);

/** Rebuild the same canonical object used by api/_lib/intake-review.js. */
export function reconstructHostedManifest(rows) {
  return { manifest_version: 1, source_system: 'join-orion', records: rows.map(normalizedRow) };
}

/** Plan and, only when requested, atomically provision reviewed governance metadata. */
export async function provisionJoinOrionExclusions({ manifest, expectedFingerprint, workspaceId, operator,
  source, target, apply = false }) {
  if (!expectedFingerprint?.trim()) throw new Error('JOIN_ORION_EXCLUSION_FINGERPRINT is required');
  if (!operator?.trim()) throw new Error('JOIN_ORION_EXCLUSION_OPERATOR is required');
  const reviewed = validateExclusionManifest(manifest);
  if (reviewed.fingerprint !== expectedFingerprint.trim()) throw new Error('Reviewed exclusion fingerprint mismatch');

  const workspace = await target.getWorkspace(workspaceId);
  if (!workspace || workspace.slug !== ORION_WORKSPACE.slug || workspace.name !== ORION_WORKSPACE.name) {
    throw new Error('CRM_WORKSPACE_ID must identify the canonical Orion workspace');
  }
  const ids = reviewed.manifest.records.map(row => row.application_source_id);
  const found = new Set((await source.findApplicationIds(ids)).map(id => String(id).toLowerCase()));
  const unmatched = ids.filter(id => !found.has(id));
  if (unmatched.length) throw new Error(`Exclusion manifest contains ${unmatched.length} application ID(s) not found in source`);

  const existing = (await target.readExclusions(workspaceId)).map(normalizedRow);
  const requested = new Map(reviewed.manifest.records.map(row => [row.application_source_id, row]));
  const hosted = new Map(existing.map(row => [row.application_source_id, row]));
  const inserts = reviewed.manifest.records.filter(row => !hosted.has(row.application_source_id));
  const matching = reviewed.manifest.records.filter(row => hosted.has(row.application_source_id)
    && sameGovernance(row, hosted.get(row.application_source_id)));
  const changed = reviewed.manifest.records.filter(row => hosted.has(row.application_source_id)
    && !sameGovernance(row, hosted.get(row.application_source_id)));
  const extra = existing.filter(row => !requested.has(row.application_source_id));
  const conflicts = [...changed, ...extra];
  const base = { workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    manifest_entries: ids.length, source_records_verified: found.size, proposed_inserts: inserts.length,
    already_matching_rows: matching.length, conflicts: conflicts.length, writes_performed: 0,
    reviewed_fingerprint: reviewed.fingerprint, hosted_fingerprint: null, operator: operator.trim() };
  if (conflicts.length) throw Object.assign(new Error(`Hosted exclusion governance conflict (${conflicts.length} row(s)); governed replacement is required`), { report: base });

  if (!apply) {
    const current = validateExclusionManifest(reconstructHostedManifest(existing));
    return { ...base, hosted_fingerprint: current.fingerprint, mode: 'dry-run' };
  }
  return target.transaction(async transaction => {
    await transaction.setApplicationName(`join-orion-exclusions:${operator.trim()}`);
    await transaction.lockWorkspace(workspaceId);
    const locked = (await transaction.readExclusions(workspaceId, { lock: true })).map(normalizedRow);
    const lockedMap = new Map(locked.map(row => [row.application_source_id, row]));
    if (locked.some(row => !requested.has(row.application_source_id)) || reviewed.manifest.records.some(row =>
      lockedMap.has(row.application_source_id) && !sameGovernance(row, lockedMap.get(row.application_source_id)))) {
      throw new Error('Hosted exclusion governance changed before apply; governed replacement is required');
    }
    const toInsert = reviewed.manifest.records.filter(row => !lockedMap.has(row.application_source_id));
    await transaction.insertExclusions(workspaceId, toInsert);
    const finalRows = await transaction.readExclusions(workspaceId);
    const final = validateExclusionManifest(reconstructHostedManifest(finalRows));
    if (final.fingerprint !== reviewed.fingerprint) throw new Error('Hosted exclusion fingerprint does not match reviewed input');
    return { ...base, proposed_inserts: toInsert.length,
      already_matching_rows: reviewed.manifest.records.length - toInsert.length,
      writes_performed: toInsert.length, hosted_fingerprint: final.fingerprint, mode: 'apply' };
  });
}
