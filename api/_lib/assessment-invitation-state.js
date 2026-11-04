// Pure invitation lifecycle checks. API/database must enforce atomic writes.
export const transitions = {
  invited: {open:'opened',start:'in_progress',expire:'expired',revoke:'revoked'},
  opened: {start:'in_progress',expire:'expired',revoke:'revoked'},
  in_progress: {complete:'completed',expire:'expired',revoke:'revoked'},
  completed: {}, expired: {}, revoked: {}
};
export function transitionInvitation(current,event,{now=Date.now(),expiresAt}={}) {
  const expiry=Date.parse(expiresAt);
  if (!Number.isFinite(now)||!Number.isFinite(expiry)) throw new Error('Invalid expiration');
  if (event==='expire' ? now<expiry : now>=expiry) throw new Error('Invitation expired');
  const next=transitions[current]?.[event];
  if (!next) throw new Error('Invalid invitation transition');
  return next;
}
export function canSubmitAssessment({state,expiresAt,now=Date.now(),candidateId,expectedCandidateId,assessmentVersion,expectedVersion}) {
  return state==='in_progress' && Date.parse(expiresAt)>now
    && !!candidateId && candidateId===expectedCandidateId
    && !!assessmentVersion && assessmentVersion===expectedVersion;
}
