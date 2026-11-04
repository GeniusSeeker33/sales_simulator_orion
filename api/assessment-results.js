/* global process */
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { validateCrmUrl, parseCrmCa } from './_lib/talent-db.js';
import { isUuid } from './_lib/talent-read.js';

// Read-only assessment history. All predicates include verified workspace
// membership AND the requested candidate identity.
export function createHandler({makeClient=createClient,makePool=postgres,environment=process.env}={}) {
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const {workspace_id,person_id}=req.query||{};
  if(!isUuid(workspace_id)||!isUuid(person_id)) return res.status(400).json({error:'Invalid candidate reference'});
  const bearer=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];
  if(!bearer) return res.status(401).json({error:'Authentication required'});
  const url=environment.LEARNER_SUPABASE_URL,key=environment.LEARNER_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return res.status(503).json({error:'Authentication unavailable'});
  let user;
  try {
   const result=await makeClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.getUser(bearer);
   if(result.error||!result.data?.user||result.data.user.is_anonymous) return res.status(401).json({error:'Sign-in required'});
   user=result.data.user;
  } catch {return res.status(503).json({error:'Authentication unavailable'});}
  let db;
  try {
   const ca=parseCrmCa(environment.CRM_DATABASE_CA_CERT);
   db=makePool(validateCrmUrl(environment.CRM_DATABASE_URL),{ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},prepare:false,max:1});
   const result=await db.begin(async tx=>{
    await tx.unsafe("set local statement_timeout='10s'");
    const [member]=await tx.unsafe("select role from crm.workspace_members where workspace_id=$1 and user_id=$2 and role in ('manager','admin')",[workspace_id,user.id]);
    if(!member) return {status:403,error:'Assessment access denied'};
    const [person]=await tx.unsafe('select id from crm.people where workspace_id=$1 and id=$2',[workspace_id,person_id]);
    if(!person) return {status:404,error:'Candidate unavailable'};
    const invitations=await tx.unsafe(`select i.id,i.status,i.invited_at,i.expires_at,i.completed_at,
      r.submitted_at,r.score,r.readiness
      from crm.sales_assessment_invitations i
      left join crm.sales_assessment_results r
      on r.invitation_id=i.id and r.workspace_id=i.workspace_id and r.person_id=i.person_id
      where i.workspace_id=$1 and i.person_id=$2
      order by i.invited_at desc,i.id desc limit 25`,[workspace_id,person_id]);
    return {status:200,invitations};
   });
   if(result.error) return res.status(result.status).json({error:result.error});
   return res.status(200).json({invitations:result.invitations});
  } catch {return res.status(503).json({error:'Assessment history unavailable'});}
  finally {if(db) await db.end();}
 };
}
export default createHandler();
