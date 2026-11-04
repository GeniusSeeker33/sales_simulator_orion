import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessmentInvitation } from '../api/_lib/assessment-invitations.js';
import { submitAssessmentInTransaction } from '../api/_lib/assessment-submit-transaction.js';
import { SALES_EXECUTIVE_QUESTIONS } from '../src/assessments/orionSalesExecutiveQuestions.js';
import { EMPLOYMENT_READINESS_QUESTIONS } from '../src/assessments/orionEmploymentReadinessQuestions.js';
const payload = () => ({
  responses: Object.fromEntries(SALES_EXECUTIVE_QUESTIONS.map(q => [String(q.id), 'A'])),
  readiness: Object.fromEntries(EMPLOYMENT_READINESS_QUESTIONS.map(q => [q.field, q.options[0].value]))
});
test('valid token completes one assessment and writes the correct candidate identity', async () => {
  const invitation = createAssessmentInvitation();
  const calls = [];
  const query = async (sql, params) => {
    calls.push({sql, params});
    if (sql.includes('for update')) return [{id:'invite-1',workspace_id:'workspace-1',person_id:'candidate-1',assessment_version:'orion-sales-executive-v1',status:'invited',expires_at:invitation.expiresAt}];
    return [];
  };
  const result = await submitAssessmentInTransaction(query,{token:invitation.token,payload:payload()});
  assert.equal(result.status,200);
  assert.equal(calls.length,3);
  assert.equal(calls[1].params[1],'workspace-1');
  assert.equal(calls[1].params[2],'candidate-1');
  assert.equal(JSON.parse(calls[1].params[6]).hiringDecision,null);
});
test('revoked invitation never writes answers',async()=>{
  const invitation=createAssessmentInvitation();
  let writes=0;
  const query=async(sql)=>{if(sql.includes('for update')) return [{id:'x',status:'revoked',expires_at:invitation.expiresAt,assessment_version:'orion-sales-executive-v1'}];writes++;return [];};
  const result=await submitAssessmentInTransaction(query,{token:invitation.token,payload:payload()});
  assert.equal(result.status,410);
  assert.equal(writes,0);
});
