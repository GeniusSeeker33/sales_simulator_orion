export const TRAINING_LEVELS = [
  {
    level: 1,
    title: "Associate AE",
    minSessions: 0,
    minAverageScore: 0,
    summary: "Learning account structure, dealer context, and core scenario flow.",
    checklist: [
      "Complete your first training session",
      "Understand dealer growth plan structure",
      "Practice opening and discovery consistently",
    ],
    reward: "Access to foundational coaching flow and rep readiness tracking.",
    nextReward: "Unlock structured coaching path and guided account missions.",
  },
  {
    level: 2,
    title: "Account Executive I",
    minSessions: 3,
    minAverageScore: 60,
    summary: "Demonstrates early consistency in scenario completion and account awareness.",
    checklist: [
      "Complete at least 3 training sessions",
      "Maintain average score of 60+",
      "Show repeatable scenario participation",
    ],
    reward: "Recognized as building consistency with measurable rep development.",
    nextReward: "Unlock stronger visibility and early performance recognition.",
  },
  {
    level: 3,
    title: "Account Executive II",
    minSessions: 6,
    minAverageScore: 70,
    summary: "Shows stronger sales judgment, better value framing, and improving close discipline.",
    checklist: [
      "Complete at least 6 training sessions",
      "Maintain average score of 70+",
      "Demonstrate stronger value-story execution",
    ],
    reward: "Eligible for stronger internal visibility and more advanced growth scenarios.",
    nextReward: "Unlock advanced scenario missions and higher rep credibility.",
  },
  {
    level: 4,
    title: "Senior Account Executive",
    minSessions: 10,
    minAverageScore: 80,
    summary: "Operates with higher readiness, stronger dealer strategy, and more leadership confidence.",
    checklist: [
      "Complete at least 10 training sessions",
      "Maintain average score of 80+",
      "Show strong discovery and close patterns",
    ],
    reward: "Viewed as advanced rep talent with leadership-facing readiness signals.",
    nextReward: "Unlock leadership-facing readiness and advanced growth strategy status.",
  },
  {
    level: 5,
    title: "Strategic Growth Leader",
    minSessions: 15,
    minAverageScore: 90,
    summary: "Represents elite readiness and strategic dealer growth capability.",
    checklist: [
      "Complete at least 15 training sessions",
      "Maintain average score of 90+",
      "Demonstrate high-level strategic consistency",
    ],
    reward: "Top-tier status with strongest coaching credibility and growth ownership.",
    nextReward: "Unlock elite recognition, top coaching profile, and strategic dealer ownership.",
  },
];

export function calculateTrainingAverage(results) {
  if (!results.length) return 0;
  return Math.round(
    results.reduce((sum, entry) => sum + Number(entry.totalScore ?? entry.score ?? 0), 0) /
      results.length
  );
}

export function getCurrentTrainingLevel(trainingCount, averageScore) {
  let current = TRAINING_LEVELS[0];
  for (const level of TRAINING_LEVELS) {
    if (trainingCount >= level.minSessions && averageScore >= level.minAverageScore) {
      current = level;
    }
  }
  return current;
}

export function getTrainingLevelData(trainingCount, averageTrainingScore) {
  const current = getCurrentTrainingLevel(trainingCount, averageTrainingScore);
  const next = TRAINING_LEVELS.find((l) => l.level === current.level + 1) ?? null;

  if (!next) {
    return {
      current,
      next: null,
      progressPercent: 100,
      requirementSummary: "All advancement milestones achieved.",
      nextChecklistComplete: [],
    };
  }

  const sessionProgress = Math.min((trainingCount / next.minSessions) * 100, 100);
  const scoreProgress = next.minAverageScore
    ? Math.min((averageTrainingScore / next.minAverageScore) * 100, 100)
    : 100;
  const progressPercent = Math.round((sessionProgress + scoreProgress) / 2);

  return {
    current,
    next,
    progressPercent,
    requirementSummary: `Need ${Math.max(next.minSessions - trainingCount, 0)} more training session(s) and average score of ${next.minAverageScore}+ to advance.`,
    nextChecklistComplete: [
      trainingCount >= next.minSessions,
      averageTrainingScore >= next.minAverageScore,
      trainingCount > 0 && averageTrainingScore > 0,
    ],
  };
}
