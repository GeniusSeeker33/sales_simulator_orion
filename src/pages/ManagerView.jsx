import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import { loadRepProfile } from "../lib/repProfileStore";
import { loadTrainingResults } from "../lib/trainingStore";
import { loadSimulatorResults } from "../lib/simulatorResultsStore";
import {
  buildRepCompSummary,
  buildCompOpportunitySummary,
  formatCurrency,
} from "../lib/compEngine";

const LEVELS = [
  { level: 1, title: "Associate AE", minSessions: 0, minAverageScore: 0 },
  { level: 2, title: "Account Executive I", minSessions: 3, minAverageScore: 60 },
  { level: 3, title: "Account Executive II", minSessions: 6, minAverageScore: 70 },
  { level: 4, title: "Senior Account Executive", minSessions: 10, minAverageScore: 80 },
  { level: 5, title: "Strategic Growth Leader", minSessions: 15, minAverageScore: 90 },
];

export default function ManagerView() {
  const [repFilter, setRepFilter] = useState("ALL");
  const [dealerFilter, setDealerFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState("newest");

  const liveRep = loadRepProfile();
  const liveTrainingResults = loadTrainingResults();
  const simulatorResults = loadSimulatorResults();

  const reps = buildRepComparisonData(liveRep, liveTrainingResults);

  const repOptions = useMemo(() => {
    const reps = simulatorResults.map((r) => r.assignedRep).filter(Boolean);
    return ["ALL", ...Array.from(new Set(reps))];
  }, [simulatorResults]);

  const dealerOptions = useMemo(() => {
    const dealers = simulatorResults.map((r) => r.dealerName).filter(Boolean);
    return ["ALL", ...Array.from(new Set(dealers))];
  }, [simulatorResults]);

  const filteredSimulatorResults = useMemo(() => {
    let list = [...simulatorResults];

    if (repFilter !== "ALL") {
      list = list.filter((r) => r.assignedRep === repFilter);
    }

    if (dealerFilter !== "ALL") {
      list = list.filter((r) => r.dealerName === dealerFilter);
    }

    if (sortMode === "lowestScore") {
      list.sort((a, b) => Number(a.score?.overall ?? 0) - Number(b.score?.overall ?? 0));
    }

    if (sortMode === "highestScore") {
      list.sort((a, b) => Number(b.score?.overall ?? 0) - Number(a.score?.overall ?? 0));
    }

    if (sortMode === "newest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (sortMode === "oldest") {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    return list;
  }, [simulatorResults, repFilter, dealerFilter, sortMode]);

  const qualifiedCount = reps.filter(
    (rep) => rep.compSummary.kpiMeasurementActive && rep.compSummary.hitAllKpis
  ).length;

  const inRampCount = reps.filter(
    (rep) => !rep.compSummary.kpiMeasurementActive
  ).length;

  const avgTraining =
    reps.length > 0
      ? Math.round(reps.reduce((sum, rep) => sum + rep.trainingAverage, 0) / reps.length)
      : 0;

  const avgSimulatorScore =
    simulatorResults.length > 0
      ? Math.round(
          simulatorResults.reduce(
            (sum, result) => sum + Number(result.score?.overall ?? 0),
            0
          ) / simulatorResults.length
        )
      : 0;

  return (
    <Layout title="Manager View">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Sales Executives</div>
          <div className="card-value">{reps.length}</div>
          <div className="card-note">Profiles in comparison view</div>
        </div>

        <div className="card">
          <div className="card-label">Qualified for Accelerated Tier</div>
          <div className="card-value">{qualifiedCount}</div>
          <div className="card-note">Measured reps hitting all 3 KPIs</div>
        </div>

        <div className="card">
          <div className="card-label">Still in Ramp Buffer</div>
          <div className="card-value">{inRampCount}</div>
          <div className="card-note">Within first 4 weeks</div>
        </div>

        <div className="card">
          <div className="card-label">Avg Training Score</div>
          <div className="card-value">
            {reps.length ? `${avgTraining}/100` : "No data"}
          </div>
          <div className="card-note">Across comparison set</div>
        </div>

        <div className="card">
          <div className="card-label">Simulator Sessions</div>
          <div className="card-value">{simulatorResults.length}</div>
          <div className="card-note">Completed AI practice calls</div>
        </div>

        <div className="card">
          <div className="card-label">Avg Simulator Score</div>
          <div className="card-value">
            {simulatorResults.length ? `${avgSimulatorScore}/100` : "No data"}
          </div>
          <div className="card-note">Real saved simulator results</div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Sales Executive Comparison</h2>
                <p className="section-subtext">
                  Compare KPI timing, qualification status, training readiness, and pay impact side by side.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Employment Month</th>
                    <th>Measured KPI Month</th>
                    <th>Revenue</th>
                    <th>Captures</th>
                    <th>Customers Sold</th>
                    <th>Comp Status</th>
                    <th>Training Avg</th>
                    <th>Level</th>
                    <th>Total Est. Comp</th>
                    <th>Missed Upside</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((rep) => (
                    <tr key={rep.id} className={rep.isLive ? "row-active" : ""}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong>{rep.name}</strong>
                          <span style={{ opacity: 0.75, fontSize: "0.9rem" }}>
                            {rep.isLive ? "Live profile" : "Comparison profile"}
                          </span>
                        </div>
                      </td>
                      <td>{rep.compSummary.employmentMonth}</td>
                      <td>
                        {rep.compSummary.kpiMeasurementActive
                          ? rep.compSummary.measuredMonth
                          : "Ramp"}
                      </td>
                      <td>{formatCurrency(rep.revenue)}</td>
                      <td>{rep.captures}</td>
                      <td>{rep.customersSold}</td>
                      <td>
                        <span className={`status-pill ${rep.statusTone}`}>
                          {rep.statusLabel}
                        </span>
                      </td>
                      <td>{rep.trainingAverageLabel}</td>
                      <td>{rep.levelLabel}</td>
                      <td>{formatCurrency(rep.compSummary.totalEstimatedCompensation)}</td>
                      <td>{formatCurrency(rep.missedUpside)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Simulator Activity</h2>
                <p className="section-subtext">
                  Filter real AI practice calls by rep, dealer, score, and coaching risk.
                </p>
              </div>
            </div>

            <div className="button-row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
              <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
                {repOptions.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep === "ALL" ? "All Reps" : rep}
                  </option>
                ))}
              </select>

              <select value={dealerFilter} onChange={(e) => setDealerFilter(e.target.value)}>
                {dealerOptions.map((dealer) => (
                  <option key={dealer} value={dealer}>
                    {dealer === "ALL" ? "All Dealers" : dealer}
                  </option>
                ))}
              </select>

              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="lowestScore">Lowest Score First</option>
                <option value="highestScore">Highest Score First</option>
              </select>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Alert</th>
                    <th>Rep</th>
                    <th>Dealer</th>
                    <th>Buyer</th>
                    <th>Score</th>
                    <th>Difficulty</th>
                    <th>Date</th>
                    <th>Coach Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSimulatorResults.map((result) => {
                    const score = Number(result.score?.overall ?? 0);
                    const alert = getCoachingAlert(score, result.error);

                    return (
                      <tr key={result.id}>
                        <td>
                          <span className={`status-pill ${alert.tone}`}>
                            {alert.label}
                          </span>
                        </td>
                        <td>{result.assignedRep || "—"}</td>
                        <td>{result.dealerName || "General Scenario"}</td>
                        <td>{result.primaryBuyer || "—"}</td>
                        <td>{score}/100</td>
                        <td>{result.difficulty || "—"}</td>
                        <td>{formatDate(result.createdAt)}</td>
                        <td style={{ maxWidth: 280 }}>
                          {result.score?.coachingNote || result.error || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredSimulatorResults.length === 0 && (
                <p className="coach-text" style={{ marginTop: 16 }}>
                  No simulator sessions match the current filters.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Manager Notes</h2>
                <p className="section-subtext">
                  What this view helps leadership spot quickly.
                </p>
              </div>
            </div>

            <ul className="mission-list">
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Who is still in the first 4 weeks and not yet measured</span>
                </div>
                <strong>Ramp</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Who is missing KPI qualification and losing commission upside</span>
                </div>
                <strong>Comp</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Who has strong training performance but weak KPI attainment</span>
                </div>
                <strong>Coaching</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Who is fully aligned across training, execution, and compensation</span>
                </div>
                <strong>Readiness</strong>
              </li>
              <li>
                <div className="mission-left">
                  <span className="mission-indicator mission-complete">✓</span>
                  <span>Which reps are completing account-based AI practice calls</span>
                </div>
                <strong>Simulator</strong>
              </li>
            </ul>
          </div>
        </div>

        <div className="dashboard-side-stack">
          <div className="card">
            <h2>Top Opportunity Gap</h2>
            {getTopOpportunityRep(reps) ? (
              <>
                <div className="feedback-row">
                  <span>Rep</span>
                  <strong>{getTopOpportunityRep(reps).name}</strong>
                </div>
                <div className="feedback-row">
                  <span>Missed Upside</span>
                  <strong>{formatCurrency(getTopOpportunityRep(reps).missedUpside)}</strong>
                </div>
                <p className="coach-text">
                  This rep has the largest current compensation gap between actual performance and accelerated-tier qualification.
                </p>
              </>
            ) : (
              <p className="coach-text">No meaningful compensation gap detected.</p>
            )}
          </div>

          <div className="card">
            <h2>Strongest Readiness Signal</h2>
            {getTopReadinessRep(reps) ? (
              <>
                <div className="feedback-row">
                  <span>Rep</span>
                  <strong>{getTopReadinessRep(reps).name}</strong>
                </div>
                <div className="feedback-row">
                  <span>Training Avg</span>
                  <strong>{getTopReadinessRep(reps).trainingAverageLabel}</strong>
                </div>
                <div className="feedback-row">
                  <span>Status</span>
                  <strong>{getTopReadinessRep(reps).statusLabel}</strong>
                </div>
                <p className="coach-text">
                  This rep currently shows the strongest mix of measured performance, compensation alignment, and training readiness.
                </p>
              </>
            ) : (
              <p className="coach-text">No comparison data available.</p>
            )}
          </div>

          <div className="card">
            <h2>Simulator Coaching Snapshot</h2>
            {filteredSimulatorResults.length ? (
              <>
                <div className="feedback-row">
                  <span>Most Recent Dealer</span>
                  <strong>{filteredSimulatorResults[0]?.dealerName || "—"}</strong>
                </div>
                <div className="feedback-row">
                  <span>Most Recent Score</span>
                  <strong>{filteredSimulatorResults[0]?.score?.overall ?? 0}/100</strong>
                </div>
                <div className="feedback-row">
                  <span>Assigned Rep</span>
                  <strong>{filteredSimulatorResults[0]?.assignedRep || "—"}</strong>
                </div>
                <p className="coach-text">
                  {filteredSimulatorResults[0]?.score?.coachingNote ||
                    filteredSimulatorResults[0]?.error ||
                    "Recent simulator activity is available for manager review."}
                </p>
              </>
            ) : (
              <p className="coach-text">
                Simulator sessions will appear here after reps complete account-based practice calls.
              </p>
            )}
          </div>

          <div className="card">
            <h2>Leadership View</h2>
            <p className="coach-text">
              This page is the bridge from individual rep coaching to team-level management. It helps Orion leadership compare where each Sales Executive is in ramp, KPI execution, compensation performance, and AI simulator readiness using one consistent logic model.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function getCoachingAlert(score, error) {
  if (error) return { label: "Review", tone: "status-risk" };
  if (score < 60) return { label: "Coach", tone: "status-risk" };
  if (score < 80) return { label: "Watch", tone: "status-neutral" };
  return { label: "Strong", tone: "status-positive" };
}

function buildRepComparisonData(liveRep, liveTrainingResults) {
  const liveTrainingAverage = calculateTrainingAverage(liveTrainingResults);
  const liveLevel = getLevelData(liveTrainingResults.length, liveTrainingAverage);

  const baseProfiles = [
    {
      id: "rep-live",
      name: liveRep.repName || "AE User",
      startDate: liveRep.startDate,
      revenue: Number(liveRep.revenue ?? 0),
      captures: Number(liveRep.captures ?? 0),
      customersSold: Number(liveRep.customersSold ?? 0),
      trainingAverage: liveTrainingAverage,
      trainingSessions: liveTrainingResults.length,
      level: liveLevel.current,
      isLive: true,
    },
    {
      id: "rep-demo-ramp",
      name: "New Ramp AE",
      startDate: getDateDaysAgo(12),
      revenue: 12000,
      captures: 7,
      customersSold: 9,
      trainingAverage: 68,
      trainingSessions: 2,
      level: LEVELS[0],
      isLive: false,
    },
    {
      id: "rep-demo-mid",
      name: "Mid-Ramp AE",
      startDate: getDateDaysAgo(240),
      revenue: 210000,
      captures: 11,
      customersSold: 63,
      trainingAverage: 76,
      trainingSessions: 8,
      level: LEVELS[2],
      isLive: false,
    },
    {
      id: "rep-demo-strong",
      name: "High Performer AE",
      startDate: getDateDaysAgo(540),
      revenue: 460000,
      captures: 9,
      customersSold: 118,
      trainingAverage: 89,
      trainingSessions: 15,
      level: LEVELS[4],
      isLive: false,
    },
  ];

  return baseProfiles.map((rep) => {
    const compSummary = buildRepCompSummary({
      startDate: rep.startDate,
      revenue: rep.revenue,
      captures: rep.captures,
      customersSold: rep.customersSold,
    });

    const compOpportunity = buildCompOpportunitySummary({
      startDate: rep.startDate,
      revenue: rep.revenue,
      captures: rep.captures,
      customersSold: rep.customersSold,
    });

    const statusLabel = !compSummary.kpiMeasurementActive
      ? "Ramp"
      : compSummary.hitAllKpis
      ? "Accelerated"
      : "Base";

    const statusTone = !compSummary.kpiMeasurementActive
      ? "status-neutral"
      : compSummary.hitAllKpis
      ? "status-positive"
      : "status-risk";

    return {
      ...rep,
      compSummary,
      compOpportunity,
      statusLabel,
      statusTone,
      levelLabel: `L${rep.level.level} — ${rep.level.title}`,
      trainingAverageLabel:
        rep.trainingSessions > 0 ? `${rep.trainingAverage}/100` : "No data",
      missedUpside: compOpportunity.missedCompensation,
      readinessScore: calculateReadinessScore({
        trainingAverage: rep.trainingAverage,
        trainingSessions: rep.trainingSessions,
        level: rep.level.level,
        compSummary,
      }),
    };
  });
}

function calculateTrainingAverage(results) {
  if (!results.length) return 0;

  return Math.round(
    results.reduce(
      (sum, entry) => sum + Number(entry.totalScore ?? entry.score ?? 0),
      0
    ) / results.length
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

function calculateReadinessScore({
  trainingAverage = 0,
  trainingSessions = 0,
  level = 1,
  compSummary,
}) {
  const trainingScore = Math.min(trainingAverage, 100) * 0.45;
  const consistencyScore = Math.min(trainingSessions * 8, 100) * 0.2;
  const levelScore = Math.min(level * 20, 100) * 0.15;
  const compScore = !compSummary.kpiMeasurementActive
    ? 8
    : compSummary.hitAllKpis
    ? 20
    : 8;

  return Math.round(trainingScore + consistencyScore + levelScore + compScore);
}

function getTopOpportunityRep(reps) {
  return [...reps]
    .sort((a, b) => b.missedUpside - a.missedUpside)
    .find((rep) => rep.missedUpside > 0);
}

function getTopReadinessRep(reps) {
  return [...reps].sort((a, b) => b.readinessScore - a.readinessScore)[0] ?? null;
}

function getDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}