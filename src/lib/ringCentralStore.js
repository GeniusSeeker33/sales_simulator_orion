const STORAGE_KEY = "ringCentralCalls";

export function loadRingCentralCalls() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRingCentralCalls(calls) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
}

export function addRingCentralCalls(calls = []) {
  const existing = loadRingCentralCalls();

  const mapped = calls.map((call, index) => ({
    id: call.id || call.sessionId || `rc-call-${Date.now()}-${index}`,
    createdAt: new Date().toISOString(),
    source: "RingCentral Import",
    ...call,
  }));

  const updated = [...mapped, ...existing];
  saveRingCentralCalls(updated);
  return mapped;
}

export function clearRingCentralCalls() {
  localStorage.removeItem(STORAGE_KEY);
}