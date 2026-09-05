export const TRAINING_STORAGE_KEY = "sales-simulator-orion-training-results-v1";

export function loadTrainingResults() {
  // Browser-global legacy history remains untouched and unattributed.
  return [];
}

export function saveTrainingResults() {
  throw new Error("Legacy browser history is quarantined. Use verified learner records.");
}

export function addTrainingResult() {
  throw new Error("Legacy browser history is quarantined. Use verified learner records.");
}

export function clearTrainingResults() {
  throw new Error("Legacy browser history is quarantined. Use verified learner records.");
}