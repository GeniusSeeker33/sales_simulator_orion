import Layout from "../components/layout/Layout";

export default function Accounts() {
  return (
    <Layout title="Accounts">
      <div className="card">
        <h2>Dealer Overview</h2>
        <div className="dealer-row">
          <span>Dealer</span>
          <strong>Smith Tactical</strong>
        </div>
        <div className="dealer-row">
          <span>Last Month Sales</span>
          <strong>$38,000</strong>
        </div>
        <div className="dealer-row">
          <span>Current Target</span>
          <strong>$43,700</strong>
        </div>
        <div className="dealer-row">
          <span>Growth Gap</span>
          <strong>$5,700</strong>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "87%" }} />
        </div>
      </div>
    </Layout>
  );
}