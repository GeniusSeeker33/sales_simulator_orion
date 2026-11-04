/**
 * Orion Sales Executive assessment scoring, prototype v1.
 * This module is server-side only: never bundle the rubric into the candidate UI.
 * The weights and option rankings are provisional and require Orion leadership calibration.
 */
export const ASSESSMENT_VERSION = "orion-sales-executive-v1";
export const COMPETENCIES = [
  { id: "prospecting", start: 1, end: 5, weight: 0.15 },
  { id: "resilience", start: 6, end: 10, weight: 0.12 },
  { id: "dealer_development", start: 11, end: 15, weight: 0.15 },
  { id: "discipline", start: 16, end: 20, weight: 0.12 },
  { id: "commission_growth", start: 21, end: 25, weight: 0.08 },
  { id: "initiative", start: 26, end: 28, weight: 0.08 },
  { id: "learning", start: 29, end: 31, weight: 0.08 },
  { id: "communication", start: 32, end: 34, weight: 0.08 },
  { id: "competitive_drive", start: 35, end: 37, weight: 0.07 },
  { id: "integrity", start: 38, end: 40, weight: 0.07 },
];
// Every option is plausible; ratings are provisional, not validated predictive scores.
// Equal ratings are permitted where scenario context does not distinguish responses.
export const PROVISIONAL_RUBRIC = {
  1:[3,4,2,3],2:[3,4,2,4],3:[3,2,4,3],4:[4,3,3,3],5:[4,3,2,3],
  6:[3,4,3,4],7:[4,4,3,3],8:[4,3,3,3],9:[4,3,4,4],10:[4,3,3,4],
  11:[4,3,4,3],12:[4,4,3,3],13:[4,4,3,4],14:[4,4,3,3],15:[4,4,3,4],
  16:[3,4,2,4],17:[3,4,4,4],18:[3,4,3,4],19:[4,3,4,3],20:[3,4,4,3],
  21:[3,3,4,3],22:[3,4,3,4],23:[3,2,4,3],24:[3,3,4,4],25:[4,4,3,4],
  26:[4,4,3,4],27:[4,4,3,3],28:[4,3,4,3],29:[4,4,3,3],30:[4,3,3,4],
  31:[3,3,3,4],32:[4,3,4,3],33:[4,4,3,3],34:[4,3,3,4],35:[4,4,3,3],
  36:[4,3,4,3],37:[3,3,4,3],38:[4,4,3,3],39:[4,4,4,3],40:[4,4,4,3],
};
const VALID_OPTIONS = ["A","B","C","D"];
export function gradeSalesExecutiveAssessment(responses, rubric = PROVISIONAL_RUBRIC) {
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) throw new Error("Responses must be an object");
  const answered = {};
  for (let i = 1; i <= 40; i++) {
    const key = String(i);
    const choice = responses[key];
    if (!VALID_OPTIONS.includes(choice)) throw new Error(`Missing or invalid response for question ${i}`);
    const scores = rubric[i];
    if (!Array.isArray(scores) || scores.length !== 4 || scores.some(s=>!Number.isInteger(s)||s<1||s>4)) throw new Error(`Invalid rubric for question ${i}`);
    answered[key] = { selected: choice, points: scores[VALID_OPTIONS.indexOf(choice)] };
  }
  const competencies = COMPETENCIES.map(c => {
    const values = Array.from({length:c.end-c.start+1},(_,j)=>answered[String(c.start+j)].points);
    const mean = values.reduce((a,b)=>a+b,0)/values.length;
    return { id:c.id, weight:c.weight, points:values.reduce((a,b)=>a+b,0), maxPoints:values.length*4, score:Math.round((mean/4)*100) };
  });
  const weightedScore = competencies.reduce((s,c)=>s+c.score*c.weight,0);
  return { assessmentVersion: ASSESSMENT_VERSION, overallScore:Math.round(weightedScore), competencies, answers:answered, provisional:true, hiringDecision:null };
}
export function summarizeEmploymentReadiness(readiness) {
  const allowed = {
    transportation:["own","rideshare","family","other","no"],
    dress_code:["yes","clarify","no"],
    planned_time_off:["yes","no","maybe"],
    onsite_schedule:["yes","clarify","no"],
    start_availability:["immediate","two","month","later"],
    compensation_understanding:["yes","clarify","no"]
  };
  const result = {};
  for (const [field,values] of Object.entries(allowed)) {
    if (!values.includes(readiness?.[field])) throw new Error(`Invalid readiness response: ${field}`);
    result[field] = readiness[field];
  }
  result.anticipated_dates = readiness.planned_time_off === "no" ? null : String(readiness.anticipated_dates ?? "").slice(0,500);
  return result; // Never combine readiness with aptitude score.
}
