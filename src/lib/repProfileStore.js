import { PACE_REPORT_ROWS } from "../data/paceReport";
import { getEmployeeFullName } from "../data/employees";

const REP_METRICS_STORAGE_KEY = "sales-simulator-orion-rep-metrics-v1";

export const defaultRepProfile = {
  repName: "AE User",
  startDate: getDefaultStartDate(),
  revenue: 97844,
  captures: 17,
  customersSold: 30,
};

/**
 * Build a rep profile from live Orion data (Pace Report + employee hire date)
 * when the session has a real rep code. Returns null if no live row exists
 * for this rep, so callers can fall back to loadRepProfile().
 */
export function buildLiveRepProfile(repCode, employee) {
  if (!repCode) return null;
  const paceRow = PACE_REPORT_ROWS.find((r) => r.repCode === repCode);
  if (!paceRow) return null;

  const repName = employee ? getEmployeeFullName(employee) : paceRow.name;
  const startDate = normalizeStartDate(
    employee?.hireDate || defaultRepProfile.startDate
  );

  return {
    repName,
    startDate,
    revenue: Number(paceRow.totalSales || 0),
    captures: Number(paceRow.captureTotal || 0),
    customersSold: Number(paceRow.soldToTotal || 0),
    source: "pace-report-live",
  };
}

export function loadRepProfile() {
  try {
    const raw = localStorage.getItem(REP_METRICS_STORAGE_KEY);

    if (!raw) {
      return { ...defaultRepProfile };
    }

    const parsed = JSON.parse(raw);

    return {
      repName: parsed.repName ?? defaultRepProfile.repName,
      startDate: normalizeStartDate(parsed.startDate ?? defaultRepProfile.startDate),
      revenue: Number(parsed.revenue ?? defaultRepProfile.revenue),
      captures: Number(parsed.captures ?? defaultRepProfile.captures),
      customersSold: Number(
        parsed.customersSold ?? defaultRepProfile.customersSold
      ),
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch (error) {
    console.error("Failed to load rep profile:", error);
    return { ...defaultRepProfile };
  }
}

export function saveRepProfile(profile) {
  const payload = {
    repName:
      (profile.repName ?? defaultRepProfile.repName).trim() ||
      defaultRepProfile.repName,
    startDate: normalizeStartDate(
      profile.startDate ?? defaultRepProfile.startDate
    ),
    revenue: Number(profile.revenue ?? defaultRepProfile.revenue),
    captures: Number(profile.captures ?? defaultRepProfile.captures),
    customersSold: Number(
      profile.customersSold ?? defaultRepProfile.customersSold
    ),
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(REP_METRICS_STORAGE_KEY, JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.error("Failed to save rep profile:", error);
    return payload;
  }
}

export function resetRepProfile() {
  const payload = {
    ...defaultRepProfile,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(REP_METRICS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("Failed to reset rep profile:", error);
  }

  return payload;
}

function normalizeStartDate(value) {
  if (!value) return defaultRepProfile.startDate;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return defaultRepProfile.startDate;
  }

  return parsed.toISOString().slice(0, 10);
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 60);
  return date.toISOString().slice(0, 10);
}