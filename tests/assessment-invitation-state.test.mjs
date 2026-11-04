import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionInvitation,canSubmitAssessment} from '../api/_lib/assessment-invitation-state.js';
const now=Date.parse('2026-11-04T12:00:00Z'),expiresAt='2026-11-11T12:00:00.000Z';
const ctx={now,expiresAt};
test('normal invite lifecycle',()=>{
  assert.equal(transitionInvitation('invited','open',ctx),'opened');
  assert.equal(transitionInvitation('opened','start',ctx),'in_progress');
  assert.equal(transitionInvitation('in_progress','complete',ctx),'completed');
});
test('no re-submit or resume after completion/revocation',()=>{
  assert.throws(()=>transitionInvitation('completed','complete',ctx));
  assert.throws(()=>transitionInvitation('revoked','start',ctx));
});
test('expiration is enforced before starting or completing',()=>{
  assert.throws(()=>transitionInvitation('invited','start',{...ctx,now:Date.parse(expiresAt)}),/expired/);
  assert.equal(transitionInvitation('in_progress','expire',{...ctx,now:Date.parse(expiresAt)}),'expired');
});
test('submission must match candidate and assessment version',()=>{
  const base={state:'in_progress',...ctx,candidateId:'person-a',expectedCandidateId:'person-a',assessmentVersion:'v1',expectedVersion:'v1'};
  assert.equal(canSubmitAssessment(base),true);
  assert.equal(canSubmitAssessment({...base,candidateId:'person-b'}),false);
  assert.equal(canSubmitAssessment({...base,expectedVersion:'v2'}),false);
  assert.equal(canSubmitAssessment({...base,state:'completed'}),false);
});
