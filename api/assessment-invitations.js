/* global process */
import { createClient } from '@supabase/supabase-js';
import { isUuid } from './_lib/talent-read.js';
import { persistAssessmentInvitation } from './_lib/assessment-invitation-write.js';

// Internal recruiter endpoint; intentionally does not send mail or return a
// candidate link until a delivery service and audit trail are configured.
export function createHandler({ makeClient=createClient, persist=persistAssessmentInvitation }={}) {
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST') {
      res.setHeader('Allow','POST');
      return res.status(405).json({error:'Method not allowed'});
    }
    const bearer=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];
    if(!bearer) return res.status(401).json({error:'Authentication required'});
    const {workspace_id,person_id,application_id}=req.body||{};
    if(!isUuid(workspace_id)||!isUuid(person_id)||
       (application_id!==undefined&&application_id!==null&&!isUuid(application_id))) {
      return res.status(400).json({error:'Invalid assessment invitation request'});
    }
    const url=process.env.LEARNER_SUPABASE_URL;
    const key=process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!key) return res.status(503).json({error:'Authentication unavailable'});
    let user;
    try {
      const {data,error}=await makeClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.getUser(bearer);
      if(error||!data?.user||data.user.is_anonymous) return res.status(401).json({error:'Verified sign-in required'});
      user=data.user;
    } catch {return res.status(503).json({error:'Authentication unavailable'});}
    try {
      const result=await persist({userId:user.id,workspaceId:workspace_id,personId:person_id,applicationId:application_id||null});
      if(result.error) return res.status(result.status).json({error:result.error});
      // Never send the raw invitation token in an API response or logs.
      return res.status(202).json({
        invitation_id:result.invitationId,
        expires_at:result.expiresAt,
        delivery:'not_sent',
        message:'Invitation saved but not sent. Email delivery is not yet configured.'
      });
    } catch {
      return res.status(503).json({error:'Assessment invitation service unavailable'});
    }
  };
}
export default createHandler();
