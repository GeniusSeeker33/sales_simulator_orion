import { createHash } from 'node:crypto';
import { applyExclusions, validateExclusionManifest } from './join-orion-exclusions.mjs';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const email = value => text(value)?.toLowerCase() ?? null;
const phone = value => text(value)?.replace(/\D/g, '') || null;
const name = application => text([application.first_name, application.last_name].filter(text).join(' '))?.toLowerCase().replace(/\s+/g, ' ') ?? null;
const compare = (a, b) => String(a).localeCompare(String(b));

function maskEmail(value) {
  const normalized = text(value);
  if (!normalized) return null;
  const at = normalized.indexOf('@');
  if (at < 1) return '***';
  const local = normalized.slice(0, at), domain = normalized.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const suffix = dot > 0 ? domain.slice(dot) : '';
  return `${local[0]}***@${host[0] ?? '*'}***${suffix}`;
}

function maskPhone(value) {
  const normalized = phone(value);
  return normalized ? `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}` : null;
}

/** Builds a deterministic, read-only review artifact from a canonical source snapshot. */
export function buildDuplicateReconciliation(snapshot, { redacted = false, exclusionManifest = null } = {}) {
  if (!snapshot || !Array.isArray(snapshot.applications)) throw new Error('A canonical Join-Orion application snapshot is required');
  const sourceApplications = snapshot.applications.length;
  const exclusionResult = applyExclusions(snapshot, exclusionManifest ? validateExclusionManifest(exclusionManifest) : null);
  snapshot = exclusionResult.snapshot;
  const applications = snapshot.applications.map(raw => ({
    source_application_id: text(raw.source_id), first_name: text(raw.first_name), last_name: text(raw.last_name),
    email: text(raw.email), phone: text(raw.phone), position_title: text(raw.payload?.position_title),
    application_date: raw.submitted_at instanceof Date ? raw.submitted_at.toISOString() : text(raw.submitted_at),
    original_source_status: text(raw.source_status) ?? text(raw.payload?.source_status) ?? text(raw.status),
    source: text(raw.payload?.application_source), recruiter: text(raw.owner_ref),
    normalized: { email: email(raw.email), phone: phone(raw.phone), name: name(raw) },
  })).filter(row => row.source_application_id).sort((a, b) => compare(a.source_application_id, b.source_application_id));

  const parent = new Map(applications.map(row => [row.source_application_id, row.source_application_id]));
  const find = id => { let root = id; while (parent.get(root) !== root) root = parent.get(root); while (id !== root) { const next = parent.get(id); parent.set(id, root); id = next; } return root; };
  const union = (a, b) => { const left = find(a), right = find(b); if (left !== right) parent.set(compare(left, right) < 0 ? right : left, compare(left, right) < 0 ? left : right); };
  const relationships = [];
  for (let i = 0; i < applications.length; i++) for (let j = i + 1; j < applications.length; j++) {
    const a = applications[i], b = applications[j];
    const evidence = {
      email: Boolean(a.normalized.email && a.normalized.email === b.normalized.email),
      phone: Boolean(a.normalized.phone && a.normalized.phone === b.normalized.phone),
      name: Boolean(a.normalized.name && a.normalized.name === b.normalized.name),
    };
    if (Object.values(evidence).some(Boolean)) { union(a.source_application_id, b.source_application_id); relationships.push({ application_a: a.source_application_id, application_b: b.source_application_id, evidence }); }
  }
  const components = new Map();
  for (const application of applications) { const root = find(application.source_application_id); (components.get(root) ?? components.set(root, []).get(root)).push(application); }
  const cases = [...components.values()].filter(group => group.length > 1).map(group => {
    const ids = group.map(row => row.source_application_id).sort(compare);
    const caseRelationships = relationships.filter(row => ids.includes(row.application_a) && ids.includes(row.application_b));
    const caseId = `DUP-${createHash('sha256').update(ids.join('\u0000')).digest('hex').slice(0, 12).toUpperCase()}`;
    return { case_id: caseId, applications: group.map(({ normalized, ...row }) => ({ ...row,
      email: redacted ? maskEmail(row.email) : row.email, phone: redacted ? maskPhone(row.phone) : row.phone })), relationships: caseRelationships };
  }).sort((a, b) => compare(a.case_id, b.case_id));
  const involved = new Set(cases.flatMap(item => item.applications.map(row => row.source_application_id)));
  return {
    report_version: 1, source_system: 'join-orion', redacted,
    exclusion_manifest: exclusionResult.metadata, excluded: exclusionResult.excluded,
    summary: { source_applications: sourceApplications, applications_excluded: exclusionResult.excluded.applications,
      applications_eligible: applications.length, reconciliation_cases: cases.length,
      applications_in_cases: involved.size, applications_without_duplicate_signals: applications.length - involved.size, writes_performed: 0 },
    cases,
    worksheet: cases.map(item => ({ case_id: item.case_id,
      source_application_ids: item.applications.map(row => row.source_application_id), decision: null,
      reviewed_by: null, reviewed_at: null, reason: null })),
  };
}

export function formatDuplicateReconciliation(report) {
  const lines = ['Join-Orion Duplicate Reconciliation (READ ONLY)',
    `Applications: ${report.summary.source_applications}`,
    `Applications excluded: ${report.summary.applications_excluded}`,
    `Applications eligible: ${report.summary.applications_eligible}`,
    `Cases: ${report.summary.reconciliation_cases}`,
    `Applications without duplicate signals: ${report.summary.applications_without_duplicate_signals}`,
    ...(report.exclusion_manifest ? [`Exclusion manifest: v${report.exclusion_manifest.manifest_version} ${report.exclusion_manifest.fingerprint}`,
      `Manifest entries: ${report.exclusion_manifest.manifest_entries}`,
      `Source records found: ${report.exclusion_manifest.source_records_found}`,
      `Unmatched manifest IDs: ${report.exclusion_manifest.unmatched_manifest_ids.length}`,
      `Reviewers: ${report.exclusion_manifest.reviewers.join(', ')}`] : []),
    `Contact details: ${report.redacted ? 'REDACTED (names retained for identity review)' : 'UNREDACTED — trusted operator terminal only'}`, ''];
  for (const item of report.cases) {
    lines.push(`Case ${item.case_id}`, `Applications: ${item.applications.length}`);
    for (const application of item.applications) lines.push(
      `- ${application.source_application_id}: ${application.first_name ?? ''} ${application.last_name ?? ''}`.trimEnd(),
      `  email: ${application.email ?? '—'} | phone: ${application.phone ?? '—'}`,
      `  position: ${application.position_title ?? '—'} | date: ${application.application_date ?? '—'} | status: ${application.original_source_status ?? '—'}`,
      `  source: ${application.source ?? '—'} | recruiter: ${application.recruiter ?? '—'}`);
    lines.push('Relationships:');
    for (const relationship of item.relationships) lines.push(`${relationship.application_a} → ${relationship.application_b}`,
      `  email: ${relationship.evidence.email ? 'match' : 'no match'} | phone: ${relationship.evidence.phone ? 'match' : 'no match'} | name: ${relationship.evidence.name ? 'match' : 'no match'}`);
    lines.push('Decision: [ ] same_person  [ ] keep_separate  [ ] needs_more_review', '');
  }
  lines.push('Worksheet template:', JSON.stringify(report.worksheet, null, 2), '', 'Writes performed: 0');
  return lines.join('\n');
}
