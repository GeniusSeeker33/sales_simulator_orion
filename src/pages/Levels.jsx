import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import {
  aeLevels,
  advancementPaths,
  currentRepSnapshot,
} from "../data/levels";

export default function Levels() {
  const [selectedLevelId, setSelectedLevelId] = useState(currentRepSnapshot.currentLevel);

  const selectedLevel = useMemo(
    () => aeLevels.find((level) => level.id === selectedLevelId),
    [selectedLevelId]
  );

  const activePath = useMemo(
    () =>
      advancementPaths.find(
        (path) => path.fromLevel === currentRepSnapshot.currentLevel
      ),
    []
  );

  const completedRequirements = activePath.requirements.filter(
    (item) => item.complete
  ).length;

  return (
    <Layout title="Level Progress">
      <section className="levels-page-grid">
        <div className="levels-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>AE Level Framework</h2>
                <p className="section-subtext">
                  Development path from Foundation AE to Partner AE.
                </p>
              </div>
            </div>

            <div className="level-selector">
              {aeLevels.map((level) => (
                <button
                  key={level.id}
                  className={`level-chip ${
                    selectedLevelId === level.id ? "level-chip-active" : ""
                  }`}
                  onClick={() => setSelectedLevelId(level.id)}
                >
                  <span>Level {level.levelNumber}</span>
                  <strong>{level.shortName}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <div>
                <h2>
                  Level {selectedLevel.levelNumber}: {selectedLevel.name}
                </h2>
                <p className="section-subtext">{selectedLevel.dealerExperience}</p>
              </div>

              <span
                className={`status-pill ${
                  selectedLevel.id === currentRepSnapshot.currentLevel
                    ? "status-good"
                    : selectedLevel.id < currentRepSnapshot.currentLevel
                    ? "status-good"
                    : "status-warn"
                }`}
              >
                {selectedLevel.id === currentRepSnapshot.currentLevel
                  ? "Current Level"
                  : selectedLevel.id < currentRepSnapshot.currentLevel
                  ? "Unlocked"
                  : "Locked"}
              </span>
            </div>

            <div className="insight-box">
              <div className="card-label">Objective</div>
              <p className="coach-text">{selectedLevel.objective}</p>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Dealer Experience</span>
                <strong>{selectedLevel.dealerExperience}</strong>
              </div>
              <div className="mini-stat">
                <span>Unlocked Reward</span>
                <strong>{selectedLevel.unlockedReward}</strong>
              </div>
            </div>

            <div className="levels-content-grid">
              <div className="insight-box">
                <div className="card-label">Key Verbiage</div>
                <ul className="bullet-list">
                  {selectedLevel.keyVerbiage.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="insight-box">
                <div className="card-label">Core Questions</div>
                <ul className="bullet-list">
                  {selectedLevel.coreQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="insight-box">
              <div className="card-label">Avoid</div>
              <ul className="bullet-list">
                {selectedLevel.avoid.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="levels-side-stack">
          <div className="card">
            <h2>Current Progress</h2>

            <div className="feedback-row">
              <span>Current Level</span>
              <strong>{currentRepSnapshot.currentTitle}</strong>
            </div>
            <div className="feedback-row">
              <span>Current Commission Boost</span>
              <strong>{currentRepSnapshot.commissionBoost}</strong>
            </div>
            <div className="feedback-row">
              <span>Next Reward</span>
              <strong>{currentRepSnapshot.nextReward}</strong>
            </div>

            <div className="progress-item">
              <div className="progress-meta">
                <span>Simulation Score</span>
                <span>{currentRepSnapshot.simulationScore}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${currentRepSnapshot.simulationScore}%` }}
                />
              </div>
            </div>

            <div className="progress-item">
              <div className="progress-meta">
                <span>CRM Compliance</span>
                <span>{currentRepSnapshot.crmCompliance}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${currentRepSnapshot.crmCompliance}%` }}
                />
              </div>
            </div>

            <div className="progress-item">
              <div className="progress-meta">
                <span>Growth Missions</span>
                <span>
                  {currentRepSnapshot.growthMissionsCompleted}/
                  {currentRepSnapshot.growthMissionsRequired}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      (currentRepSnapshot.growthMissionsCompleted /
                        currentRepSnapshot.growthMissionsRequired) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>{activePath.label}</h2>
            <div className="progress-meta">
              <span>Advancement Progress</span>
              <span>{activePath.progressPercent}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${activePath.progressPercent}%` }}
              />
            </div>

            <div className="card-note">
              {completedRequirements} of {activePath.requirements.length} requirements completed
            </div>

            <div className="checklist">
              {activePath.requirements.map((item) => (
                <div key={item.text} className="checklist-item">
                  <span
                    className={`check-indicator ${
                      item.complete ? "check-complete" : "check-incomplete"
                    }`}
                  >
                    {item.complete ? "✓" : "•"}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}