import test from 'node:test';
import assert from 'node:assert/strict';
import { guidedPipeline, editableRules } from '../src/lib/marketingGuidedWork.js';
test('guided stages preserve failure/uncertainty and hide PLAN without Strategist',()=>{
 const work={orchestration:{workflow:'creator_guardian',state:'changes_needed'},pipeline:[{label:'Creator',status:'done'},{label:'Constraint Check',status:'failed'},{label:'Guardian',status:'pending'}]};
 let p=guidedPipeline(work);assert.deepEqual(p.stages.map(s=>s.label),['CREATE','CHECK','REVIEW','DONE']);assert.equal(p.current,'REVIEW');assert.equal(p.stages[1].status,'failed');assert.equal(p.stages[3].status,'pending');
 work.pipeline[1].status='done';work.pipeline[2].status='unknown';assert.equal(guidedPipeline(work).stages[1].status,'unknown');
 work.orchestration={workflow:'strategist_creator_guardian',state:'awaiting_plan'};work.pipeline=[{label:'Strategist',status:'done'},{label:'Human plan decision',status:'action'}];p=guidedPipeline(work);assert.equal(p.current,'PLAN');assert.equal(p.stages[0].status,'action');assert.equal(p.stages.length,5);
 work.orchestration={workflow:'strategist',state:'completed'};p=guidedPipeline(work);assert.deepEqual(p.stages.map(s=>s.label),['PLAN','DONE']);assert.equal(p.current,'DONE');
});
test('editable policy retains semantic details while dropping server-controlled rule identity',()=>{const rule={id:'server-id',constraint_type:'required_phrase_or_concept',value:'Verified facts',details:{mode:'concept'},rationale:'Human policy'};assert.deepEqual(editableRules([rule]),[{constraint_type:rule.constraint_type,value:rule.value,details:rule.details,rationale:rule.rationale}]);assert.equal(rule.id,'server-id');});
