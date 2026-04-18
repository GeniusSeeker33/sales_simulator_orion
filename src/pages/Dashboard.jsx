import Layout from "../components/layout/Layout";

const kpis = [
  { label: "Calls Today", value: "72 / 100", note: "+12 vs yesterday" },
  { label: "Revenue Today", value: "$8,450", note: "On pace" },
  { label: "Avg Order Size", value: "$312", note: "+8%" },
  { label: "Rank", value: "#6 / 35", note: "Climbing" },
];

export default function Dashboard() {
  return (
    <Layout title="Dashboard">
      <section className="kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card">
            <div className="card-label">{kpi.label}</div>
            <div className="card-value">{kpi.value}</div>
            <div className="card-note">{kpi.note}</div>
          </div>
        ))}
      </section>

      <section className="two-column">
        <div className="card">
          <h2>Today's Missions</h2>
          <ul className="mission-list">
            <li>
              <span>Run 3 simulations</span>
              <strong>0 / 3</strong>
            </li>
            <li>
              <span>Close 2 dealer growth gaps</span>
              <strong>0 / 2</strong>
            </li>
            <li>
              <span>Hit 100 outbound dials</span>
              <strong>72 / 100</strong>
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>Level Progress</h2>
          <div className="progress-meta">
            <span>Level 2 → 3</span>
            <span>72%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: "72%" }} />
          </div>

          <div className="stacked-stats">
            <div className="mini-stat">
              <span>Commission Boost</span>
              <strong>+0.01%</strong>
            </div>
            <div className="mini-stat">
              <span>Weekly Bonus</span>
              <strong>$85</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="two-column">
        <div className="card">
          <h2>AI Coach</h2>
          <p className="coach-text">
            You are losing control after price objections. Run two objection
            drills before the next outbound block and push for commitment after
            your reframe.
          </p>
        </div>

        <div className="card">
          <h2>Dealer Mission Spotlight</h2>
          <div className="dealer-row">
            <span>Smith Tactical</span>
            <strong>$5,700 gap</strong>
          </div>
          <div className="dealer-row">
            <span>Category</span>
            <strong>Optics</strong>
          </div>
          <div className="dealer-row">
            <span>Barrier</span>
            <strong>Confidence</strong>
          </div>
        </div>
      </section>
    </Layout>
  );
}