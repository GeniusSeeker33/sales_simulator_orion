import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { trainingScenarios } from "../data/training";

const initialProgress = {
  "Price Objection": { completed: 1, averageScore: 78 },
  Competition: { completed: 2, averageScore: 84 },
  "Email Brush-Off": { completed: 1, averageScore: 80 },
  "Growth Mission": { completed: 0, averageScore: 0 },
};

export default function Training() {
  const location = useLocation();
  const requestedScenarioType = location.state?.scenarioType;
  const requestedDealerName = location.state?.dealerName;

  const defaultScenario = useMemo(() => {
    if (!requestedScenarioType) return trainingScenarios[0];

    const match = trainingScenarios.find(
      (scenario) => scenario.type === requestedScenarioType
    );

    return match || trainingScenarios[0];
  }, [requestedScenarioType]);

  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenario.id);
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setSelectedScenarioId(defaultScenario.id);
    setResponse("");
    setSubmitted(false);
  }, [defaultScenario]);

  const selectedScenario = useMemo(
    () =>
      trainingScenarios.find((scenario) => scenario.id === selectedScenarioId) ||
      trainingScenarios[0],
    [selectedScenarioId]
  );

  const evaluation = useMemo(() => {
    if (!submitted || !response.trim()) return null;

    const lower = response.toLowerCase();

    const agreementHit =
      lower.includes("fair") ||
      lower.includes("understand") ||
      lower.includes("totally") ||
      lower.includes("absolutely") ||
      lower.includes("perfect");

    const questionHit = lower.includes("?");
    const valueHit =
      lower.includes("profit") ||
      lower.includes("margin") ||
      lower.includes("value") ||
      lower.includes("turn") ||
      lower.includes("inventory") ||
      lower.includes("availability");

    const closeHit =
      lower.includes("open to") ||
      lower.includes("commit") ||
      lower.includes("get this moving") ||
      lower.includes("order") ||
      lower.includes("test") ||
      lower.includes("backup");

    let score = 0;
    if (agreementHit) score += 25;
    if (valueHit) score += 25;
    if (questionHit) score += 25;
    if (closeHit) score += 25;

    return {
      score,
      agreement: agreementHit ? "Strong" : "Missing",
      value: valueHit ? "Present" : "Needs stronger reframe",
      control: questionHit ? "Good" : "Missing direct question",
      close: closeHit ? "Present" : "Missing next-step language",
    };
  }, [submitted, response]);

  function handleSubmit() {
    if (!response.trim()) return;

    setSubmitted(true);

    const lower = response.toLowerCase();

    const agreementHit =
      lower.includes("fair") ||
      lower.includes("understand") ||
      lower.includes("totally") ||
      lower.includes("absolutely") ||
      lower.includes("perfect");

    const questionHit = lower.includes("?");
    const valueHit =
      lower.includes("profit") ||
      lower.includes("margin") ||
      lower.includes("value") ||
      lower.includes("turn") ||
      lower.includes("inventory") ||
      lower.includes("availability");

    const closeHit =
      lower.includes("open to") ||
      lower.includes("commit") ||
      lower.includes("get this moving") ||
      lower.includes("order") ||
      lower.includes("test") ||
      lower.includes("backup");

    let score = 0;
    if (agreementHit) score += 25;
    if (valueHit) score += 25;
    if (questionHit) score += 25;
    if (closeHit) score += 25;

    const newAttempt = {
      id: Date.now(),
      scenarioType: selectedScenario.type,
      scenarioTitle: selectedScenario.title,
      dealerName: requestedDealerName || "General Drill",
      score,
      response,
    };

    setHistory((prev) => [newAttempt, ...prev].slice(0, 6));
  }

  function handleReset() {
    setResponse("");
    setSubmitted(false);
  }

  function handleScenarioChange(id) {
    setSelectedScenarioId(id);
    setResponse("");
    setSubmitted(false);
  }

  return (
    <Layout title="Training">
      <section className="training-page-grid">
        <div className="training-main-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Scenario Library</h2>
                <p className="section-subtext">
                  Practice real Orion conversations and score your response.
                </p>
              </div>
            </div>

            <div className="scenario-picker">
              {trainingScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`scenario-button ${
                    selectedScenarioId === scenario.id ? "scenario-button-active" : ""
                  }`}
                  onClick={() => handleScenarioChange(scenario.id)}
                >
                  <span className="scenario-type">{scenario.type}</span>
                  <strong>{scenario.title}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="training-layout">
            <div className="card">
              <div className="scenario-tag">{selectedScenario.type}</div>

              {requestedDealerName && (
                <div className="dealer-context-banner">
                  Dealer Context: <strong>{requestedDealerName}</strong>
                </div>
              )}

              <h2>{selectedScenario.title}</h2>
              <p className="dealer-quote">“{selectedScenario.dealerLine}”</p>
              <p className="coach-text">Goal: {selectedScenario.goal}</p>

              <textarea
                className="response-box"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your response here..."
              />

              <div className="button-row">
                <button className="btn-primary" onClick={handleSubmit}>
                  Submit Response
                </button>
                <button className="btn-secondary" onClick={handleReset}>
                  Reset
                </button>
              </div>
            </div>

            <div className="card">
              <h2>Live Feedback</h2>

              {!submitted || !evaluation ? (
                <p className="muted">
                  Submit your response to score this drill and compare it to a top
                  performer answer.
                </p>
              ) : (
                <>
                  <div className="score-panel">
                    <div className="score-circle">{evaluation.score}</div>
                    <div>
                      <div className="card-label">Scenario Score</div>
                      <div className="card-value score-value-text">
                        {scoreLabel(evaluation.score)}
                      </div>
                    </div>
                  </div>

                  <div className="feedback-list">
                    <div className="feedback-row">
                      <span>Agreement First</span>
                      <strong>{evaluation.agreement}</strong>
                    </div>
                    <div className="feedback-row">
                      <span>Value / Reframe</span>
                      <strong>{evaluation.value}</strong>
                    </div>
                    <div className="feedback-row">
                      <span>Control / Question</span>
                      <strong>{evaluation.control}</strong>
                    </div>
                    <div className="feedback-row">
                      <span>Close Attempt</span>
                      <strong>{evaluation.close}</strong>
                    </div>
                  </div>

                  <div className="insight-box">
                    <div className="card-label">Coaching Tip</div>
                    <p className="coach-text">{selectedScenario.coachingTip}</p>
                  </div>

                  <div className="insight-box">
                    <div className="card-label">Top Performer Answer</div>
                    <p className="coach-text">
                      {selectedScenario.topPerformerAnswer}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="training-side-stack">
          <div className="card">
            <h2>Scenario Progress</h2>
            <div className="progress-stack">
              {Object.entries(initialProgress).map(([type, stats]) => (
                <div key={type} className="progress-item">
                  <div className="progress-meta">
                    <span>{type}</span>
                    <span>{stats.averageScore}% avg</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${stats.averageScore}%` }}
                    />
                  </div>
                  <div className="card-note">{stats.completed} completed drills</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Recent Attempts</h2>

            {history.length === 0 ? (
              <p className="muted">
                No attempts yet. Submit a response to build your history.
              </p>
            ) : (
              <div className="history-list">
                {history.map((attempt) => (
                  <div key={attempt.id} className="history-item">
                    <div className="feedback-row">
                      <span>{attempt.scenarioType}</span>
                      <strong>{attempt.score}</strong>
                    </div>
                    <p className="history-title">{attempt.scenarioTitle}</p>
                    <p className="card-note">Dealer: {attempt.dealerName}</p>
                    <p className="history-response">{attempt.response}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function scoreLabel(score) {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Developing";
  return "Needs Work";
}