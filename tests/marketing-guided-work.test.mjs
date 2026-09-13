import test from 'node:test';
import assert from 'node:assert/strict';
import { guidedPipeline, editableRules, plainWorkReason } from '../src/lib/marketingGuidedWork.js';
const work = (state,check='done',guardian='done') => ({orchestration:{workflow:'creator_guardian',state},pipeline:[{label:'Creator',status:'done'},{label:'Constraint Check',status:check},{label:'Guardian',status:guardian}]});
for(const [name,state,check,guardian,context,expected,kind] of [
 ['policy violation','changes_needed','failed','pending',{},['failed','pending'],'policy_issue'],
 ['Guardian recommendation','changes_needed','done','failed',{guardian:{status:'succeeded',recommendation:'needs_changes'}},['done','action'],'guardian_changes'],
 ['ready for human review','awaiting_review','done','done',{guardian:{status:'succeeded',recommendation:'ready_for_human_review'}},['done','action'],'ready'],
 ['technical failure','failed','done','failed',{guardian:{status:'failed'}},['done','technical'],'guardian_technical'],
 ['inconsistent review','failed','done','failed',{guardian:{status:'failed',technical_reason:'guardian_semantic_structured_mismatch'}},['done','inconsistent'],'guardian_inconsistent'],
 ['Guardian running','guardian_running','done','working',{guardian:{status:'started'}},['done','working'],'review_running'],
]) test(`${name}: CHECK is deterministic and REVIEW represents Guardian readiness`,()=>{const p=guidedPipeline(work(state,check,guardian),context);assert.deepEqual(p.stages.filter(s=>['CHECK','REVIEW'].includes(s.label)).map(s=>s.status),expected);assert.equal(p.kind,kind);assert.equal(p.current,kind==='policy_issue'?'CHECK':'REVIEW');assert.deepEqual(p.stages.map(s=>s.label),['CREATE','CHECK','REVIEW','DONE']);});
test('PLAN and DONE use actual workflow evidence and do not invent completion',()=>{const w=work('awaiting_plan');w.orchestration.workflow='strategist_creator_guardian';w.pipeline.push({label:'Strategist',status:'done'},{label:'Human plan decision',status:'action'});let p=guidedPipeline(w);assert.equal(p.stages.length,5);assert.equal(p.stages[0].status,'action');assert.equal(p.current,'PLAN');w.orchestration={workflow:'strategist',state:'completed'};p=guidedPipeline(w);assert.deepEqual(p.stages.map(s=>s.label),['PLAN','DONE']);assert.equal(p.current,'DONE');});
test('normal guidance removes internal recovery jargon and safe codes',()=>{for(const reason of ['Record human requested changes on the current asset before recovery','result_rejected','orchestration recovery'])assert.doesNotMatch(plainWorkReason(reason),/result_rejected|orchestration|Record human/);});
test('editable policy preserves semantic detail without writable rule identity',()=>{const rule={id:'server-id',constraint_type:'human_instruction',value:'Verified facts'};assert.deepEqual(editableRules([rule]),[{constraint_type:rule.constraint_type,value:rule.value}]);assert.equal(rule.id,'server-id');});
