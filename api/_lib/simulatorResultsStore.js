const STORAGE_KEY = "simulatorResults";

export function loadSimulatorResults() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSimulatorResults(results) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
}

export function addSimulatorResult(result) {
  const existing = loadSimulatorResults();

  const updated = [
    {
      id: result.id || createId("sim-result"),
      createdAt: new Date().toISOString(),
      ...result,
    },
    ...existing,
  ];

  saveSimulatorResults(updated);
  return updated[0];
}

export function clearSimulatorResults() {
  localStorage.removeItem(STORAGE_KEY);
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}