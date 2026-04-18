import Layout from "../components/layout/Layout";

export default function Activity() {
  return (
    <Layout title="Activity">
      <section className="kpi-grid">
        <div className="card">
          <div className="card-label">Dials</div>
          <div className="card-value">108</div>
        </div>
        <div className="card">
          <div className="card-label">Talk Time</div>
          <div className="card-value">2.8 hrs</div>
        </div>
        <div className="card">
          <div className="card-label">Commitments</div>
          <div className="card-value">7</div>
        </div>
        <div className="card">
          <div className="card-label">Revenue</div>
          <div className="card-value">$11,200</div>
        </div>
      </section>

      <div className="card">
        <h2>AI Insight</h2>
        <p className="coach-text">
          Strong call volume. Commitment rate is lagging. Focus on asking for the
          order directly after inventory urgency.
        </p>
      </div>
    </Layout>
  );
}