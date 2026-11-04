import { withAssessmentDatabase,getAssessmentInvitation,saveAssessment } from './_lib/assessment-candidate-db.js';
import { SALES_EXECUTIVE_QUESTIONS } from '../src/assessments/orionSalesExecutiveQuestions.js';
import { EMPLOYMENT_READINESS_QUESTIONS } from '../src/assessments/orionEmploymentReadinessQuestions.js';

export function createHandler({withDatabase=withAssessmentDatabase}={}) {
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    if(!['GET','POST'].includes(req.method)) {
      res.setHeader('Allow','GET, POST');
      return res.status(405).json({error:'Method not allowed'});
    }
    const token=req.method==='GET'?req.query?.token:req.body?.token;
    if(typeof token!=='string'||token.length!==43) return res.status(404).json({error:'Assessment invitation unavailable.'});
    if(req.method==='POST') {
      const length=Number(req.headers['content-length']||0);
      if(length>65536) return res.status(413).json({error:'Assessment submission too large.'});
    }
    try {
      const result=await withDatabase(query=>req.method==='GET'
        ?getAssessmentInvitation(query,token)
        :saveAssessment(query,token,{responses:req.body?.responses,readiness:req.body?.readiness}));
      if(result.error) return res.status(result.status).json({error:result.error});
      if(req.method==='GET') return res.status(200).json({
        assessment_version:result.assessment_version,expires_at:result.expires_at,
        questions:SALES_EXECUTIVE_QUESTIONS,readiness_questions:EMPLOYMENT_READINESS_QUESTIONS
      });
      return res.status(200).json({completed:true});
    } catch {
      return res.status(503).json({error:'Assessment service temporarily unavailable.'});
    }
  };
}
export default createHandler();
