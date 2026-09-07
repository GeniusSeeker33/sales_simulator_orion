export const friendly = value => ({ai_unreviewed: 'AI — Unreviewed', technical_failure: 'Technical Failure', defer: 'Deferred — No Band', defer_insufficient_evidence: 'Deferred — Insufficient Evidence', does_not_yet_support: 'Does Not Yet Support', insufficient_opportunity: 'Insufficient Opportunity', follow_up_pending: 'Follow-up Pending'}[value] || String(value || 'Unavailable').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase()));
export const exactReference = ({kind, id, revision}) => ({ ...(kind ? {kind} : {}), id, revision });
export const referenceKey = r => `${r.kind || ''}:${r.id}:${r.revision}`;
export function learnerLabels(scopes) {
  const people = [...new Set(scopes.map(s => s.person_id))].sort();
  return Object.fromEntries(scopes.map(s => {
    const episodes = [...new Set(scopes.filter(p => p.person_id === s.person_id).map(p => p.employment_episode_id))].sort();
    return [s.id, `Learner ${people.indexOf(s.person_id) + 1} · Episode ${episodes.indexOf(s.employment_episode_id) + 1}`];
  }));
}
export function workflowStatus(stage, data) {
  if (!data) return 'Checking / unavailable';
  const recent = data.records?.find(r => !r.superseded_by);
  if (!recent) return 'No records on this page';
  if (recent.source_superseded_by || [...(recent.bands || []), ...(Array.isArray(recent.evidence) ? recent.evidence : []), ...(recent.supporting_evidence || [])].some(e=>e.superseded_by)) return 'Needs human reconsideration';
  if (stage === 'practice') return 'Activity available';
  if (stage === 'coaching') return friendly(recent.progress_status);
  if (stage === 'evidence') return 'Evidence recorded';
  return friendly(recent.outcome);
}
