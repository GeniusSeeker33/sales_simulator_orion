import Layout from "../components/layout/Layout";

const TRAINING_STORAGE_KEY = "sales-simulator-orion-training-results-v1";

const LEVELS = [
  {
    level: 1,
    title: "Associate AE",
    minSessions: 0,
    minAverageScore: 0,
    summary:
      "Learning account structure, dealer context, and core scenario flow.",
    checklist: [
      "Complete your first training session",
      "Understand dealer growth plan structure",
      "Practice opening and discovery consistently",
    ],
    reward:
      "Access to foundational coaching flow and rep readiness tracking.",
  },
  {
    level: 2,
    title: "Account Executive I",
    minSessions: 3,
    minAverageScore: 60,
    summary:
      "Demonstrates early consistency in scenario completion and account awareness.",
    checklist: [
      "Complete at least 3 training sessions",
      "Maintain average score of 60+",
      "Show repeatable scenario participation",
    ],
    reward:
      "Recognized as building consistency with measurable rep development.",
  },
  {
    level: 3,
    title: "Account Executive II",
    minSessions: 6,
    minAverageScore: 70,
    summary:
      "Shows stronger sales judgment, better value framing, and improving close discipline.",
    checklist: [
      "Complete at least 6 training sessions",
      "Maintain average score of 70+",
      "Demonstrate stronger value-story execution",
    ],
    reward:
      "Eligible for stronger internal visibility and more advanced growth scenarios.",
  },
  {
    level: 4,
    title: "Senior Account Executive",
    minSessions: 10,
    minAverageScore: 80,
    summary:
      "Operates with higher readiness, stronger dealer strategy, and more leadership confidence.",
    checklist: [
      "Complete at least 10 training sessions",
      "Maintain average score of 80+",
      "Show strong discovery and close patterns",
    ],
    reward:
      "Viewed as advanced rep talent with leadership-facing readiness signals.",
  },
  {
    level: 5,
    title: "Strategic Growth Leader",
    minSessions: 15,
    minAverageScore: 90,
    summary:
      "Represents elite readiness and strategic dealer growth capability.",
    checklist: [
      "Complete at least 15 training sessions",
      "Maintain average score of 90+",
      "Demonstrate high-level strategic consistency",
    ],
    reward:
      "Top-tier status with strongest coaching credibility and growth ownership.",
  },
];

export default function Levels() {
  const trainingResults = loadTrainingResults();

  const averageScore = trainingResults.length
    ? Math.round(
        trainingResults.reduce(
          (sum, entry) => sum + Number(entry.totalScore ?? 0),
          0
        ) / trainingResults.length
      )
    : 0;

  const currentLevel = getCurrentLevel(trainingResults.length, averageScore);
  const nextLevel = LEVELS.find((item) => item.level === currentLevel.level + 1) ?? null;
  const progressData = getProgressData(trainingResults.length, averageScore, nextLevel);

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

function loadTrainingResults() {
  try {
    const raw = localStorage.getItem(TRAINING_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load training results for levels:", error);
    return [];
  }
}

function getCurrentLevel(trainingCount, averageScore) {
  let current = LEVELS[0];

  for (const level of LEVELS) {
    if (
      trainingCount >= level.minSessions &&
      averageScore >= level.minAverageScore
    ) {
      current = level;
    }
  }

  return current;
}

function getProgressData(trainingCount, averageScore, nextLevel) {
  if (!nextLevel) {
    return {
      progressPercent: 100,
      requirementSummary: "All advancement milestones achieved.",
      nextChecklistComplete: [],
    };
  }

  const sessionProgress = Math.min(
    (trainingCount / nextLevel.minSessions) * 100,
    100
  );

  const scoreProgress = nextLevel.minAverageScore
    ? Math.min((averageScore / nextLevel.minAverageScore) * 100, 100)
    : 100;

  const progressPercent = Math.round((sessionProgress + scoreProgress) / 2);

  const nextChecklistComplete = [
    trainingCount >= nextLevel.minSessions,
    averageScore >= nextLevel.minAverageScore,
    trainingCount > 0 && averageScore > 0,
  ];

  return {
    progressPercent,
    requirementSummary: `Need ${Math.max(
      nextLevel.minSessions - trainingCount,
      0
    )} more training session(s) and average score of ${
      nextLevel.minAverageScore
    }+ to advance.`,
    nextChecklistComplete,
  };
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