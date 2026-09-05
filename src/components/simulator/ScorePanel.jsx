export default function ScorePanel({ score, glcdEarned }) {
  return (
    <section className="simulator-panel simulator-score-panel">
      <h2>AI Practice Feedback (unreviewed)</h2>

      {glcdEarned != null && (
        <div className="glcd-earned-banner">
          <span className="glcd-coin">⬡</span>
          <strong>+{glcdEarned} GeniusDollars earned</strong>
          <span className="glcd-sub">Added to your balance — redeem on your dashboard</span>
        </div>
      )}

      <div className="simulator-score-grid">
        <div className="simulator-score-card">
          <span>Overall</span>
          <strong>{score.overall ?? "Unscored"}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Discovery</span>
          <strong>{score.discovery ?? "Unscored"}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Order Build</span>
          <strong>{score.orderBuilding ?? "Unscored"}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Objections</span>
          <strong>{score.objectionHandling ?? "Unscored"}</strong>
        </div>

        <div className="simulator-score-card">
          <span>Closing</span>
          <strong>{score.closing ?? "Unscored"}</strong>
        </div>
      </div>

      <p>{score.coachingNote}</p>
    </section>
  );
}