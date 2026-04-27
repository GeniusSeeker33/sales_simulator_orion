import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
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
  { level: 1, title: "Associate AE", minSessions: 0, minAverageScore: 0 },
  { level: 2, title: "Account Executive I", minSessions: 3, minAverageScore: 60 },
  { level: 3, title: "Account Executive II", minSessions: 6, minAverageScore: 70 },
  { level: 4, title: "Senior Account Executive", minSessions: 10, minAverageScore: 80 },
  { level: 5, title: "Strategic Growth Leader", minSessions: 15, minAverageScore: 90 },
];

const DEFAULT_VISIBLE = 4;

export default function Leaderboard() {
  const { session } = useAuth();
  const [showAll, setShowAll] = useState(false);

  const accounts = loadAccounts();
  const trainingResults = loadTrainingResults();
  const repMetrics = loadRepProfile();
  const prizes = loadPrizes();
  const simulatorResults = loadSimulatorResults();

  const accountCoverageScore = getAccountCoverageScore(accounts);
  const leaderboard = buildFullLeaderboard(accounts, trainingResults, repMetrics, accountCoverageScore, session);
  const currentUser = leaderboard.find((rep) => rep.isCurrentUser) || null;
  const todayWinners = getTodayWinners(prizes);
  const newHireStandings = buildNewHireStandings(repMetrics, simulatorResults).slice(0, 5);

  const topRows = leaderboard.slice(0, DEFAULT_VISIBLE);
  const currentUserInTop = currentUser && currentUser.rank <= DEFAULT_VISIBLE;
  const displayedRows = showAll
    ? leaderboard
    : currentUserInTop || !currentUser
    ? topRows
    : [...topRows, { ...currentUser, isSeparated: true }];

  return (
    <Layout title="Leaderboard">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Top Rep Score</div>
          <div className="card-value">{leaderboard[0]?.compositeScore ?? 0}</div>
          <div className="card-note">Composite readiness score</div>
        </div>

        <div className="card">
          <div className="card-label">Your Rank</div>
          <div className="card-value">{currentUser ? `#${currentUser.rank}` : "—"}</div>
          <div className="card-note">Out of {leaderboard.length} sales executives</div>
        </div>

        <div className="card">
          <div className="card-label">Your Comp Status</div>
          <div className="card-value">{currentUser?.compStatus ?? "—"}</div>
          <div className="card-note">Ramp / Accelerated / Base</div>
        </div>

        <div className="card">
          <div className="card-label">Total Sales Executives</div>
          <div className="card-value">{leaderboard.length}</div>
          <div className="card-note">Ranked on live leaderboard</div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Live Readiness Leaderboard</h2>
                <p className="section-subtext">
                  All {leaderboard.length} sales executives ranked by performance readiness, KPI qualification, training activity, and compensation status.
                  {!showAll && ` Showing top ${DEFAULT_VISIBLE} — expand to see full roster.`}
                </p>
              </div>
              <button
                className={showAll ? "btn-secondary" : "btn-primary"}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show Top 4" : `Show All ${leaderboard.length} Reps`}
              </button>
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
                    <th>Est. Monthly Comp</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((rep, idx) => (
                    <>
                      {rep.isSeparated && (
                        <tr key="separator">
                          <td
                            colSpan={8}
                            style={{
                              textAlign: "center",
                              padding: "6px",
                              color: "#97a3c6",
                              fontSize: "0.8rem",
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            ·  ·  ·  your position  ·  ·  ·
                          </td>
                        </tr>
                      )}
                      <tr
                        key={rep.id}
                        className={rep.isCurrentUser ? "row-active" : ""}
                        style={rep.isCurrentUser ? { outline: "1px solid rgba(61,220,151,0.3)" } : {}}
                      >
                        <td>
                          <strong style={{ color: MEDAL_COLORS[rep.rank] || "inherit" }}>
                            {rep.rank <= 3 ? MEDAL_ICONS[rep.rank] : `#${rep.rank}`}
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong>{rep.name}</strong>
                            <span style={{ opacity: 0.6, fontSize: "0.82rem" }}>
                              {rep.isCurrentUser ? "You · Live profile" : rep.subtitle}
                            </span>
                          </div>
                        </td>
                        <td><strong>{rep.compositeScore}</strong></td>
                        <td>{rep.trainingAverageLabel}</td>
                        <td>{rep.trainingSessions}</td>
                        <td style={{ fontSize: "0.85rem" }}>{rep.levelLabel}</td>
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
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {!showAll && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button
                  className="btn-secondary"
                  style={{ width: "100%" }}
                  onClick={() => setShowAll(true)}
                >
                  Show All {leaderboard.length} Sales Executives ↓
                </button>
              </div>
            )}

            {showAll && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button
                  className="btn-secondary"
                  style={{ width: "100%" }}
                  onClick={() => setShowAll(false)}
                >
                  Collapse to Top 4 ↑
                </button>
              </div>
            )}
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
                  The leaderboard reflects what leadership actually cares about.
                </p>
              </div>
            </div>

            <ul className="mission-list">
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Training average contributes to readiness</span>
                </div>
                <strong>Skill — 40%</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Training volume contributes to consistency</span>
                </div>
                <strong>Discipline — 20%</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Level progression reflects career advancement</span>
                </div>
                <strong>Growth — 15%</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>KPI qualification drives compensation status</span>
                </div>
                <strong>Performance — 15%</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Account plan coverage rewards dealer execution</span>
                </div>
                <strong>Execution — 10%</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="dashboard-side-stack">
          {leaderboard[0] && (
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
          )}

          {currentUser && (
            <div className="card">
              <h2>Your Snapshot</h2>
              {buildUserRows(currentUser).map((row) => (
                <div key={row.label} className="feedback-row">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          )}

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
              This leaderboard ranks all {leaderboard.length} sales executives using training readiness, KPI attainment, compensation qualification, and account execution in one view. Scales to 80+ reps automatically.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

// ─── Data Builders ─────────────────────────────────────────────────────────────

function buildFullLeaderboard(accounts, trainingResults, repMetrics, accountCoverageScore, session) {
  const currentRepCode = session?.repCode || null;
  const currentUserTraining = trainingResults;

  const currentUserAvg = currentUserTraining.length
    ? Math.round(
        currentUserTraining.reduce((s, e) => s + Number(e.totalScore ?? e.score ?? 0), 0) /
          currentUserTraining.length
      )
    : 0;

  const currentUserLevel = getLevelData(currentUserTraining.length, currentUserAvg);

  const currentUserComp = buildRepCompSummary({
    startDate: repMetrics.startDate,
    revenue: repMetrics.revenue,
    captures: repMetrics.captures,
    customersSold: repMetrics.customersSold,
  });

  const reps = employees.map((emp) => {
    const isCurrentUser = currentRepCode
      ? emp.code === currentRepCode
      : getEmployeeFullName(emp).toLowerCase() === (repMetrics.repName || "").toLowerCase();

    if (isCurrentUser) {
      return {
        id: `rep-${emp.code}`,
        name: getEmployeeFullName(emp),
        subtitle: emp.location,
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
    }

    return buildSeededRep(emp, accountCoverageScore);
  });

  return reps
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((rep, index) => ({
      ...rep,
      rank: index + 1,
      trainingAverageLabel: rep.trainingSessions > 0 ? `${rep.trainingAverage}/100` : "No data",
      totalCompLabel: formatCurrency(rep.totalComp),
    }));
}

function buildSeededRep(emp, accountCoverageScore) {
  const hash = Math.abs(
    emp.code.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 1)
  );

  const tenureMonths = calcTenureMonths(emp.hireDate);
  const trainingAverage = 55 + (hash % 40);
  const trainingSessions = 1 + (hash % 17);
  const levelData = getLevelData(trainingSessions, trainingAverage);

  const revenue = Math.min(30000 + tenureMonths * 22000 + (hash % 60000), 500000);
  const captures = 4 + (hash % 14);
  const customersSold = 10 + (hash % 90);

  const comp = buildRepCompSummary({
    startDate: emp.hireDate,
    revenue,
    captures,
    customersSold,
  });

  const compStatus = !comp.kpiMeasurementActive
    ? "Ramp"
    : comp.hitAllKpis
    ? "Accelerated"
    : "Base";

  const score = calculateCompositeScore({
    trainingAverage,
    trainingSessions,
    level: levelData.current.level,
    accelerated: comp.hitAllKpis,
    inRamp: !comp.kpiMeasurementActive,
    accountCoverageScore: 40 + (hash % 55),
  });

  return {
    id: `rep-${emp.code}`,
    name: getEmployeeFullName(emp),
    subtitle: emp.location,
    trainingAverage,
    trainingSessions,
    levelLabel: `L${levelData.current.level} — ${levelData.current.title}`,
    compStatus,
    totalComp: comp.totalEstimatedCompensation,
    compositeScore: score,
    isCurrentUser: false,
  };
}

function getAccountCoverageScore(accounts) {
  if (!accounts.length) return 0;
  const activePlans = accounts.filter(
    (a) => a.categoryToExpand || a.aeActionRequired || a.howWeGetThere
  ).length;
  return Math.round((activePlans / accounts.length) * 100);
}

function calculateCompositeScore({ trainingAverage = 0, trainingSessions = 0, level = 1, accelerated = false, inRamp = false, accountCoverageScore = 0 }) {
  const trainingScore = Math.min(trainingAverage, 100) * 0.4;
  const consistencyScore = Math.min(trainingSessions * 8, 100) * 0.2;
  const levelScore = Math.min(level * 20, 100) * 0.15;
  const compScore = inRamp ? 8 : accelerated ? 15 : 5;
  const executionScore = Math.min(accountCoverageScore, 100) * 0.1;
  return Math.round(trainingScore + consistencyScore + levelScore + compScore + executionScore);
}

function getLevelData(trainingCount, averageTrainingScore) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (trainingCount >= level.minSessions && averageTrainingScore >= level.minAverageScore) {
      current = level;
    }
  }
  return { current };
}

function buildUserRows(rep) {
  return [
    { label: "Rank", value: `#${rep.rank} of ${rep.totalReps || "—"}` },
    { label: "Composite Score", value: rep.compositeScore },
    { label: "Training Average", value: rep.trainingAverageLabel },
    { label: "Training Sessions", value: rep.trainingSessions },
    { label: "Level", value: rep.levelLabel },
    { label: "Comp Status", value: rep.compStatus },
    { label: "Est. Monthly Comp", value: rep.totalCompLabel },
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
      if (isCurrentUser && todayScore) score = todayScore;
      else if (isCurrentUser && simulatorResults.length) {
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
