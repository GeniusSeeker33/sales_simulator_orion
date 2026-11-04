import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAssessmentSubmission} from '../api/_lib/assessment-submission.js';
import {SALES_EXECUTIVE_QUESTIONS} from '../src/assessments/orionSalesExecutiveQuestions.js';
import {EMPLOYMENT_READINESS_QUESTIONS} from '../src/assessments/orionEmploymentReadinessQuestions.js';
const example=()=>({
 responses:Object.fromEntries(SALES_EXECUTIVE_QUESTIONS.map(q=>[String(q.id),'A'])),
 readiness:Object.fromEntries(EMPLOYMENT_READINESS_QUESTIONS.map(q=>[q.field,q.options[0].value]))
});
test('complete assessment is graded on the server',()=>{
 const result=validateAssessmentSubmission(example());
 assert.equal(result.score.competencies.length,10);
 assert.equal(result.score.hiringDecision,null);
});
test('incomplete assessment cannot be submitted',()=>{
 const data=example();delete data.responses['10'];
 assert.throws(()=>validateAssessmentSubmission(data));
});
test('unknown readiness answers are rejected',()=>{
 const data=example();data.readiness.transportation='unknown';
 assert.throws(()=>validateAssessmentSubmission(data));
});
