import Layout from "../components/layout/Layout";
import { useMemo, useState } from "react";

export default function Training() {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedback = useMemo(() => {
    if (!submitted) return null;

    const lower = response.toLowerCase();
    return {
      agreement:
        lower.includes("fair") || lower.includes("understand") || lower.includes("totally")
          ? "Strong"
          : "Missing",
      control:
        lower.includes("?") ? "Good" : "Needs stronger question",
      close:
        lower.includes("commit") || lower.includes("truck") || lower.includes("order")
          ? "Present"
          : "Missing",
    };
  }, [response, submitted]);

  return (
    <Layout title="Training">
      <section className="training-layout">
        <div className="card">
          <div className="scenario-tag">Scenario: Price Objection</div>
          <h2>Dealer says:</h2>
          <p className="dealer-quote">“Your prices are too high.”</p>

          <textarea
            className="response-box"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Type your response here..."
          />

          <div className="button-row">
            <button className="btn-primary" onClick={() => setSubmitted(true)}>
              Submit Response
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setResponse("");
                setSubmitted(false);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Live Feedback</h2>
          {!submitted ? (
            <p className="muted">Submit your response to score the drill.</p>
          ) : (
            <div className="feedback-list">
              <div className="feedback-row">
                <span>Agreement</span>
                <strong>{feedback.agreement}</strong>
              </div>
              <div className="feedback-row">
                <span>Control</span>
                <strong>{feedback.control}</strong>
              </div>
              <div className="feedback-row">
                <span>Close Attempt</span>
                <strong>{feedback.close}</strong>
              </div>
              <p className="coach-text">
                Coaching tip: agree first, reframe around profit or availability,
                then ask a direct question to regain control.
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}