import Layout from "../components/layout/Layout";

export default function Levels() {
  return (
    <Layout title="Level Progress">
      <div className="card">
        <h2>Current Level: Account-Aware AE</h2>

        <div className="feedback-row">
          <span>Simulation Score</span>
          <strong>82% / 80% required</strong>
        </div>
        <div className="feedback-row">
          <span>CRM Compliance</span>
          <strong>95% / 95% required</strong>
        </div>
        <div className="feedback-row">
          <span>Growth Actions</span>
          <strong>Pending</strong>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "72%" }} />
        </div>

        <p className="coach-text">
          One more completed growth mission unlocks Level 3 and the next
          commission boost.
        </p>
      </div>
    </Layout>
  );
}