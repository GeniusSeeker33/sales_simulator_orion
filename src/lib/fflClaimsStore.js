// Reps can manually claim ownership of an FFL row even when the name-based
// match against the Orion account book misses (DBAs, parent-LLC names, etc).
// Claims are keyed by FFL id and take priority over name matches.

const STORAGE_KEY = "orion-ffl-rep-claims-v1";

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error("Failed to save FFL claims:", error);
  }
}

export function loadClaims() {
  return readRaw();
}

export function setClaim(fflId, repCode) {
  if (!fflId || !repCode) return readRaw();
  const next = {
    ...readRaw(),
    [fflId]: { repCode, claimedAt: new Date().toISOString() },
  };
  writeRaw(next);
  return next;
}

export function clearClaim(fflId) {
  if (!fflId) return readRaw();
  const current = readRaw();
  if (!(fflId in current)) return current;
  const next = { ...current };
  delete next[fflId];
  writeRaw(next);
  return next;
}
