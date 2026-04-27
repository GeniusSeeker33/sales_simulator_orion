import { Link } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { buildRepCompSummary, formatCurrency } from "../lib/compEngine";
import { loadRepProfile } from "../lib/repProfileStore";
import { loadAccounts } from "../lib/accountStore";
import { loadTrainingResults } from "../lib/trainingStore";
import { loadPrizes, getTodayWinners, PRIZE_TIERS, isNewHireEligible, generateDailyScore, calcTenureMonths } from "../lib/prizesStore";
import { employees, getEmployeeFullName } from "../data/employees";
import { loadSimulatorResults } from "../lib/simulatorResultsStore";

const MEDAL_ICONS = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MEDAL_COLORS = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

const LEVELS = [
  {
    level: 1,
    title: "Associate AE",
    minSessions: 0,
    minAverageScore: 0,
  },
  {
    level: 2,
    title: "Account Executive I",
    minSessions: 3,
    minAverageScore: 60,
  },
  {
    level: 3,
    title: "Account Executive II",
    minSessions: 6,
    minAverageScore: 70,
  },
  {
    level: 4,
    title: "Senior Account Executive",
    minSessions: 10,
    minAverageScore: 80,
  },
  {
    level: 5,
    title: "Strategic Growth Leader",
    minSessions: 15,
    minAverageScore: 90,
  },
];

export default function Leaderboard() {
  const accounts = loadAccounts();
  const trainingResults = loadTrainingResults();
  const repMetrics = loadRepProfile();
  const prizes = loadPrizes();
  const simulatorResults = loadSimulatorResults();

  const leaderboard = buildLeaderboard(accounts, trainingResults, repMetrics);
  const currentUser = leaderboard.find((rep) => rep.isCurrentUser) || null;
  const todayWinners = getTodayWinners(prizes);
  const newHireStandings = buildNewHireStandings(repMetrics, simulatorResults).slice(0, 5);

  return (
    <Layout title="Leaderboard">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Top Rep Score</div>
          <div className="card-value">{leaderboard[0]?.compositeScore ?? 0}</div>
          <div className="card-note">Composite readiness score</div>
        </div>

        <div className="card">
          <div className="card-label">Current User Rank</div>
          <div className="card-value">
            {currentUser ? `#${currentUser.rank}` : "—"}
          </div>
          <div className="card-note">Position on live leaderboard</div>
        </div>

        <div className="card">
          <div className="card-label">Current User Comp Status</div>
          <div className="card-value">{currentUser?.compStatus ?? "—"}</div>
          <div className="card-note">Ramp / accelerated / base</div>
        </div>

        <div className="card">
          <div className="card-label">Current User Level</div>
          <div className="card-value">{currentUser?.levelLabel ?? "—"}</div>
          <div className="card-note">Progression tier</div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Live Readiness Leaderboard</h2>
                <p className="section-subtext">
                  Ranking reps by performance readiness, KPI qualification, account execution, and compensation status.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Rep</th>
                    <th>Composite Score</th>
                    <th>Training Avg</th>
                    <th>Sessions</th>
                    <th>Level</th>
                    <th>Comp Status</th>
                    <th>Total Est. Comp</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((rep) => (
                    <tr
                      key={rep.id}
                      className={rep.isCurrentUser ? "row-active" : ""}
                    >
                      <td>#{rep.rank}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong>{rep.name}</strong>
                          <span style={{ opacity: 0.75, fontSize: "0.9rem" }}>
                            {rep.subtitle}
                          </span>
                        </div>
                      </td>
                      <td>{rep.compositeScore}</td>
                      <td>{rep.trainingAverageLabel}</td>
                      <td>{rep.trainingSessions}</td>
                      <td>{rep.levelLabel}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            rep.compStatus === "Accelerated"
                              ? "status-positive"
                              : rep.compStatus === "Ramp"
                              ? "status-neutral"
                              : "status-risk"
                          }`}
                        >
                          {rep.compStatus}
                        </span>
                      </td>
                      <td>{rep.totalCompLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>New Hire Training Prize Leaderboard</h2>
                <p className="section-subtext">
                  Daily cash and GeniusDollars prizes for employees within their first 6 months. Top 3 scorers in the AI Sales Simulator win every day.
                </p>
              </div>
              <Link to="/training-leaderboard">
                <button className="btn-secondary">Full View</button>
              </Link>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Rep</th>
                    <th>Months Employed</th>
                    <th>Score</th>
                    <th>Daily Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {newHireStandings.map((rep, index) => {
                    const rank = index + 1;
                    const tier = PRIZE_TIERS.find((t) => t.rank === rank);
                    const color = MEDAL_COLORS[rank];

                    return (
                      <tr key={rep.repCode}>
                        <td>
                          <strong style={{ color: color || "inherit" }}>
                            {MEDAL_ICONS[rank] || `#${rank}`}
                          </strong>
                        </td>
                        <td><strong>{rep.repName}</strong></td>
                        <td>{rep.tenureMonths} mo</td>
                        <td>{rep.score}/100</td>
                        <td>
                          {tier ? (
                            <span>
                              <span style={{ color: "#4ade80", fontWeight: 600 }}>${tier.cashPrize}</span>
                              {" + "}
                              <span style={{ color: "#818cf8" }}>{tier.geniusDollars} GD</span>
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {todayWinners.length > 0 && (
              <div className="insight-box" style={{ marginTop: 14 }}>
                <div className="card-label">Today's Recorded Winners</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                  {todayWinners.map((w) => (
                    <span key={w.rank} style={{ color: MEDAL_COLORS[w.rank] }}>
                      {MEDAL_ICONS[w.rank]} {w.repName} — ${w.cashPrize} + {w.geniusDollars} GD
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>How Ranking Works</h2>
                <p className="section-subtext">
                  The leaderboard is designed to reflect what leadership actually cares about.
                </p>
              </div>
            </div>

            <ul className="mission-list">
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Training average contributes to readiness</span>
                </div>
                <strong>Skill</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Training volume contributes to consistency</span>
                </div>
                <strong>Discipline</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>KPI qualification drives compensation status</span>
                </div>
                <strong>Performance</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Account plan coverage rewards dealer execution</span>
                </div>
                <strong>Execution</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="dashboard-side-stack">
          {leaderboard[0] ? (
            <div className="card">
              <h2>Top Performer Snapshot</h2>

              <div className="feedback-row">
                <span>Rep</span>
                <strong>{leaderboard[0].name}</strong>
              </div>

              <div className="feedback-row">
                <span>Composite Score</span>
                <strong>{leaderboard[0].compositeScore}</strong>
              </div>

              <div className="feedback-row">
                <span>Training Average</span>
                <strong>{leaderboard[0].trainingAverageLabel}</strong>
              </div>

              <div className="feedback-row">
                <span>Level</span>
                <strong>{leaderboard[0].levelLabel}</strong>
              </div>

              <div className="feedback-row">
                <span>Comp Status</span>
                <strong>{leaderboard[0].compStatus}</strong>
              </div>
            </div>
          ) : null}

          {currentUser ? (
            <div className="card">
              <h2>Your Snapshot</h2>

              {buildUserRows(currentUser).map((row) => (
                <div key={row.label} className="feedback-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="card">
            <h2>Daily Prize Summary</h2>
            <p className="section-subtext" style={{ marginBottom: 12 }}>
              New hire competition (first 6 months) — prizes reset daily.
            </p>

            {PRIZE_TIERS.map((tier) => (
              <div key={tier.rank} className="feedback-row">
                <span>{MEDAL_ICONS[tier.rank]} {tier.label}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>${tier.cashPrize} </span>
                  <span style={{ color: "#818cf8", fontSize: "0.85rem" }}>+ {tier.geniusDollars} GD</span>
                </div>
              </div>
            ))}

            <Link to="/training-leaderboard">
              <button className="btn-secondary" style={{ marginTop: 12, width: "100%" }}>
                View Prize Leaderboard
              </button>
            </Link>
          </div>

          <div className="card">
            <h2>Leadership View</h2>
            <p className="coach-text">
              This leaderboard now ranks sales performance using more than raw revenue. It connects rep development, KPI attainment, compensation qualification, and account execution in one view.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function buildLeaderboard(accounts, trainingResults, repMetrics) {
  const currentUserTraining = trainingResults;
  const currentUserAvg =
    currentUserTraining.length > 0
      ? Math.round(
          currentUserTraining.reduce(
            (sum, entry) => sum + Number(entry.totalScore ?? entry.score ?? 0),
            0
          ) / currentUserTraining.length
        )
      : 0;

  const currentUserLevel = getLevelData(
    currentUserTraining.length,
    currentUserAvg
  );

  const currentUserComp = buildRepCompSummary({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const accountCoverageScore = getAccountCoverageScore(accounts);

  const reps = [
    {
      id: "rep-current-user",
      name: repMetrics.repName || "AE User",
      subtitle: "Live user profile",
      trainingAverage: currentUserAvg,
      trainingSessions: currentUserTraining.length,
      levelLabel: `L${currentUserLevel.current.level} — ${currentUserLevel.current.title}`,
      compStatus: !currentUserComp.kpiMeasurementActive
        ? "Ramp"
        : currentUserComp.hitAllKpis
        ? "Accelerated"
        : "Base",
      totalComp: currentUserComp.totalEstimatedCompensation,
      compositeScore: calculateCompositeScore({
        trainingAverage: currentUserAvg,
        trainingSessions: currentUserTraining.length,
        level: currentUserLevel.current.level,
        accelerated: currentUserComp.hitAllKpis,
        inRamp: !currentUserComp.kpiMeasurementActive,
        accountCoverageScore,
      }),
      isCurrentUser: true,
    },
    {
      id: "rep-demo-1",
      name: "Top Performing AE",
      subtitle: "Demo comparison profile",
      trainingAverage: Math.max(currentUserAvg + 8, 88),
      trainingSessions: Math.max(currentUserTraining.length + 4, 10),
      levelLabel: "L4 — Senior Account Executive",
      compStatus: "Accelerated",
      totalComp: currentUserComp.totalEstimatedCompensation * 1.18,
      compositeScore: calculateCompositeScore({
        trainingAverage: Math.max(currentUserAvg + 8, 88),
        trainingSessions: Math.max(currentUserTraining.length + 4, 10),
        level: 4,
        accelerated: true,
        inRamp: false,
        accountCoverageScore: Math.max(accountCoverageScore + 10, 85),
      }),
      isCurrentUser: false,
    },
    {
      id: "rep-demo-2",
      name: "Developing AE",
      subtitle: "Demo comparison profile",
      trainingAverage: currentUserTraining.length
        ? Math.max(currentUserAvg - 7, 62)
        : 62,
      trainingSessions: Math.max(currentUserTraining.length - 1, 2),
      levelLabel: "L2 — Account Executive I",
      compStatus: "Base",
      totalComp: currentUserComp.totalEstimatedCompensation * 0.84,
      compositeScore: calculateCompositeScore({
        trainingAverage: currentUserTraining.length
          ? Math.max(currentUserAvg - 7, 62)
          : 62,
        trainingSessions: Math.max(currentUserTraining.length - 1, 2),
        level: 2,
        accelerated: false,
        inRamp: false,
        accountCoverageScore: Math.max(accountCoverageScore - 12, 50),
      }),
      isCurrentUser: false,
    },
    {
      id: "rep-demo-3",
      name: "Consistent AE",
      subtitle: "Demo comparison profile",
      trainingAverage: currentUserTraining.length
        ? Math.max(currentUserAvg - 2, 76)
        : 76,
      trainingSessions: Math.max(currentUserTraining.length + 1, 6),
      levelLabel: "L3 — Account Executive II",
      compStatus: "Accelerated",
      totalComp: currentUserComp.totalEstimatedCompensation * 1.05,
      compositeScore: calculateCompositeScore({
        trainingAverage: currentUserTraining.length
          ? Math.max(currentUserAvg - 2, 76)
          : 76,
        trainingSessions: Math.max(currentUserTraining.length + 1, 6),
        level: 3,
        accelerated: true,
        inRamp: false,
        accountCoverageScore: Math.max(accountCoverageScore + 3, 70),
      }),
      isCurrentUser: false,
    },
  ];

  return reps
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((rep, index) => ({
      ...rep,
      rank: index + 1,
      trainingAverageLabel:
        rep.trainingSessions > 0 ? `${rep.trainingAverage}/100` : "No data",
      totalCompLabel: formatCurrency(rep.totalComp),
    }));
}

function getAccountCoverageScore(accounts) {
  if (!accounts.length) return 0;

  const activePlans = accounts.filter(
    (account) =>
      account.categoryToExpand ||
      account.aeActionRequired ||
      account.howWeGetThere
  ).length;

  return Math.round((activePlans / accounts.length) * 100);
}

function calculateCompositeScore({
  trainingAverage = 0,
  trainingSessions = 0,
  level = 1,
  accelerated = false,
  inRamp = false,
  accountCoverageScore = 0,
}) {
  const trainingScore = Math.min(trainingAverage, 100) * 0.4;
  const consistencyScore = Math.min(trainingSessions * 8, 100) * 0.2;
  const levelScore = Math.min(level * 20, 100) * 0.15;
  const compScore = inRamp ? 8 : accelerated ? 15 : 5;
  const executionScore = Math.min(accountCoverageScore, 100) * 0.1;

  return Math.round(
    trainingScore + consistencyScore + levelScore + compScore + executionScore
  );
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

  return { current };
}

function buildUserRows(rep) {
  return [
    {
      label: "Rank",
      value: `#${rep.rank}`,
    },
    {
      label: "Composite Score",
      value: rep.compositeScore,
    },
    {
      label: "Training Average",
      value: rep.trainingAverageLabel,
    },
    {
      label: "Training Sessions",
      value: rep.trainingSessions,
    },
    {
      label: "Level",
      value: rep.levelLabel,
    },
    {
      label: "Comp Status",
      value: rep.compStatus,
    },
    {
      label: "Estimated Compensation",
      value: rep.totalCompLabel,
    },
  ];
}

function buildNewHireStandings(repProfile, simulatorResults) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySimScores = simulatorResults
    .filter((r) => r.createdAt && r.createdAt.slice(0, 10) === today)
    .reduce((acc, r) => {
      const name = (r.assignedRep || "").toLowerCase().trim();
      const score = Number(r.score?.overall ?? r.score ?? 0);
      if (!acc[name] || score > acc[name]) acc[name] = score;
      return acc;
    }, {});

  const currentUserName = (repProfile.repName || "").toLowerCase().trim();

  return employees
    .filter((emp) => isNewHireEligible(emp.hireDate))
    .map((emp) => {
      const fullName = getEmployeeFullName(emp);
      const isCurrentUser = fullName.toLowerCase() === currentUserName;
      const todayScore = todaySimScores[currentUserName];

      let score;
      if (isCurrentUser && todayScore) {
        score = todayScore;
      } else if (isCurrentUser && simulatorResults.length) {
        score = Math.round(
          simulatorResults.reduce((s, r) => s + Number(r.score?.overall ?? r.score ?? 0), 0) /
            simulatorResults.length
        );
      } else {
        score = generateDailyScore(emp.code);
      }

      return {
        repCode: emp.code,
        repName: fullName,
        tenureMonths: calcTenureMonths(emp.hireDate),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}