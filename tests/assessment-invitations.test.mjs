import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessmentInvitation, verifyAssessmentToken, hashAssessmentToken } from '../api/_lib/assessment-invitations.js';

test('invitation token is opaque, hashed and time limited', () => {
  const invite = createAssessmentInvitation({now:Date.parse('2026-11-04T00:00:00Z')});
  assert.equal(invite.token.length,43);
  assert.notEqual(invite.token,invite.tokenHash);
  assert.equal(hashAssessmentToken(invite.token),invite.tokenHash);
  assert.equal(verifyAssessmentToken(invite.token,invite.tokenHash,invite.expiresAt,Date.parse('2026-11-05T00:00:00Z')),true);
  assert.equal(verifyAssessmentToken(invite.token,invite.tokenHash,invite.expiresAt,Date.parse('2026-11-12T00:00:00Z')),false);
  assert.equal(verifyAssessmentToken('invalid',invite.tokenHash,invite.expiresAt),false);
});
test('two invitations have distinct secrets', () => {
  assert.notEqual(createAssessmentInvitation().tokenHash,createAssessmentInvitation().tokenHash);
});
