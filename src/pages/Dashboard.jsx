import Layout from "../components/layout/Layout";
import { dashboardData } from "../data/dashboard";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <Layout title="Dashboard">
      {/* KPI ROW */}
      <section className="kpi-grid">
        {dashboardData.kpis.map((kpi) => (
          <div key={kpi.id} className="card">
            <div className="card-label">{kpi.label}</div>
            <div className="card-value">{kpi.value}</div>
            <div className="card-note">{kpi.note}</div>
          </div>
        ))}
      </section>

      <section className="dashboard-main-grid">
        {/* LEFT SIDE */}
        <div className="dashboard-main-stack">
          {/* MISSIONS */}
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Today's Missions</h2>
                <p className="section-subtext">
                  Daily actions tied directly to production and growth.
                </p>
              </div>
            </div>

            <ul className="mission-list">
              {dashboardData.missions.map((mission) => (
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

          {/* AI COACH + TRAINING SNAPSHOT */}
          <div className="two-column dashboard-two-column">
            <div className="card">
              <h2>{dashboardData.aiCoach.title}</h2>
              <p className="coach-text">
                {dashboardData.aiCoach.message}
              </p>
            </div>

            <div className="card">
              <h2>Training Snapshot</h2>
              <div className="feedback-row">
                <span>Primary Scenario</span>
                <strong>{dashboardData.trainingSnapshot.scenario}</strong>
              </div>
              <div className="feedback-row">
                <span>Average Score</span>
                <strong>{dashboardData.trainingSnapshot.averageScore}</strong>
              </div>
              <p className="coach-text">
                {dashboardData.trainingSnapshot.recommendation}
              </p>
            </div>
          </div>

          {/* DEALER SPOTLIGHT */}
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Dealer Spotlight</h2>
                <p className="section-subtext">
                  Account growth mission requiring attention right now.
                </p>
              </div>
              <span className="status-pill status-risk">At Risk</span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Dealer</span>
                <strong>
                  {dashboardData.dealerSpotlight.dealerName}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Growth Gap</span>
                <strong>
                  {dashboardData.dealerSpotlight.growthGap}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Current Sales</span>
                <strong>
                  {dashboardData.dealerSpotlight.currentSales}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Target Sales</span>
                <strong>
                  {dashboardData.dealerSpotlight.targetSales}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Category</span>
                <strong>
                  {dashboardData.dealerSpotlight.categoryToExpand}
                </strong>
              </div>
              <div className="mini-stat">
                <span>Barrier</span>
                <strong>
                  {dashboardData.dealerSpotlight.barrier}
                </strong>
              </div>
            </div>

            <p className="coach-text">
              Next move: {dashboardData.dealerSpotlight.nextMove}
            </p>

            <div className="button-row">
              <button
                className="btn-primary"
                onClick={() =>
                  navigate("/training", {
                    state: { scenarioType: "Growth Mission" },
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
                      dealerName:
                        dashboardData.dealerSpotlight.dealerName,
                    },
                  })
                }
              >
                View Account
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="dashboard-side-stack">
          {/* LEADERBOARD */}
          <div className="card">
            <h2>Leaderboard Preview</h2>
            {dashboardData.leaderboardPreview.map((rep) => (
              <div key={rep.rank} className="feedback-row">
                <span>
                  #{rep.rank} {rep.name}
                </span>
                <strong>{rep.revenue}</strong>
              </div>
            ))}
          </div>

          {/* LEVEL PROGRESS */}
          <div className="card">
            <h2>Level Progress</h2>

            <div className="feedback-row">
              <span>Current Level</span>
              <strong>
                {dashboardData.levelSnapshot.currentLevel}
              </strong>
            </div>

            <div className="feedback-row">
              <span>Next Level</span>
              <strong>
                {dashboardData.levelSnapshot.nextLevel}
              </strong>
            </div>

            <div className="progress-meta">
              <span>Progress</span>
              <span>
                {dashboardData.levelSnapshot.progressPercent}%
              </span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${dashboardData.levelSnapshot.progressPercent}%`,
                }}
              />
            </div>

            <div className="card-note">
              {dashboardData.levelSnapshot.requirementSummary}
            </div>

            <div className="insight-box">
              <div className="card-label">Next Reward</div>
              <p className="coach-text">
                {dashboardData.levelSnapshot.nextReward}
              </p>
            </div>
          </div>

          {/* REP SNAPSHOT */}
          <div className="card">
            <h2>Rep Snapshot</h2>

            <div className="feedback-row">
              <span>Rep</span>
              <strong>{dashboardData.user.name}</strong>
            </div>

            <div className="feedback-row">
              <span>Title</span>
              <strong>{dashboardData.user.levelTitle}</strong>
            </div>

            <div className="feedback-row">
              <span>Commission Boost</span>
              <strong>{dashboardData.user.commissionBoost}</strong>
            </div>

            <div className="feedback-row">
              <span>Weekly Bonus</span>
              <strong>
                {dashboardData.user.weeklyBonusAvailable}
              </strong>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}