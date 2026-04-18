export const TRAINING_STORAGE_KEY = "sales-simulator-orion-training-results-v1";

export function loadTrainingResults() {
  try {
    const raw = localStorage.getItem(TRAINING_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load training results:", error);
    return [];
  }
}

export function saveTrainingResults(results) {
  try {
    localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(results));
  } catch (error) {
    console.error("Failed to save training results:", error);
  }
}

export function addTrainingResult(result) {
  const existing = loadTrainingResults();
  const updated = [result, ...existing];
  saveTrainingResults(updated);
  return updated;
}

export function clearTrainingResults() {
  saveTrainingResults([]);
  return [];
}