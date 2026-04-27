import Layout from "../components/layout/Layout";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  buildCompKpiCards,
  buildCompOpportunitySummary,
  buildKpiStatusMessage,
  buildLeadershipCompBreakdown,
  formatCurrency,
} from "../lib/compEngine";
import { loadRepProfile } from "../lib/repProfileStore";
import { loadAccounts } from "../lib/accountStore";
import { loadTrainingResults } from "../lib/trainingStore";
import { loadPrizes, getTodayWinners, getRepEarnings, isNewHireEligible, generateDailyScore, calcTenureMonths, PRIZE_TIERS } from "../lib/prizesStore";
import { employees, getEmployeeFullName } from "../data/employees";
import { loadSimulatorResults } from "../lib/simulatorResultsStore";

const MEDAL_ICONS = { 1: "🥇", 2: "🥈", 3: "🥉" };

const LEVELS = [
  {
    level: 1,
    title: "Associate AE",
    minSessions: 0,
    minAverageScore: 0,
    nextReward: "Unlock structured coaching path and guided account missions.",
  },
  {
    level: 2,
    title: "Account Executive I",
    minSessions: 3,
    minAverageScore: 60,
    nextReward: "Unlock stronger visibility and early performance recognition.",
  },
  {
    level: 3,
    title: "Account Executive II",
    minSessions: 6,
    minAverageScore: 70,
    nextReward: "Unlock advanced scenario missions and higher rep credibility.",
  },
  {
    level: 4,
    title: "Senior Account Executive",
    minSessions: 10,
    minAverageScore: 80,
    nextReward:
      "Unlock leadership-facing readiness and advanced growth strategy status.",
  },
  {
    level: 5,
    title: "Strategic Growth Leader",
    minSessions: 15,
    minAverageScore: 90,
    nextReward:
      "Unlock elite recognition, top coaching profile, and strategic dealer ownership.",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const accounts = loadAccounts();
  const trainingResults = loadTrainingResults();
  const repMetrics = loadRepProfile();
  const prizes = loadPrizes();
  const simulatorResults = loadSimulatorResults();

  const displayName = session?.name || repMetrics.repName || "AE User";
  const repCode = session?.repCode || null;

  const summary = buildDashboardSummary(accounts, trainingResults, repMetrics);
  const prizeWidget = buildPrizeWidget(repMetrics, prizes, simulatorResults);

  return (
  <Layout title="Dashboard">

    <div
      style={{
        padding: "14px 18px",
        borderRadius: 14,
        background: "rgba(61,220,151,0.07)",
        border: "1px solid rgba(61,220,151,0.15)",
        marginBottom: 4,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <div>
        <span style={{ fontWeight: 700, color: "#3ddc97" }}>
          Welcome back, {displayName.split(" ")[0]}
        </span>
        <span style={{ color: "#97a3c6", marginLeft: 8, fontSize: "0.88rem" }}>
          {repCode ? `Rep Code: ${repCode}` : ""}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Link to="/training-leaderboard" style={{ color: "#818cf8", fontSize: "0.85rem" }}>
          Prize Leaderboard
        </Link>
        <Link to="/sales-simulator" style={{ color: "#3ddc97", fontSize: "0.85rem" }}>
          Launch Simulator
        </Link>
      </div>
    </div>

    <section className="kpi-grid">
      {summary.kpis.map((kpi) => (
        <div key={kpi.id} className="card">
          <div className="card-label">{kpi.label}</div>
          <div className="card-value">{kpi.value}</div>
          <div className="card-note">{kpi.note}</div>
        </div>
      ))}
    </section>

      <section className="kpi-grid" style={{ marginTop: 16 }}>
        {summary.compKpis.map((kpi) => (
          <div key={kpi.id} className="card">
            <div className="card-label">{kpi.label}</div>
            <div className="card-value">{kpi.value}</div>
            <div className="card-note">{kpi.note}</div>
          </div>
        ))}
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Today's Missions</h2>
                <p className="section-subtext">
                  Daily actions tied directly to production, growth, and compensation.
                </p>
              </div>
            </div>

            <ul className="mission-list">
              {summary.missions.map((mission) => (
                <li key={mission.id}>
                  <div className="mission-left">
                    <span
                      className={`mission-indicator ${
                        mission.complete
                          ? "mission-complete"
                          : "mission-incomplete"
                      }`}
                    >
                      {mission.complete ? "✓" : "•"}
                    </span>
                    <span>{mission.label}</span>
                  </div>
                  <strong>{mission.value}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="two-column dashboard-two-column">
            <div className="card">
              <h2>AI Coach</h2>
              <p className="coach-text">{summary.aiCoachMessage}</p>
            </div>

            <div className="card">
              <h2>Training Snapshot</h2>

              <div className="feedback-row">
                <span>Primary Scenario</span>
                <strong>{summary.trainingSnapshot.primaryScenario}</strong>
              </div>

              <div className="feedback-row">
                <span>Average Score</span>
                <strong>{summary.trainingSnapshot.averageScore}</strong>
              </div>

              <p className="coach-text">
                {summary.trainingSnapshot.recommendation}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Compensation Status</h2>
                <p className="section-subtext">
                  Current monthly pay picture based on KPI qualification.
                </p>
              </div>

              <span className={`status-pill ${summary.compStatus.statusTone}`}>
                {summary.compStatus.statusLabel}
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Employment Month</span>
                <strong>{summary.compStatus.employmentMonth}</strong>
              </div>

              <div className="mini-stat">
                <span>Measured KPI Month</span>
                <strong>
                  {summary.compStatus.kpiMeasurementActive
                    ? summary.compStatus.measuredMonth
                    : "Not active"}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Revenue</span>
                <strong>{formatCurrency(summary.compStatus.revenue)}</strong>
              </div>

              <div className="mini-stat">
                <span>Captures</span>
                <strong>{summary.compStatus.captures}</strong>
              </div>

              <div className="mini-stat">
                <span>Customers Sold</span>
                <strong>{summary.compStatus.customersSold}</strong>
              </div>

              <div className="mini-stat">
                <span>Commission Rate</span>
                <strong>{summary.compStatus.commissionRateLabel}</strong>
              </div>

              <div className="mini-stat">
                <span>Capture Goal</span>
                <strong>
                  {summary.compStatus.captureTarget == null
                    ? "Not set"
                    : summary.compStatus.captureTarget}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Total Estimated Comp</span>
                <strong>
                  {formatCurrency(summary.compStatus.totalEstimatedCompensation)}
                </strong>
              </div>
            </div>

            <p className="coach-text">{summary.compStatus.statusMessage}</p>

            {!summary.compStatus.isPreMeasurement &&
              !summary.compStatus.hitAllKpis && (
                <div className="insight-box">
                  <div className="card-label">Missed Upside</div>
                  <p className="coach-text">
                    This rep is currently leaving{" "}
                    <strong>
                      {formatCurrency(summary.compStatus.missedCompensation)}
                    </strong>{" "}
                    on the table this month by missing KPI qualification.
                  </p>
                </div>
              )}
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Dealer Spotlight</h2>
                <p className="section-subtext">
                  Account growth mission requiring attention right now.
                </p>
              </div>

              <span
                className={`status-pill ${
                  summary.dealerSpotlight.progressPercent < 70
                    ? "status-risk"
                    : "status-neutral"
                }`}
              >
                {summary.dealerSpotlight.progressPercent < 70 ? "At Risk" : "Active"}
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Dealer</span>
                <strong>{summary.dealerSpotlight.dealerName}</strong>
              </div>

              <div className="mini-stat">
                <span>Growth Gap</span>
                <strong>{formatCurrency(summary.dealerSpotlight.growthGap)}</strong>
              </div>

              <div className="mini-stat">
                <span>Current Sales</span>
                <strong>{formatCurrency(summary.dealerSpotlight.currentSales)}</strong>
              </div>

              <div className="mini-stat">
                <span>Target Sales</span>
                <strong>{formatCurrency(summary.dealerSpotlight.targetSales)}</strong>
              </div>

              <div className="mini-stat">
                <span>Category</span>
                <strong>{summary.dealerSpotlight.categoryToExpand}</strong>
              </div>

              <div className="mini-stat">
                <span>Barrier</span>
                <strong>{summary.dealerSpotlight.barrier}</strong>
              </div>
            </div>

            <p className="coach-text">
              Next move: {summary.dealerSpotlight.nextMove}
            </p>

            <div className="button-row">
              <button
                className="btn-primary"
                onClick={() =>
                  navigate("/training", {
                    state: {
                      scenarioType: "Growth Mission",
                      dealerName: summary.dealerSpotlight.dealerName,
                      dealerId: summary.dealerSpotlight.id,
                    },
                  })
                }
              >
                Practice Growth Call
              </button>

              <button
                className="btn-secondary"
                onClick={() =>
                  navigate("/accounts", {
                    state: {
                      dealerName: summary.dealerSpotlight.dealerName,
                    },
                  })
                }
              >
                View Account
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-side-stack">
          <div className="card">
            <h2>Compensation Breakdown</h2>

            {summary.compBreakdown.map((row) => (
              <div key={row.label} className="feedback-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Leaderboard Preview</h2>
            {summary.leaderboardPreview.map((rep) => (
              <div key={rep.rank} className="feedback-row">
                <span>
                  #{rep.rank} {rep.name}
                </span>
                <strong>{rep.revenue}</strong>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Level Progress</h2>

            <div className="feedback-row">
              <span>Current Level</span>
              <strong>{summary.levelSnapshot.currentLevel}</strong>
            </div>

            <div className="feedback-row">
              <span>Next Level</span>
              <strong>{summary.levelSnapshot.nextLevel}</strong>
            </div>

            <div className="progress-meta">
              <span>Progress</span>
              <span>{summary.levelSnapshot.progressPercent}%</span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${summary.levelSnapshot.progressPercent}%`,
                }}
              />
            </div>

            <div className="card-note">
              {summary.levelSnapshot.requirementSummary}
            </div>

            <div className="insight-box">
              <div className="card-label">Next Reward</div>
              <p className="coach-text">{summary.levelSnapshot.nextReward}</p>
            </div>
          </div>

          <div className="card">
            <h2>Rep Snapshot</h2>

            <div className="feedback-row">
              <span>Rep</span>
              <strong>{summary.user.name}</strong>
            </div>

            <div className="feedback-row">
              <span>Title</span>
              <strong>{summary.user.levelTitle}</strong>
            </div>

            <div className="feedback-row">
              <span>Comp Status</span>
              <strong>{summary.compStatus.statusLabel}</strong>
            </div>

            <div className="feedback-row">
              <span>Weekly Bonus</span>
              <strong>{summary.user.weeklyBonusAvailable}</strong>
            </div>
          </div>

          {prizeWidget.eligible && (
            <div className="card">
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h2>Training Prize</h2>
                <span className="status-pill status-positive">Active</span>
              </div>

              <p className="section-subtext" style={{ marginBottom: 12 }}>
                New hire competition — first 6 months of employment.
              </p>

              <div className="feedback-row">
                <span>Today's Rank</span>
                <strong style={{ color: prizeWidget.rankColor }}>
                  {MEDAL_ICONS[prizeWidget.todayRank] || `#${prizeWidget.todayRank}`} Place
                </strong>
              </div>

              <div className="feedback-row">
                <span>Today's Score</span>
                <strong>{prizeWidget.todayScore}/100</strong>
              </div>

              {prizeWidget.todayRank <= 3 && (
                <div className="insight-box" style={{ marginTop: 10 }}>
                  <div className="card-label">Today's Prize</div>
                  <p className="coach-text" style={{ margin: "6px 0 0" }}>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>${prizeWidget.todayPrize.cashPrize} Cash</span>
                    {" + "}
                    <span style={{ color: "#818cf8", fontWeight: 700 }}>{prizeWidget.todayPrize.geniusDollars} GeniusDollars</span>
                  </p>
                </div>
              )}

              <div className="feedback-row" style={{ marginTop: 10 }}>
                <span>Total GeniusDollars</span>
                <strong style={{ color: "#818cf8" }}>{prizeWidget.totalGeniusDollars} GD</strong>
              </div>

              <div className="feedback-row">
                <span>Total Cash Earned</span>
                <strong style={{ color: "#4ade80" }}>${prizeWidget.totalCash}</strong>
              </div>

              <div className="feedback-row">
                <span>Career Wins</span>
                <strong>{prizeWidget.totalWins}</strong>
              </div>

              <Link to="/training-leaderboard">
                <button className="btn-secondary" style={{ marginTop: 12, width: "100%" }}>
                  View Prize Leaderboard
                </button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

function buildDashboardSummary(accounts, trainingResults, repMetrics) {
  const totalPipeline = accounts.reduce(
    (sum, account) => sum + Number(account.currentMonthTarget ?? 0),
    0
  );

  const currentRevenue = accounts.reduce(
    (sum, account) => sum + Number(account.lastMonthSales ?? 0),
    0
  );

  const totalGrowthGap = accounts.reduce(
    (sum, account) => sum + Number(account.growthGap ?? 0),
    0
  );

  const atRiskAccounts = accounts.filter((account) => account.progressPercent < 70);
  const activePlans = accounts.filter(
    (account) =>
      account.categoryToExpand ||
      account.aeActionRequired ||
      account.howWeGetThere
  );

  const averageTrainingScore = trainingResults.length
    ? Math.round(
        trainingResults.reduce(
          (sum, entry) => sum + Number(entry.totalScore ?? entry.score ?? 0),
          0
        ) / trainingResults.length
      )
    : 0;

  const scenarioCounts = trainingResults.reduce((acc, entry) => {
    const key = entry.scenarioType || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const primaryScenario =
    Object.entries(scenarioCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Growth Mission";

  const levelData = getLevelData(trainingResults.length, averageTrainingScore);
  const spotlightDealer =
    [...accounts].sort((a, b) => Number(b.growthGap) - Number(a.growthGap))[0] ??
    fallbackSpotlight();

  const compKpis = buildCompKpiCards({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const compOpportunity = buildCompOpportunitySummary({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const compBreakdown = buildLeadershipCompBreakdown({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const compStatusMessage = buildKpiStatusMessage({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const completedMissions = [
    trainingResults.length >= 1,
    averageTrainingScore >= 75,
    activePlans.length >= Math.max(1, Math.ceil(accounts.length * 0.6)),
    compOpportunity.actual.kpiMeasurementActive
      ? compOpportunity.actual.hitAllKpis
      : false,
  ].filter(Boolean).length;

  const compStatus = {
    startDate: repMetrics.startDate,
    employmentMonth: compOpportunity.actual.employmentMonth,
    measuredMonth: compOpportunity.actual.measuredMonth,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
    captureTarget: compOpportunity.actual.kpiTargets.minimumCaptures,
    hitAllKpis: compOpportunity.actual.hitAllKpis,
    kpiMeasurementActive: compOpportunity.actual.kpiMeasurementActive,
    isPreMeasurement: !compOpportunity.actual.kpiMeasurementActive,
    commissionRateLabel: compOpportunity.actual.revenueCommissionRateLabel,
    totalEstimatedCompensation:
      compOpportunity.actual.totalEstimatedCompensation,
    missedCompensation: compOpportunity.missedCompensation,
    statusMessage: compStatusMessage,
    statusLabel: !compOpportunity.actual.kpiMeasurementActive
      ? "Ramp Buffer"
      : compOpportunity.actual.hitAllKpis
      ? "Accelerated Tier"
      : "Base Tier",
    statusTone: !compOpportunity.actual.kpiMeasurementActive
      ? "status-neutral"
      : compOpportunity.actual.hitAllKpis
      ? "status-positive"
      : "status-risk",
  };

  return {
    kpis: [
      {
        id: "kpi-1",
        label: "Revenue in Motion",
        value: formatCurrency(currentRevenue),
        note: `${accounts.length} managed accounts`,
      },
      {
        id: "kpi-2",
        label: "Pipeline Target",
        value: formatCurrency(totalPipeline),
        note: "Combined monthly target",
      },
      {
        id: "kpi-3",
        label: "Growth Gap",
        value: formatCurrency(totalGrowthGap),
        note: `${atRiskAccounts.length} account(s) below 70% to target`,
      },
      {
        id: "kpi-4",
        label: "Training Avg",
        value: trainingResults.length ? `${averageTrainingScore}/100` : "No data",
        note: `${trainingResults.length} completed training session(s)`,
      },
    ],

    compKpis,

    missions: [
      {
        id: "mission-1",
        label: "Complete one training scenario",
        value: trainingResults.length > 0 ? "Done" : "Pending",
        complete: trainingResults.length > 0,
      },
      {
        id: "mission-2",
        label: "Maintain average score of 75+",
        value: trainingResults.length ? `${averageTrainingScore}/100` : "No score yet",
        complete: trainingResults.length > 0 && averageTrainingScore >= 75,
      },
      {
        id: "mission-3",
        label: "Update active dealer growth plans",
        value: `${activePlans.length}/${accounts.length} accounts`,
        complete: activePlans.length >= Math.max(1, Math.ceil(accounts.length * 0.6)),
      },
      {
        id: "mission-4",
        label: compOpportunity.actual.kpiMeasurementActive
          ? "Hit all 3 monthly compensation KPIs"
          : "Complete first 4 weeks of ramp",
        value: compOpportunity.actual.kpiMeasurementActive
          ? compOpportunity.actual.hitAllKpis
            ? "Qualified"
            : "Missed"
          : `${Math.max(28 - compOpportunity.actual.daysEmployed, 0)} day(s) remaining`,
        complete: compOpportunity.actual.kpiMeasurementActive
          ? compOpportunity.actual.hitAllKpis
          : false,
      },
    ],

    aiCoachMessage: buildAiCoachMessage({
      averageTrainingScore,
      trainingCount: trainingResults.length,
      atRiskCount: atRiskAccounts.length,
      spotlightDealer,
      compOpportunity,
    }),

    trainingSnapshot: {
      primaryScenario,
      averageScore: trainingResults.length ? `${averageTrainingScore}/100` : "No score yet",
      recommendation: buildTrainingRecommendation(
        trainingResults.length,
        averageTrainingScore
      ),
    },

    compStatus,
    compBreakdown,

    dealerSpotlight: {
      id: spotlightDealer.id,
      dealerName: spotlightDealer.dealerName,
      growthGap: spotlightDealer.growthGap,
      currentSales: spotlightDealer.lastMonthSales,
      targetSales: spotlightDealer.currentMonthTarget,
      categoryToExpand: spotlightDealer.categoryToExpand || "Opportunity review",
      barrier: spotlightDealer.barrier || "Dealer hesitation",
      progressPercent: spotlightDealer.progressPercent,
      nextMove:
        spotlightDealer.aeActionRequired ||
        spotlightDealer.howWeGetThere ||
        "Review plan and launch a growth mission practice call.",
    },

    leaderboardPreview: [
      {
        rank: 1,
        name: repMetrics.repName,
        revenue: formatCurrency(currentRevenue),
      },
      {
        rank: 2,
        name: "Target Attainment",
        revenue: `${
          accounts.length
            ? Math.round((currentRevenue / Math.max(totalPipeline, 1)) * 100)
            : 0
        }%`,
      },
      {
        rank: 3,
        name: "Comp Potential",
        revenue: formatCurrency(compOpportunity.actual.totalEstimatedCompensation),
      },
    ],

    levelSnapshot: {
      currentLevel: `Level ${levelData.current.level} — ${levelData.current.title}`,
      nextLevel: levelData.next
        ? `Level ${levelData.next.level} — ${levelData.next.title}`
        : "Max level reached",
      progressPercent: levelData.progressPercent,
      requirementSummary: levelData.requirementSummary,
      nextReward: levelData.current.nextReward,
    },

    user: {
      name: repMetrics.repName,
      levelTitle: levelData.current.title,
      commissionBoost: !compOpportunity.actual.kpiMeasurementActive
        ? "Ramp buffer active"
        : compOpportunity.actual.hitAllKpis
        ? "Accelerated tier active"
        : "Base tier active",
      weeklyBonusAvailable:
        completedMissions >= 3 ? "Unlocked" : `${3 - completedMissions} action(s) remaining`,
    },
  };
}

function getLevelData(trainingCount, averageTrainingScore) {
  let current = LEVELS[0];

  for (const level of LEVELS) {
    if (
      trainingCount >= level.minSessions &&
      averageTrainingScore >= level.minAverageScore
    ) {
      current = level;
    }
  }

  const next = LEVELS.find((level) => level.level === current.level + 1) ?? null;

  if (!next) {
    return {
      current,
      next: null,
      progressPercent: 100,
      requirementSummary: "All advancement milestones achieved.",
    };
  }

  const sessionProgress = Math.min(
    (trainingCount / next.minSessions) * 100,
    100
  );

  const scoreProgress = next.minAverageScore
    ? Math.min((averageTrainingScore / next.minAverageScore) * 100, 100)
    : 100;

  const progressPercent = Math.round((sessionProgress + scoreProgress) / 2);

  return {
    current,
    next,
    progressPercent,
    requirementSummary: `Need ${Math.max(
      next.minSessions - trainingCount,
      0
    )} more training session(s) and average score of ${next.minAverageScore}+ to advance.`,
  };
}

function buildAiCoachMessage({
  averageTrainingScore,
  trainingCount,
  atRiskCount,
  spotlightDealer,
  compOpportunity,
}) {
  if (!compOpportunity.actual.kpiMeasurementActive) {
    return `This rep is still in the first 4 weeks. Use this period to build habits, train on dealer strategy, and prepare for measured KPI expectations starting next month.`;
  }

  if (!compOpportunity.actual.hitAllKpis && compOpportunity.missedCompensation > 0) {
    return `Compensation is the clearest coaching lever right now. This rep is missing KPI qualification and leaving ${formatCurrency(
      compOpportunity.missedCompensation
    )} on the table. Tighten execution around the missed KPI categories and rehearse the ${spotlightDealer.dealerName} growth mission.`;
  }

  if (trainingCount === 0) {
    return `Start with a Growth Mission for ${spotlightDealer.dealerName}. The fastest way to make this product credible is to connect live account strategy to completed training reps.`;
  }

  if (averageTrainingScore < 75) {
    return `Your training activity is building, but execution still needs tightening. Focus on stronger discovery questions and clearer close attempts, especially on ${spotlightDealer.dealerName}.`;
  }

  if (atRiskCount > 0) {
    return `Training performance is moving in the right direction. Now translate that into account action by tightening dealer plans for your at-risk accounts.`;
  }

  return `Strong momentum. Your training performance, account planning, and compensation qualification are aligned well enough to show leadership how rep development connects directly to dealer growth.`;
}

function buildTrainingRecommendation(trainingCount, averageTrainingScore) {
  if (trainingCount === 0) {
    return "Complete your first live scenario to begin generating readiness data.";
  }

  if (averageTrainingScore < 70) {
    return "Prioritize objection handling and close discipline before scaling scenario difficulty.";
  }

  if (averageTrainingScore < 85) {
    return "Solid progress. Keep practicing Growth Mission scenarios to improve consistency.";
  }

  return "Strong performance. You are ready for more advanced leadership-facing simulations.";
}

function fallbackSpotlight() {
  return {
    id: "fallback-spotlight",
    dealerName: "No Dealer Selected",
    growthGap: 0,
    lastMonthSales: 0,
    currentMonthTarget: 0,
    categoryToExpand: "No account data",
    barrier: "No barrier available",
    progressPercent: 0,
    aeActionRequired: "Load account data to begin planning",
    howWeGetThere: "Open Accounts and update a dealer plan.",
  };
}

function buildPrizeWidget(repMetrics, prizes, simulatorResults) {
  const startDate = repMetrics.startDate;
  const eligible = isNewHireEligible(startDate);

  if (!eligible) {
    return { eligible: false };
  }

  const repCode = employees.find((emp) => {
    const fullName = getEmployeeFullName(emp).toLowerCase();
    const repName = (repMetrics.repName || "").toLowerCase();
    return fullName === repName || emp.preferredName?.toLowerCase() === repName;
  })?.code || "LIVE";

  const today = new Date().toISOString().slice(0, 10);
  const todaySimScores = simulatorResults
    .filter((r) => r.createdAt && r.createdAt.slice(0, 10) === today)
    .map((r) => Number(r.score?.overall ?? r.score ?? 0));

  const todayScore = todaySimScores.length
    ? Math.max(...todaySimScores)
    : simulatorResults.length
    ? Math.round(
        simulatorResults.reduce((s, r) => s + Number(r.score?.overall ?? r.score ?? 0), 0) /
          simulatorResults.length
      )
    : generateDailyScore(repCode);

  const allEligible = employees
    .filter((emp) => isNewHireEligible(emp.hireDate))
    .map((emp) => ({ code: emp.code, score: generateDailyScore(emp.code) }))
    .sort((a, b) => b.score - a.score);

  const myEntry = allEligible.find((e) => e.code === repCode);
  if (myEntry) myEntry.score = todayScore;

  const sortedAll = [...allEligible].sort((a, b) => b.score - a.score);
  const todayRank = sortedAll.findIndex((e) => e.code === repCode) + 1 || sortedAll.length;

  const tierColors = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };
  const rankColor = tierColors[todayRank] || "#eef2ff";
  const todayPrize = PRIZE_TIERS.find((t) => t.rank === todayRank) || null;

  const earnings = getRepEarnings(prizes, repCode);

  return {
    eligible: true,
    todayScore,
    todayRank,
    rankColor,
    todayPrize,
    totalGeniusDollars: earnings.totalGeniusDollars,
    totalCash: earnings.totalCash,
    totalWins: earnings.wins,
    podiums: earnings.podiums,
  };
}