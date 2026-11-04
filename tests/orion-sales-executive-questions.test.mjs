import test from 'node:test';
import assert from 'node:assert/strict';
import { SALES_EXECUTIVE_QUESTIONS, validateSalesQuestionBank } from '../src/assessments/orionSalesExecutiveQuestions.js';
import { COMPETENCIES } from '../src/assessments/orionSalesExecutiveScoring.js';

test('all 40 candidate-facing questions are complete and ordered', () => {
  assert.equal(validateSalesQuestionBank(),true);
  assert.deepEqual(SALES_EXECUTIVE_QUESTIONS.map(q=>q.id),Array.from({length:40},(_,i)=>i+1));
});
test('each scoring competency corresponds to a section of the question bank', () => {
  assert.equal(new Set(SALES_EXECUTIVE_QUESTIONS.map(q=>q.section)).size,10);
  for(const competency of COMPETENCIES) {
    assert.equal(new Set(SALES_EXECUTIVE_QUESTIONS.slice(competency.start-1,competency.end).map(q=>q.section)).size,1);
  }
});
test('candidate-facing question bank contains no scoring information',()=>{
  for(const q of SALES_EXECUTIVE_QUESTIONS) {
    assert.equal('points' in q,false);
    assert.equal('weight' in q,false);
    assert.ok(q.options.every(o=>!('points' in o)&&!('score' in o)));
  }
});
