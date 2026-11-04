import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeSalesExecutiveAssessment, summarizeEmploymentReadiness, COMPETENCIES, PROVISIONAL_RUBRIC } from '../src/assessments/orionSalesExecutiveScoring.js';

const choices = ['A','B','C','D'];
const all = value => Object.fromEntries(Array.from({length:40},(_,i)=>[String(i+1),value]));

test('40 questions and competency weights are complete', () => {
  assert.equal(Object.keys(PROVISIONAL_RUBRIC).length,40);
  assert.equal(COMPETENCIES.reduce((sum,c)=>sum+c.weight,0).toFixed(2),'1.00');
  assert.deepEqual(COMPETENCIES.flatMap(c=>Array.from({length:c.end-c.start+1},(_,i)=>c.start+i)),Array.from({length:40},(_,i)=>i+1));
});

test('grades each selected option using the provisional rubric', () => {
  for (const choice of choices) {
    const result=gradeSalesExecutiveAssessment(all(choice));
    assert.equal(result.answers['1'].points,PROVISIONAL_RUBRIC[1][choices.indexOf(choice)]);
    assert.equal(result.competencies.length,10);
    assert.ok(result.overallScore>=25 && result.overallScore<=100);
    assert.equal(result.provisional,true);
    assert.equal(result.hiringDecision,null);
  }
});

test('rejects incomplete or invalid answer sets', () => {
  assert.throws(()=>gradeSalesExecutiveAssessment({}),/question 1/);
  assert.throws(()=>gradeSalesExecutiveAssessment({...all('A'),'9':'E'}),/question 9/);
});

test('employment readiness is unscored and preserves transportation neutrality', () => {
  const base={transportation:'own',dress_code:'yes',planned_time_off:'no',onsite_schedule:'yes',start_availability:'two',compensation_understanding:'yes'};
  const own=summarizeEmploymentReadiness(base);
  const rideshare=summarizeEmploymentReadiness({...base,transportation:'rideshare'});
  assert.equal(own.transportation,'own');
  assert.equal(rideshare.transportation,'rideshare');
  assert.equal(own.anticipated_dates,null);
  assert.equal('score' in own,false);
  assert.throws(()=>summarizeEmploymentReadiness({...base,transportation:'unknown'}),/transportation/);
});
