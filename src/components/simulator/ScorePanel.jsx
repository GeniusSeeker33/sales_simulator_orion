export default function ScorePanel({ score }) {
  return (
    <section className="simulator-panel simulator-score-panel">
      <h2>Coaching Report</h2>

      <div className="simulator-score-grid">
        <div className="simulator-score-card">
          <span>Overall</span>
          <strong>{score.overall}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Discovery</span>
          <strong>{score.discovery}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Order Build</span>
          <strong>{score.orderBuilding}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Objections</span>
          <strong>{score.objectionHandling}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Closing</span>
          <strong>{score.closing}</strong>
        </div>
      </div>

      <p>{score.coachingNote}</p>
    </section>
  );
}