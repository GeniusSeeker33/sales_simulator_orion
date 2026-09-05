export const LEGACY_SIMULATOR_STORAGE_KEY = "simulatorResults";

export function loadSimulatorResults() {
  // Browser-global legacy history remains untouched and unattributed.
  return [];
}

export function saveSimulatorResults() {
  throw new Error("Legacy browser history is quarantined. Use verified learner records.");
}

export function addSimulatorResult() {
  throw new Error("Legacy browser history is quarantined. Use verified learner records.");
}

export function clearSimulatorResults() {
  throw new Error("Legacy browser history is quarantined. Use verified learner records.");
}
