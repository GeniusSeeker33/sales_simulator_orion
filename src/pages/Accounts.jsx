import { useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import { accounts } from "../data/accounts";

export default function Accounts() {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? accounts[0],
    [selectedId]
  );

  return (
    <Layout title="Accounts">
      <section className="accounts-layout">
        <div className="card">
          <div className="section-header">
            <div>
              <h2>Dealer Overview</h2>
              <p className="section-subtext">
                Revenue targets, growth gaps, and next actions by account.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Dealer</th>
                  <th>Primary Buyer</th>
                  <th>Last Month</th>
                  <th>Target</th>
                  <th>Growth Gap</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    className={selectedId === account.id ? "row-active" : ""}
                    onClick={() => setSelectedId(account.id)}
                  >
                    <td>{account.dealerName}</td>
                    <td>{account.primaryBuyer}</td>
                    <td>{formatCurrency(account.lastMonthSales)}</td>
                    <td>{formatCurrency(account.currentMonthTarget)}</td>
                    <td>{formatCurrency(account.growthGap)}</td>
                    <td>
                      <span className={`status-pill status-${account.statusTone}`}>
                        {account.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="account-detail-stack">
          <div className="card">
            <div className="section-header">
              <div>
                <h2>{selectedAccount.dealerName}</h2>
                <p className="section-subtext">
                  {selectedAccount.primaryBuyer} • {selectedAccount.primaryBuyingCategories.join(", ")}
                </p>
              </div>
              <span className={`status-pill status-${selectedAccount.statusTone}`}>
                {selectedAccount.statusLabel}
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Last Month Sales</span>
                <strong>{formatCurrency(selectedAccount.lastMonthSales)}</strong>
              </div>
              <div className="mini-stat">
                <span>Current Target</span>
                <strong>{formatCurrency(selectedAccount.currentMonthTarget)}</strong>
              </div>
              <div className="mini-stat">
                <span>Growth Gap</span>
                <strong>{formatCurrency(selectedAccount.growthGap)}</strong>
              </div>
              <div className="mini-stat">
                <span>Commitment</span>
                <strong>{selectedAccount.dealerCommitment}</strong>
              </div>
            </div>

            <div className="progress-meta">
              <span>Progress to Target</span>
              <span>{selectedAccount.progressPercent}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${selectedAccount.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="card">
            <h2>Growth Plan</h2>

            <div className="feedback-row">
              <span>Category to Expand</span>
              <strong>{selectedAccount.categoryToExpand}</strong>
            </div>
            <div className="feedback-row">
              <span>SKU Focus</span>
              <strong>{selectedAccount.skuFocus.join(", ")}</strong>
            </div>
            <div className="feedback-row">
              <span>Planned Order Frequency</span>
              <strong>{selectedAccount.plannedOrderFrequency}</strong>
            </div>
            <div className="feedback-row">
              <span>Barrier</span>
              <strong>{selectedAccount.barrier}</strong>
            </div>
            <div className="feedback-row">
              <span>AE Action Required</span>
              <strong>{selectedAccount.aeActionRequired}</strong>
            </div>

            <p className="coach-text">
              How we get there: {selectedAccount.howWeGetThere}
            </p>

            <div className="button-row">
              <button className="btn-primary">Practice Call</button>
              <button className="btn-secondary">Update Plan</button>
            </div>
          </div>

          <div className="card">
            <h2>Next Steps</h2>

            <div className="feedback-row">
              <span>Next Follow-Up Date</span>
              <strong>{selectedAccount.nextFollowUpDate}</strong>
            </div>
            <div className="feedback-row">
              <span>Expected Close Date</span>
              <strong>{selectedAccount.expectedCloseDate}</strong>
            </div>
            <div className="feedback-row">
              <span>Allocation Trade</span>
              <strong>{selectedAccount.allocationTrade}</strong>
            </div>
            <div className="feedback-row">
              <span>Compliance Status</span>
              <strong>{selectedAccount.complianceStatus}</strong>
            </div>

            <p className="coach-text">{selectedAccount.notes}</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}