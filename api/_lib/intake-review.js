import { createPostgresImportTarget } from '../../scripts/lib/join-orion-postgres-target.mjs';
import { buildJoinOrionIntakeReview } from '../../scripts/lib/join-orion-intake-review.mjs';

export const INTAKE_ROLES = Object.freeze(['manager', 'admin']);

export async function readIntakeReview(query, human, workspaceId, source) {
  const [membership] = await query(`select w.id::text, w.slug, w.name, m.role from crm.workspaces w
    join crm.workspace_members m on m.workspace_id=w.id where w.id=$1 and m.user_id=$2`, [workspaceId, human], 'intake_authorization');
  if (!membership || !INTAKE_ROLES.includes(membership.role)) return { status: 403, body: { error: 'Manager or admin CRM workspace membership required.' } };
  const exclusions = await query(`select application_source_id::text, classification, reason, reviewed_by, reviewed_at
    from crm.join_orion_source_exclusions where workspace_id=$1 and source_system='join-orion'
    order by application_source_id`, [workspaceId], 'exclusion_configuration');
  const manifest = { manifest_version: 1, source_system: 'join-orion', records: exclusions.map(row => ({
    application_source_id: row.application_source_id,
    classification: row.classification,
    reason: row.reason,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : row.reviewed_at,
  })) };
  const sql = (strings, ...values) => {
    let statement = '';
    const parameters = [];
    strings.forEach((part, index) => { statement += part; if (index < values.length) { parameters.push(values[index]); statement += `$${parameters.length}`; } });
    return query(statement, parameters, 'intake_crm_reconciliation');
  };
  const queue = await buildJoinOrionIntakeReview({ source, target: createPostgresImportTarget(sql), workspaceId, exclusionManifest: manifest });
  return { status: 200, body: { ...queue, role: membership.role } };
}
