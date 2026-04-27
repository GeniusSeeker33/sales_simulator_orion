import { useState } from "react";
import Layout from "../components/layout/Layout";
import { employees, getEmployeeFullName } from "../data/employees";
import { loadSimulatorResults } from "../lib/simulatorResultsStore";
import { loadRepProfile } from "../lib/repProfileStore";
import {
  loadPrizes,
  recordDailyWinners,
  getTodayWinners,
  isNewHireEligible,
  generateDailyScore,
  calcTenureMonths,
  PRIZE_TIERS,
} from "../lib/prizesStore";

const MEDAL_STYLES = {
  1: { background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)", color: "#FFD700" },
  2: { background: "rgba(192,192,192,0.1)", border: "1px solid rgba(192,192,192,0.3)", color: "#C0C0C0" },
  3: { background: "rgba(205,127,50,0.1)", border: "1px solid rgba(205,127,50,0.3)", color: "#CD7F32" },
};

const MEDAL_ICONS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function TrainingLeaderboard() {
  const [prizes, setPrizes] = useState(loadPrizes);
  const repProfile = loadRepProfile();
  const simulatorResults = loadSimulatorResults();

  const today = new Date().toISOString().slice(0, 10);
  const todayWinners = getTodayWinners(prizes);
  const standings = buildTodayStandings(repProfile, simulatorResults);
  const allTimeRankings = buildAllTimeRankings(prizes);

  const totalDailyPool = PRIZE_TIERS.reduce(
    (acc, t) => ({ cash: acc.cash + t.cashPrize, gd: acc.gd + t.geniusDollars }),
    { cash: 0, gd: 0 }
  );

  function handleRecordWinners() {
    const top3 = standings.slice(0, 3).map((rep, i) => ({
      rank: i + 1,
      repCode: rep.repCode,
      repName: rep.repName,
      cashPrize: PRIZE_TIERS[i].cashPrize,
      geniusDollars: PRIZE_TIERS[i].geniusDollars,
      score: rep.score,
    }));
    const updated = recordDailyWinners(today, top3);
    setPrizes({ ...updated });
  }

  return (
    <Layout title="Training Prize Leaderboard">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Daily Cash Prize Pool</div>
          <div className="card-value">${totalDailyPool.cash}</div>
          <div className="card-note">Awarded to top 3 reps each day</div>
        </div>

        <div className="card">
          <div className="card-label">Daily GeniusDollars Pool</div>
          <div className="card-value">{totalDailyPool.gd} GD</div>
          <div className="card-note">Genius reward currency, top 3 reps</div>
        </div>

        <div className="card">
          <div className="card-label">Active Competitors</div>
          <div className="card-value">{standings.length}</div>
          <div className="card-note">Employees 6 months or less tenure</div>
        </div>

        <div className="card">
          <div className="card-label">Today's Leader</div>
          <div className="card-value" style={{ fontSize: "1.1rem" }}>
            {standings[0]?.repName ?? "—"}
          </div>
          <div className="card-note">
            {standings[0] ? `Score: ${standings[0].score}/100` : "No scores yet today"}
          </div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Today's Training Standings</h2>
                <p className="section-subtext">
                  Live daily rankings for all new hire employees (6 months or less). Top 3 earn daily cash and GeniusDollars prizes.
                </p>
              </div>

              {todayWinners.length === 0 && (
                <button className="btn-primary" onClick={handleRecordWinners}>
                  Record Today's Winners
                </button>
              )}
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Rep</th>
                    <th>Months Employed</th>
                    <th>Today's Score</th>
                    <th>Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((rep, index) => {
                    const rank = index + 1;
                    const tier = PRIZE_TIERS.find((t) => t.rank === rank);
                    const medalStyle = MEDAL_STYLES[rank] || {};

                    return (
                      <tr
                        key={rep.repCode}
                        style={rank <= 3 ? { ...medalStyle, borderLeft: `3px solid ${medalStyle.color}` } : {}}
                        className={rep.isCurrentUser ? "row-active" : ""}
                      >
                        <td>
                          <strong style={{ color: medalStyle.color || "inherit" }}>
                            {MEDAL_ICONS[rank] || `#${rank}`}
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong>{rep.repName}</strong>
                            <span style={{ opacity: 0.6, fontSize: "0.85rem" }}>
                              {rep.isCurrentUser ? "You — Live profile" : rep.location}
                            </span>
                          </div>
                        </td>
                        <td>{rep.tenureMonths} mo</td>
                        <td>
                          <strong>{rep.score}/100</strong>
                        </td>
                        <td>
                          {tier ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ color: "#4ade80", fontWeight: 600 }}>${tier.cashPrize} Cash</span>
                              <span style={{ color: "#818cf8", fontSize: "0.85rem" }}>{tier.geniusDollars} GeniusDollars</span>
                            </div>
                          ) : (
                            <span style={{ opacity: 0.45 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {standings.length === 0 && (
                <p className="coach-text" style={{ marginTop: 16 }}>
                  No eligible competitors found. New hire employees (6 months or less) will appear here.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Winners History</h2>
                <p className="section-subtext">
                  Daily prize winners over the last 7 recorded sessions.
                </p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>🥇 1st — $10 + 100 GD</th>
                    <th>🥈 2nd — $6 + 65 GD</th>
                    <th>🥉 3rd — $3 + 30 GD</th>
                  </tr>
                </thead>
                <tbody>
                  {prizes.dailyWinners.slice(0, 7).map((day) => (
                    <tr key={day.date}>
                      <td>{formatDate(day.date)}</td>
                      {[1, 2, 3].map((rank) => {
                        const winner = day.winners.find((w) => w.rank === rank);
                        return (
                          <td key={rank}>
                            {winner ? (
                              <div>
                                <strong>{winner.repName}</strong>
                                <span style={{ opacity: 0.6, fontSize: "0.85rem", display: "block" }}>
                                  Score: {winner.score}/100
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {prizes.dailyWinners.length === 0 && (
                <p className="coach-text" style={{ marginTop: 16 }}>
                  No winners recorded yet. Record today's winners using the button above.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-side-stack">
          {todayWinners.length > 0 ? (
            <div className="card">
              <h2>Today's Winners</h2>
              {todayWinners.map((winner) => (
                <div
                  key={winner.rank}
                  style={{
                    ...MEDAL_STYLES[winner.rank],
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                        {MEDAL_ICONS[winner.rank]} {winner.repName}
                      </div>
                      <div style={{ opacity: 0.7, fontSize: "0.85rem", marginTop: 2 }}>
                        Score: {winner.score}/100
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#4ade80", fontWeight: 700 }}>${winner.cashPrize}</div>
                      <div style={{ color: "#818cf8", fontSize: "0.85rem" }}>{winner.geniusDollars} GD</div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                className="btn-secondary"
                style={{ marginTop: 8, width: "100%" }}
                onClick={handleRecordWinners}
              >
                Re-record Today's Winners
              </button>
            </div>
          ) : (
            <div className="card">
              <h2>Today's Podium</h2>
              <p className="coach-text">
                Today's winners have not been recorded yet. Click "Record Today's Winners" to lock in today's top 3 and award prizes.
              </p>
              <button
                className="btn-primary"
                style={{ marginTop: 8, width: "100%" }}
                onClick={handleRecordWinners}
              >
                Record Today's Winners
              </button>
            </div>
          )}

          <div className="card">
            <h2>Prize Structure</h2>
            <p className="section-subtext" style={{ marginBottom: 14 }}>
              Prizes awarded daily to top 3 scorers in the AI Sales Simulator. Eligible for first 6 months of employment.
            </p>

            {PRIZE_TIERS.map((tier) => (
              <div
                key={tier.rank}
                style={{
                  ...MEDAL_STYLES[tier.rank],
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{MEDAL_ICONS[tier.rank]} {tier.label}</strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#4ade80", fontWeight: 700 }}>${tier.cashPrize} Cash</div>
                  <div style={{ color: "#818cf8", fontSize: "0.85rem" }}>{tier.geniusDollars} GeniusDollars</div>
                </div>
              </div>
            ))}

            <div className="insight-box" style={{ marginTop: 14 }}>
              <div className="card-label">Eligibility</div>
              <p className="coach-text">
                Open to all sales employees within their first 6 months. Rankings reset daily at midnight. Scores are based on AI Sales Simulator session performance.
              </p>
            </div>
          </div>

          <div className="card">
            <h2>All-Time Earnings</h2>
            <p className="section-subtext" style={{ marginBottom: 12 }}>
              Cumulative prize earnings since the competition launched.
            </p>

            {allTimeRankings.length > 0 ? (
              allTimeRankings.map((rep, index) => (
                <div key={rep.repCode} className="feedback-row">
                  <div>
                    <strong>#{index + 1} {rep.repName}</strong>
                    <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>
                      {rep.wins} win{rep.wins !== 1 ? "s" : ""} · {rep.podiums} podium{rep.podiums !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#4ade80", fontWeight: 600 }}>${rep.totalCash}</div>
                    <div style={{ color: "#818cf8", fontSize: "0.85rem" }}>{rep.totalGeniusDollars} GD</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="coach-text">No earnings recorded yet.</p>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function buildTodayStandings(repProfile, simulatorResults) {
  const today = new Date().toISOString().slice(0, 10);

  const todaySimScores = simulatorResults
    .filter((r) => r.createdAt && r.createdAt.slice(0, 10) === today)
    .reduce((acc, r) => {
      const name = (r.assignedRep || "").toLowerCase().trim();
      const score = Number(r.score?.overall ?? r.score ?? 0);
      if (!acc[name] || score > acc[name]) acc[name] = score;
      return acc;
    }, {});

  const currentUserName = (repProfile.repName || "AE User").toLowerCase().trim();
  const currentUserTodayScore = todaySimScores[currentUserName] || null;

  const eligibleEmployees = employees.filter((emp) => isNewHireEligible(emp.hireDate));

  const standings = eligibleEmployees.map((emp) => {
    const fullName = getEmployeeFullName(emp);
    const isCurrentUser =
      fullName.toLowerCase() === currentUserName || emp.preferredName?.toLowerCase() === currentUserName;

    let score;
    if (isCurrentUser && currentUserTodayScore !== null) {
      score = currentUserTodayScore;
    } else if (isCurrentUser && repProfile.repName) {
      const allTimeAvg = simulatorResults.length
        ? Math.round(
            simulatorResults.reduce((s, r) => s + Number(r.score?.overall ?? r.score ?? 0), 0) /
              simulatorResults.length
          )
        : 0;
      score = allTimeAvg > 0 ? allTimeAvg : generateDailyScore(emp.code);
    } else {
      score = generateDailyScore(emp.code);
    }

    return {
      repCode: emp.code,
      repName: fullName,
      location: emp.location,
      hireDate: emp.hireDate,
      tenureMonths: calcTenureMonths(emp.hireDate),
      score,
      isCurrentUser: isCurrentUser && !!repProfile.repName,
    };
  });

  return standings.sort((a, b) => b.score - a.score);
}

function buildAllTimeRankings(prizes) {
  return Object.entries(prizes.repEarnings)
    .map(([repCode, data]) => ({ repCode, ...data }))
    .sort((a, b) => b.totalGeniusDollars - a.totalGeniusDollars);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
