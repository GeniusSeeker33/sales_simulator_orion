const ROSTER_STORAGE_KEY = "sales-simulator-orion-rep-roster-v1";

function daysAgoDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_COMPARISON_REPS = [
  {
    id: "rep-demo-ramp",
    name: "New Ramp AE",
    startDate: daysAgoDate(12),
    revenue: 12000,
    captures: 7,
    customersSold: 9,
    trainingAverage: 68,
    trainingSessions: 2,
    isDemo: true,
  },
  {
    id: "rep-demo-mid",
    name: "Mid-Tenure AE",
    startDate: daysAgoDate(240),
    revenue: 210000,
    captures: 11,
    customersSold: 63,
    trainingAverage: 76,
    trainingSessions: 8,
    isDemo: true,
  },
  {
    id: "rep-demo-strong",
    name: "High Performer AE",
    startDate: daysAgoDate(540),
    revenue: 460000,
    captures: 9,
    customersSold: 118,
    trainingAverage: 89,
    trainingSessions: 15,
    isDemo: true,
  },
];

export function loadComparisonReps() {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return DEFAULT_COMPARISON_REPS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COMPARISON_REPS;
  } catch {
    return DEFAULT_COMPARISON_REPS;
  }
}

export function saveComparisonReps(reps) {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(reps));
  } catch (err) {
    console.error("Failed to save comparison reps:", err);
  }
}

export function resetComparisonReps() {
  saveComparisonReps(DEFAULT_COMPARISON_REPS);
  return DEFAULT_COMPARISON_REPS;
}

export function updateComparisonRep(id, updates) {
  const reps = loadComparisonReps();
  const updated = reps.map((rep) => (rep.id === id ? { ...rep, ...updates } : rep));
  saveComparisonReps(updated);
  return updated;
}
