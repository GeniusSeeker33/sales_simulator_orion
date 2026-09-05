export const scoreKeys = ["overall", "discovery", "orderBuilding", "objectionHandling", "closing"];
export function validatePracticeScore(value) {
  if (!value || !scoreKeys.every(key => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 100)) {
    throw new Error("Provider returned an invalid score.");
  }
  return Object.fromEntries(scoreKeys.map(key => [key, value[key]]));
}
