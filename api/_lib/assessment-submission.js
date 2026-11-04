import { SALES_EXECUTIVE_QUESTIONS } from '../../src/assessments/orionSalesExecutiveQuestions.js';
import { EMPLOYMENT_READINESS_QUESTIONS } from '../../src/assessments/orionEmploymentReadinessQuestions.js';
import { gradeSalesExecutiveAssessment, summarizeEmploymentReadiness, ASSESSMENT_VERSION } from '../../src/assessments/orionSalesExecutiveScoring.js';

// Server-only validation. Never trust completion or scoring sent by the browser.
export function validateAssessmentSubmission(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid submission');
  if (!payload.responses || typeof payload.responses !== 'object' || Array.isArray(payload.responses)) throw new Error('Invalid sales responses');
  if (Object.keys(payload.responses).length !== SALES_EXECUTIVE_QUESTIONS.length) throw new Error('Expected exactly 40 sales responses');
  for (const q of SALES_EXECUTIVE_QUESTIONS) {
    if (!q.options.some(o => o.value === payload.responses[String(q.id)])) throw new Error('Invalid sales response for question '+q.id);
  }
  if (!payload.readiness || typeof payload.readiness !== 'object' || Array.isArray(payload.readiness)) throw new Error('Invalid readiness responses');
  const allowedReadinessKeys = new Set([...EMPLOYMENT_READINESS_QUESTIONS.map(q=>q.field),'anticipated_dates']);
  if (Object.keys(payload.readiness).some(key=>!allowedReadinessKeys.has(key))) throw new Error('Unexpected readiness field');
  for (const q of EMPLOYMENT_READINESS_QUESTIONS) {
    if (!q.options.some(o=>o.value===payload.readiness[q.field])) throw new Error('Invalid readiness response for question '+q.id);
  }
  if (payload.readiness.anticipated_dates != null && (typeof payload.readiness.anticipated_dates !== 'string' || payload.readiness.anticipated_dates.length>500)) throw new Error('Invalid anticipated dates');
  const readiness = summarizeEmploymentReadiness(payload.readiness);
  const score = gradeSalesExecutiveAssessment(payload.responses);
  return { assessmentVersion: ASSESSMENT_VERSION, responses: payload.responses, readiness, score };
}
