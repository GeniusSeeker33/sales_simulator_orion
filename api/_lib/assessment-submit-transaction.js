import { hashAssessmentToken } from './assessment-invitations.js';
import { validateAssessmentSubmission } from './assessment-submission.js';
import { ASSESSMENT_VERSION } from '../../src/assessments/orionSalesExecutiveScoring.js';

// Run inside one database transaction with permissions scoped to the assessment
// tables. Caller must not expose database errors or tokens to the client.
export async function submitAssessmentInTransaction(query, { token, payload, now = new Date() }) {
  let hash;
  try { hash = hashAssessmentToken(token); }
  catch { return { status: 404, error: 'Assessment invitation unavailable.' }; }

  const rows = await query(
    `select id, workspace_id, person_id, assessment_version, status, expires_at
       from crm.sales_assessment_invitations where token_hash = $1 for update`, [hash]
  );
  const invitation = rows[0];
  if (!invitation) return { status: 404, error: 'Assessment invitation unavailable.' };
  if (invitation.status === 'completed') return { status: 409, error: 'Assessment already completed.' };
  if (invitation.status === 'revoked' || invitation.status === 'expired' ||
      invitation.assessment_version !== ASSESSMENT_VERSION ||
      !Number.isFinite(Date.parse(invitation.expires_at)) ||
      Date.parse(invitation.expires_at) <= new Date(now).getTime()) {
    return { status: 410, error: 'Assessment invitation is no longer valid.' };
  }
  if (!['invited','opened','in_progress'].includes(invitation.status)) {
    return { status: 409, error: 'Assessment invitation is unavailable.' };
  }

  let validated;
  try { validated = validateAssessmentSubmission(payload); }
  catch { return { status: 400, error: 'Please complete all assessment questions.' }; }

  await query(
    `insert into crm.sales_assessment_results
      (invitation_id, workspace_id, person_id, assessment_version, responses, readiness, score)
      values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
    [invitation.id, invitation.workspace_id, invitation.person_id,
     validated.assessmentVersion, JSON.stringify(validated.responses),
     JSON.stringify(validated.readiness), JSON.stringify(validated.score)]
  );
  await query(
    `update crm.sales_assessment_invitations set status='completed', completed_at=now()
      where id=$1 and status in ('invited','opened','in_progress')`, [invitation.id]
  );
  return { status: 200, completed: true, invitationId: invitation.id };
}
