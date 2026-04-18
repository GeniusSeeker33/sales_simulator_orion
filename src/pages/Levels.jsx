import Layout from "../components/layout/Layout";
import { loadTrainingResults } from "../lib/trainingStore";
import {
  calculateTrainingAverage,
  getCurrentTrainingLevel,
  getTrainingLevelData,
  TRAINING_LEVELS,
} from "../data/trainingLevels";

export default function Levels() {
  const trainingResults = loadTrainingResults();

  const averageScore = calculateTrainingAverage(trainingResults);

  const levelData = getTrainingLevelData(trainingResults.length, averageScore);
  const currentLevel = levelData.current;
  const nextLevel = levelData.next;
  const progressData = {
    progressPercent: levelData.progressPercent,
    requirementSummary: levelData.requirementSummary,
    nextChecklistComplete: levelData.nextChecklistComplete,
  };

  const recentResults = trainingResults.slice(0, 8);

  return (
    <Layout title="Level Progression">
      <section className="dashboard-main-grid">
        <div className="dashboard-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Level Progression</h2>
                <p className="section-subtext">
                  Live advancement based on completed training performance.
                </p>
              </div>

              <span className="status-pill status-positive">
                Level {currentLevel.level}
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Current Level</span>
                <strong>{currentLevel.title}</strong>
              </div>

              <div className="mini-stat">
                <span>Training Sessions</span>
                <strong>{trainingResults.length}</strong>
              </div>

              <div className="mini-stat">
                <span>Average Score</span>
                <strong>
                  {trainingResults.length ? `${averageScore}/100` : "No data"}
                </strong>
              </div>

              <div className="mini-stat">
                <span>Next Level</span>
                <strong>{nextLevel ? nextLevel.title : "Max Level"}</strong>
              </div>
            </div>

            <p className="coach-text">{currentLevel.summary}</p>

            <div className="progress-meta">
              <span>Advancement Progress</span>
              <span>{progressData.progressPercent}%</span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressData.progressPercent}%` }}
              />
            </div>

            <div className="card-note">{progressData.requirementSummary}</div>

            <div className="insight-box">
              <div className="card-label">Current Reward</div>
              <p className="coach-text">{currentLevel.reward}</p>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Advancement Checklist</h2>
                <p className="section-subtext">
                  Requirements for current and upcoming progression.
                </p>
              </div>
            </div>

            <ul className="mission-list">
              {currentLevel.checklist.map((item, index) => (
                <li key={`current-${index}`}>
                  <div className="mission-left">
                    <span className="mission-indicator mission-complete">✓</span>
                    <span>{item}</span>
                  </div>
                  <strong>Current</strong>
                </li>
              ))}

              {nextLevel &&
                nextLevel.checklist.map((item, index) => (
                  <li key={`next-${index}`}>
                    <div className="mission-left">
                      <span
                        className={`mission-indicator ${
                          progressData.nextChecklistComplete[index]
                            ? "mission-complete"
                            : "mission-incomplete"
                        }`}
                      >
                        {progressData.nextChecklistComplete[index] ? "✓" : "•"}
                      </span>
                      <span>{item}</span>
                    </div>
                    <strong>Next</strong>
                  </li>
                ))}
            </ul>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>Recent Performance</h2>
                <p className="section-subtext">
                  Latest completed scenario results contributing to progression.
                </p>
              </div>
            </div>

            {recentResults.length > 0 ? (
              <div className="history-list">
                {recentResults.map((entry) => (
                  <div key={entry.id} className="feedback-row">
                    <span>
                      {entry.scenarioType} • {entry.dealerName} •{" "}
                      {formatDate(entry.completedAt)}
                    </span>
                    <strong>{entry.totalScore}/100</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="coach-text">
                No training data yet. Complete a Growth Mission from Accounts to
                begin advancing levels.
              </p>
            )}
          </div>
        </div>

        <div className="dashboard-side-stack">
          <div className="card">
            <h2>Rep Snapshot</h2>

            <div className="feedback-row">
              <span>Rep</span>
              <strong>AE User</strong>
            </div>

            <div className="feedback-row">
              <span>Current Title</span>
              <strong>{currentLevel.title}</strong>
            </div>

            <div className="feedback-row">
              <span>Sessions Completed</span>
              <strong>{trainingResults.length}</strong>
            </div>

            <div className="feedback-row">
              <span>Average Score</span>
              <strong>
                {trainingResults.length ? `${averageScore}/100` : "No data"}
              </strong>
            </div>
          </div>

          <div className="card">
            <h2>Leadership View</h2>

            <div className="feedback-row">
              <span>Readiness Status</span>
              <strong>{getReadinessLabel(trainingResults.length, averageScore)}</strong>
            </div>

            <div className="feedback-row">
              <span>Promotion Signal</span>
              <strong>{nextLevel ? "In Progress" : "Top Tier"}</strong>
            </div>

            <div className="feedback-row">
              <span>Training Consistency</span>
              <strong>{getConsistencyLabel(trainingResults.length)}</strong>
            </div>

            <p className="coach-text">
              This page makes rep development measurable by connecting completed
              practice scenarios to advancement milestones leadership can actually
              track.
            </p>
          </div>

          <div className="card">
            <h2>Next Reward</h2>
            <p className="coach-text">
              {nextLevel
                ? nextLevel.reward
                : "All progression milestones achieved. Rep is operating at the highest defined tier."}
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function getReadinessLabel(trainingCount, averageScore) {
  if (trainingCount === 0) return "Not Started";
  if (averageScore < 70) return "Developing";
  if (averageScore < 85) return "Advancing";
  return "Leadership Ready";
}

function getConsistencyLabel(trainingCount) {
  if (trainingCount === 0) return "No Pattern Yet";
  if (trainingCount < 3) return "Early";
  if (trainingCount < 8) return "Building";
  return "Established";
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}