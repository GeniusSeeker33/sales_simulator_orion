/* global process */
import postgres from 'postgres';
import { validateCrmUrl, parseCrmCa } from './talent-db.js';
import { hashAssessmentToken } from './assessment-invitations.js';
import { submitAssessmentInTransaction } from './assessment-submit-transaction.js';
import { ASSESSMENT_VERSION } from '../../src/assessments/orionSalesExecutiveScoring.js';

export async function withAssessmentDatabase(work,{makePool=postgres,environment=process.env}={}) {
  const url=validateCrmUrl(environment.CRM_DATABASE_URL);
  const ca=parseCrmCa(environment.CRM_DATABASE_CA_CERT);
  const db=makePool(url,{ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},prepare:false,max:1});
  try {
    return await db.begin(async tx=>{
      await tx.unsafe("set local statement_timeout = '10s'");
      return work((statement,params=[])=>tx.unsafe(statement,params));
    });
  } finally {await db.end();}
}
export async function getAssessmentInvitation(query,token) {
  let hash;
  try {hash=hashAssessmentToken(token);}
  catch {return {status:404,error:'Assessment invitation unavailable.'};}
  const [row]=await query(
    'select status,expires_at,assessment_version from crm.sales_assessment_invitations where token_hash=$1',[hash]);
  if(!row) return {status:404,error:'Assessment invitation unavailable.'};
  if(row.status==='completed') return {status:409,error:'Assessment already completed.'};
  if(['revoked','expired'].includes(row.status)||row.assessment_version!==ASSESSMENT_VERSION||
     Date.parse(row.expires_at)<=Date.now()) return {status:410,error:'Assessment invitation expired or revoked.'};
  return {status:200,assessment_version:ASSESSMENT_VERSION,expires_at:row.expires_at};
}
export async function saveAssessment(query,token,payload) {
  return submitAssessmentInTransaction(query,{token,payload});
}
