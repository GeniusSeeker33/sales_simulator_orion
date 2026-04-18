import Layout from "../components/layout/Layout";
import { buildRepCompSummary, formatCurrency } from "../lib/compEngine";
import { loadRepProfile } from "../lib/repProfileStore";
import { loadAccounts } from "../lib/accountStore";
import { loadTrainingResults } from "../lib/trainingStore";
import { loadComparisonReps } from "../lib/repRosterStore";
import {
  getCurrentTrainingLevel,
  calculateTrainingAverage,
} from "../data/trainingLevels";

export default function Leaderboard() {
  const accounts = loadAccounts();
  const trainingResults = loadTrainingResults();
  const repMetrics = loadRepProfile();

  const leaderboard = buildLeaderboard(accounts, trainingResults, repMetrics);
  const currentUser = leaderboard.find((rep) => rep.isCurrentUser) || null;

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
  const currentUserAvg = calculateTrainingAverage(currentUserTraining);
  const currentUserLevel = { current: getCurrentTrainingLevel(currentUserTraining.length, currentUserAvg) };

  const currentUserComp = buildRepCompSummary({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const accountCoverageScore = getAccountCoverageScore(accounts);
  const comparisonReps = loadComparisonReps();

  const liveRepEntry = {
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
  };

  const demoEntries = comparisonReps.map((rep) => {
    const comp = buildRepCompSummary({
      startDate: rep.startDate,
      revenue: rep.revenue,
      captures: rep.captures,
      customersSold: rep.customersSold,
    });
    const level = getCurrentTrainingLevel(rep.trainingSessions, rep.trainingAverage);
    return {
      id: rep.id,
      name: rep.name,
      subtitle: rep.isDemo ? "Comparison profile" : "Roster rep",
      trainingAverage: rep.trainingAverage,
      trainingSessions: rep.trainingSessions,
      levelLabel: `L${level.level} — ${level.title}`,
      compStatus: !comp.kpiMeasurementActive ? "Ramp" : comp.hitAllKpis ? "Accelerated" : "Base",
      totalComp: comp.totalEstimatedCompensation,
      compositeScore: calculateCompositeScore({
        trainingAverage: rep.trainingAverage,
        trainingSessions: rep.trainingSessions,
        level: level.level,
        accelerated: comp.hitAllKpis,
        inRamp: !comp.kpiMeasurementActive,
        accountCoverageScore,
      }),
      isCurrentUser: false,
    };
  });

  const reps = [liveRepEntry, ...demoEntries];

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