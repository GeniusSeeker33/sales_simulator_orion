export const dashboardData = {
  user: {
    name: "Desiree",
    levelTitle: "Account-Aware AE",
    levelProgressPercent: 72,
    commissionBoost: "+0.01%",
    weeklyBonusAvailable: "$85",
  },

  kpis: [
    { id: 1, label: "Calls Today", value: "72 / 100", note: "+12 vs yesterday" },
    { id: 2, label: "Revenue Today", value: "$8,450", note: "On pace" },
    { id: 3, label: "Avg Order Size", value: "$312", note: "+8%" },
    { id: 4, label: "Rank", value: "#6 / 35", note: "Climbing" },
  ],

  missions: [
    { id: 1, label: "Run 3 simulations", value: "3 / 3", complete: true },
    { id: 2, label: "Close 2 growth gaps", value: "1 / 2", complete: false },
    { id: 3, label: "Hit 100 outbound dials", value: "72 / 100", complete: false },
  ],

  aiCoach: {
    title: "AI Coach Recommendation",
    message:
      "You are improving on agreement-first language, but you are still leaving money on the table after objections.",
  },

  dealerSpotlight: {
    dealerName: "Smith Tactical",
    currentSales: "$38,000",
    targetSales: "$43,700",
    growthGap: "$5,700",
    categoryToExpand: "Optics",
    barrier: "Confidence",
    nextMove:
      "Lead with proven fast movers and ask for a test order this week.",
  },

  trainingSnapshot: {
    scenario: "Price Objection",
    averageScore: "84",
    recommendation:
      "Focus on asking a stronger commitment question after your reframe.",
  },

  leaderboardPreview: [
    { rank: 1, name: "John D", revenue: "$12,400" },
    { rank: 2, name: "Sarah K", revenue: "$11,200" },
    { rank: 3, name: "Desiree T", revenue: "$9,800" },
  ],

  levelSnapshot: {
    currentLevel: "Level 2: Account-Aware AE",
    nextLevel: "Level 3: Growth-Driven AE",
    progressPercent: 72,
    requirementSummary: "6 of 9 requirements complete",
    nextReward: "+0.02% commission boost",
  },
};