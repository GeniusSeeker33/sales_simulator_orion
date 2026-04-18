const REP_METRICS_STORAGE_KEY = "sales-simulator-orion-rep-metrics-v1";

export const defaultRepProfile = {
  repName: "AE User",
  startDate: getDefaultStartDate(),
  revenue: 97844,
  captures: 17,
  customersSold: 30,
};

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
    revenue: Math.max(0, Math.min(10000000, Number(profile.revenue ?? defaultRepProfile.revenue))),
    captures: Math.max(0, Math.min(9999, Math.round(Number(profile.captures ?? defaultRepProfile.captures)))),
    customersSold: Math.max(0, Math.min(9999, Math.round(Number(profile.customersSold ?? defaultRepProfile.customersSold)))),
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

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    return today.toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 60);
  return date.toISOString().slice(0, 10);
}