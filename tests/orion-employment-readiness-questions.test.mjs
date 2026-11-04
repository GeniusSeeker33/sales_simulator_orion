import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPLOYMENT_READINESS_QUESTIONS,validateReadinessQuestionBank} from '../src/assessments/orionEmploymentReadinessQuestions.js';
import {summarizeEmploymentReadiness} from '../src/assessments/orionSalesExecutiveScoring.js';
test('six questions map exactly to accepted readiness values',()=>{
  assert.equal(validateReadinessQuestionBank(),true);
  for(const q of EMPLOYMENT_READINESS_QUESTIONS) {
    for(const option of q.options) {
      const all=Object.fromEntries(EMPLOYMENT_READINESS_QUESTIONS.map(item=>[item.field,item.options[0].value]));
      all[q.field]=option.value;
      assert.equal(summarizeEmploymentReadiness(all)[q.field],option.value);
    }
  }
});
test('planned time off has an optional date-only followup',()=>{
  const q=EMPLOYMENT_READINESS_QUESTIONS.find(q=>q.field==='planned_time_off');
  assert.deepEqual(q.followUp.when,['yes','maybe']);
});
