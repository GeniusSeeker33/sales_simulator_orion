/* global process */
import postgres from 'postgres';
import { parseCrmCa, validateCrmUrl } from './talent-db.js';
import { createAssessmentInvitation } from './assessment-invitations.js';
import { ASSESSMENT_VERSION } from '../../src/assessments/orionSalesExecutiveScoring.js';

// Server-only invitation persistence. This must never run in the browser.
// The invitation is NOT delivered until a separate mail transport is configured.
export async function persistAssessmentInvitation({userId,workspaceId,personId,applicationId=null,makePool=postgres,environment=process.env}) {
  const url=validateCrmUrl(environment.CRM_DATABASE_URL);
  const ca=parseCrmCa(environment.CRM_DATABASE_CA_CERT);
  const sql=makePool(url,{ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},prepare:false,max:1});
  try {
    return await sql.begin(async tx=>{
      await tx.unsafe('set local role authenticated');
      await tx.unsafe("select set_config('request.jwt.claim.sub', $1, true)",[userId]);
      await tx.unsafe("select set_config('request.jwt.claims', $1, true)",[JSON.stringify({sub:userId,role:'authenticated'})]);
      await tx.unsafe("set local statement_timeout = '10s'");
      const [member]=await tx.unsafe("select role from crm.workspace_members where workspace_id=$1 and user_id=$2 and role in ('manager','admin')",[workspaceId,userId]);
      if(!member) return {status:403,error:'Assessment invitation permission required.'};
      const [person]=await tx.unsafe('select id from crm.people where workspace_id=$1 and id=$2',[workspaceId,personId]);
      if(!person) return {status:404,error:'Candidate not found.'};
      if(applicationId) {
        const [app]=await tx.unsafe('select id from crm.applications where workspace_id=$1 and person_id=$2 and id=$3',[workspaceId,personId,applicationId]);
        if(!app) return {status:404,error:'Candidate application not found.'};
      }
      const invitation=createAssessmentInvitation();
      const [row]=await tx.unsafe(`insert into crm.sales_assessment_invitations
        (workspace_id,person_id,application_id,assessment_version,token_hash,invited_by,expires_at)
        values ($1,$2,$3,$4,$5,$6,$7) returning id,expires_at`,
        [workspaceId,personId,applicationId,ASSESSMENT_VERSION,invitation.tokenHash,userId,invitation.expiresAt]);
      return {status:201,invitationId:row.id,expiresAt:row.expires_at,token:invitation.token,delivery:'not_sent'};
    });
  } finally {await sql.end();}
}
