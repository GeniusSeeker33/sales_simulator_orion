import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { accounts as initialAccounts } from "../data/accounts";

export default function Accounts() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedDealerName = location.state?.dealerName;

  const [accounts, setAccounts] = useState(initialAccounts);

  const initialSelectedId = useMemo(() => {
    if (!requestedDealerName) return initialAccounts[0]?.id ?? null;

    const match = initialAccounts.find(
      (account) => account.dealerName === requestedDealerName
    );

    return match?.id ?? initialAccounts[0]?.id ?? null;
  }, [requestedDealerName]);

  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [isEditing, setIsEditing] = useState(false);
  const [draftPlan, setDraftPlan] = useState(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? accounts[0],
    [accounts, selectedId]
  );

  function openEditor() {
    setDraftPlan({
      categoryToExpand: selectedAccount.categoryToExpand,
      skuFocus: selectedAccount.skuFocus.join(", "),
      plannedOrderFrequency: selectedAccount.plannedOrderFrequency,
      barrier: selectedAccount.barrier,
      aeActionRequired: selectedAccount.aeActionRequired,
      howWeGetThere: selectedAccount.howWeGetThere,
    });
    setIsEditing(true);
  }

  function closeEditor() {
    setIsEditing(false);
    setDraftPlan(null);
  }

  function handleDraftChange(field, value) {
    setDraftPlan((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function savePlan() {
    if (!draftPlan) return;

    const updatedAccounts = accounts.map((account) => {
      if (account.id !== selectedId) return account;

      return {
        ...account,
        categoryToExpand: draftPlan.categoryToExpand,
        skuFocus: draftPlan.skuFocus
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        plannedOrderFrequency: draftPlan.plannedOrderFrequency,
        barrier: draftPlan.barrier,
        aeActionRequired: draftPlan.aeActionRequired,
        howWeGetThere: draftPlan.howWeGetThere,
      };
    });

    setAccounts(updatedAccounts);
    setIsEditing(false);
    setDraftPlan(null);
  }

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
                    onClick={() => {
                      setSelectedId(account.id);
                      setIsEditing(false);
                      setDraftPlan(null);
                    }}
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
                  {selectedAccount.primaryBuyer} •{" "}
                  {selectedAccount.primaryBuyingCategories.join(", ")}
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
            <div className="section-header">
              <div>
                <h2>Growth Plan</h2>
                <p className="section-subtext">
                  Strategy, expansion, and execution plan for this account.
                </p>
              </div>
            </div>

            {!isEditing ? (
              <>
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
                  <button
                    className="btn-primary"
                    onClick={() =>
                      navigate("/training", {
                        state: {
                          scenarioType: "Growth Mission",
                          dealerName: selectedAccount.dealerName,
                        },
                      })
                    }
                  >
                    Practice Call
                  </button>

                  <button className="btn-secondary" onClick={openEditor}>
                    Update Plan
                  </button>
                </div>
              </>
            ) : (
              <div className="plan-editor">
                <label className="form-field">
                  <span>Category to Expand</span>
                  <input
                    type="text"
                    value={draftPlan.categoryToExpand}
                    onChange={(e) =>
                      handleDraftChange("categoryToExpand", e.target.value)
                    }
                  />
                </label>

                <label className="form-field">
                  <span>SKU Focus (comma separated)</span>
                  <input
                    type="text"
                    value={draftPlan.skuFocus}
                    onChange={(e) =>
                      handleDraftChange("skuFocus", e.target.value)
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Planned Order Frequency</span>
                  <input
                    type="text"
                    value={draftPlan.plannedOrderFrequency}
                    onChange={(e) =>
                      handleDraftChange("plannedOrderFrequency", e.target.value)
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Barrier</span>
                  <input
                    type="text"
                    value={draftPlan.barrier}
                    onChange={(e) =>
                      handleDraftChange("barrier", e.target.value)
                    }
                  />
                </label>

                <label className="form-field">
                  <span>AE Action Required</span>
                  <input
                    type="text"
                    value={draftPlan.aeActionRequired}
                    onChange={(e) =>
                      handleDraftChange("aeActionRequired", e.target.value)
                    }
                  />
                </label>

                <label className="form-field">
                  <span>How We Get There</span>
                  <textarea
                    className="response-box compact-textarea"
                    value={draftPlan.howWeGetThere}
                    onChange={(e) =>
                      handleDraftChange("howWeGetThere", e.target.value)
                    }
                  />
                </label>

                <div className="button-row">
                  <button className="btn-primary" onClick={savePlan}>
                    Save Plan
                  </button>
                  <button className="btn-secondary" onClick={closeEditor}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
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