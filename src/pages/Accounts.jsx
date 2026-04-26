import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import {
  loadAccounts,
  saveAccounts,
  resetAccounts,
  normalizeAccount,
} from "../lib/accountStore";

function loadImportedContacts() {
  try {
    return JSON.parse(localStorage.getItem("importedContacts") || "[]");
  } catch {
    return [];
  }
}

export default function Accounts() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedDealerName = location.state?.dealerName;

  const [accounts, setAccounts] = useState(() => loadAccounts());
  const [apiContacts, setApiContacts] = useState(() => loadImportedContacts());
  const [currentRep, setCurrentRep] = useState("ALL");
  const [isEditing, setIsEditing] = useState(false);
  const [draftPlan, setDraftPlan] = useState(null);

  useEffect(() => {
    const localContacts = loadImportedContacts();

    fetch("/api/contacts/list")
      .then((res) => res.json())
      .then((data) => {
        const apiList = Array.isArray(data.contacts) ? data.contacts : [];
        setApiContacts([...localContacts, ...apiList]);
      })
      .catch((err) => {
        console.warn("Contacts API not loaded yet. Using local contacts:", err);
        setApiContacts(localContacts);
      });
  }, []);

  const importedAccounts = useMemo(() => {
    return apiContacts.map((contact, index) =>
      normalizeAccount({
        id: contact.id || `imported-${contact.phone || index}`,
        dealerName: contact.accountName || "Imported Account",
        primaryBuyer: contact.contactName || "Unknown Buyer",
        primaryBuyingCategories: [contact.customerType || "Prospect"],
        lastMonthSales: 0,
        currentMonthTarget: 0,
        growthGap: 0,
        statusLabel: contact.status || "Imported",
        statusTone: "neutral",
        dealerCommitment: contact.priority || "Not set",
        progressPercent: 0,
        categoryToExpand: contact.customerType || "Prospect",
        skuFocus: [],
        plannedOrderFrequency: "",
        barrier: "",
        aeActionRequired: `Assigned Rep: ${contact.assignedRep || "Unassigned"}`,
        howWeGetThere: contact.rulesOfEngagement || contact.notes || "",
        nextFollowUpDate: contact.lastContactDate || "",
        expectedCloseDate: "",
        allocationTrade: "",
        complianceStatus: "Needs review",
        notes: contact.notes || "",
        phone: contact.phone || "",
        email: contact.email || "",
        assignedRep: contact.assignedRep || "",
        territory: contact.territory || "",
        source: contact.source || "Excel Import",
      })
    );
  }, [apiContacts]);

  const repOptions = useMemo(() => {
    const reps = [...importedAccounts, ...accounts]
      .map((account) => account.assignedRep)
      .filter(Boolean);

    return ["ALL", ...Array.from(new Set(reps))];
  }, [accounts, importedAccounts]);

  const displayAccounts = useMemo(() => {
    const existingIds = new Set(accounts.map((account) => account.id));
    const newImports = importedAccounts.filter(
      (account) => !existingIds.has(account.id)
    );

    const combined = [...newImports, ...accounts];

    if (currentRep === "ALL") return combined;

    return combined.filter((account) => account.assignedRep === currentRep);
  }, [accounts, importedAccounts, currentRep]);

  const initialSelectedId = useMemo(() => {
    if (!requestedDealerName) return displayAccounts[0]?.id ?? null;

    const match = displayAccounts.find(
      (account) => account.dealerName === requestedDealerName
    );

    return match?.id ?? displayAccounts[0]?.id ?? null;
  }, [requestedDealerName, displayAccounts]);

  const [selectedId, setSelectedId] = useState(initialSelectedId);

  useEffect(() => {
    setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  const selectedAccount = useMemo(() => {
    return (
      displayAccounts.find((account) => account.id === selectedId) ||
      displayAccounts[0] ||
      null
    );
  }, [displayAccounts, selectedId]);

  function openEditor() {
    if (!selectedAccount) return;

    setDraftPlan({
      categoryToExpand: selectedAccount.categoryToExpand ?? "",
      skuFocus: Array.isArray(selectedAccount.skuFocus)
        ? selectedAccount.skuFocus.join(", ")
        : "",
      plannedOrderFrequency: selectedAccount.plannedOrderFrequency ?? "",
      barrier: selectedAccount.barrier ?? "",
      aeActionRequired: selectedAccount.aeActionRequired ?? "",
      howWeGetThere: selectedAccount.howWeGetThere ?? "",
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
    if (!draftPlan || !selectedAccount) return;

    const updatedAccounts = accounts.map((account) => {
      if (account.id !== selectedAccount.id) return account;

      return normalizeAccount({
        ...account,
        categoryToExpand: draftPlan.categoryToExpand.trim(),
        skuFocus: draftPlan.skuFocus
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        plannedOrderFrequency: draftPlan.plannedOrderFrequency.trim(),
        barrier: draftPlan.barrier.trim(),
        aeActionRequired: draftPlan.aeActionRequired.trim(),
        howWeGetThere: draftPlan.howWeGetThere.trim(),
        updatedAt: new Date().toISOString(),
      });
    });

    setAccounts(updatedAccounts);
    setIsEditing(false);
    setDraftPlan(null);
  }

  function handleResetAccounts() {
    const resetData = resetAccounts();
    setAccounts(resetData);
    setIsEditing(false);
    setDraftPlan(null);
  }

  if (!selectedAccount) {
    return (
      <Layout title="Accounts">
        <section className="accounts-layout">
          <div className="card">
            <h2>No accounts found</h2>
            <p className="section-subtext">
              There are no account records available for this rep filter.
            </p>

            <div className="button-row">
              <button className="btn-secondary" onClick={() => setCurrentRep("ALL")}>
                Show All Reps
              </button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="Accounts">
      <section className="accounts-layout">
        <div className="card">
          <div className="section-header">
            <div>
              <h2>Dealer Overview</h2>
              <p className="section-subtext">
                Imported contacts loaded: {apiContacts.length}
              </p>
              <p className="section-subtext">
                Revenue targets, growth gaps, imported contacts, and next actions by account.
              </p>
            </div>

            <div className="button-row">
              <select
                value={currentRep}
                onChange={(e) => {
                  setCurrentRep(e.target.value);
                  setIsEditing(false);
                  setDraftPlan(null);
                }}
              >
                {repOptions.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep === "ALL" ? "All Reps" : rep}
                  </option>
                ))}
              </select>

              <button className="btn-secondary" onClick={handleResetAccounts}>
                Reset Demo Data
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Dealer</th>
                  <th>Primary Buyer</th>
                  <th>Rep</th>
                  <th>Phone</th>
                  <th>Last Month</th>
                  <th>Target</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {displayAccounts.map((account) => (
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
                    <td>{account.assignedRep || "—"}</td>
                    <td>{account.phone || "—"}</td>
                    <td>{formatCurrency(account.lastMonthSales)}</td>
                    <td>{formatCurrency(account.currentMonthTarget)}</td>
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
            <h2>Contact + Ownership</h2>

            <div className="feedback-row">
              <span>Phone</span>
              <strong>{selectedAccount.phone || "—"}</strong>
            </div>

            <div className="feedback-row">
              <span>Email</span>
              <strong>{selectedAccount.email || "—"}</strong>
            </div>

            <div className="feedback-row">
              <span>Assigned Rep</span>
              <strong>{selectedAccount.assignedRep || "—"}</strong>
            </div>

            <div className="feedback-row">
              <span>Territory</span>
              <strong>{selectedAccount.territory || "—"}</strong>
            </div>

            <div className="feedback-row">
              <span>Source</span>
              <strong>{selectedAccount.source || "Demo Data"}</strong>
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
                  <strong>{selectedAccount.categoryToExpand || "—"}</strong>
                </div>

                <div className="feedback-row">
                  <span>SKU Focus</span>
                  <strong>
                    {selectedAccount.skuFocus?.length
                      ? selectedAccount.skuFocus.join(", ")
                      : "—"}
                  </strong>
                </div>

                <div className="feedback-row">
                  <span>Planned Order Frequency</span>
                  <strong>{selectedAccount.plannedOrderFrequency || "—"}</strong>
                </div>

                <div className="feedback-row">
                  <span>Barrier</span>
                  <strong>{selectedAccount.barrier || "—"}</strong>
                </div>

                <div className="feedback-row">
                  <span>AE Action Required</span>
                  <strong>{selectedAccount.aeActionRequired || "—"}</strong>
                </div>

                <p className="coach-text">
                  How we get there: {selectedAccount.howWeGetThere || "—"}
                </p>

                <div className="button-row">
                  <button
                    className="btn-primary"
                    onClick={() =>
                      navigate("/sales-simulator", {
                        state: {
                          scenarioType: "Growth Mission",
                          dealerName: selectedAccount.dealerName,
                          dealerId: selectedAccount.id,
                          account: selectedAccount,
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
                    onChange={(e) => handleDraftChange("skuFocus", e.target.value)}
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
                    onChange={(e) => handleDraftChange("barrier", e.target.value)}
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
              <strong>{selectedAccount.nextFollowUpDate || "—"}</strong>
            </div>
            <div className="feedback-row">
              <span>Expected Close Date</span>
              <strong>{selectedAccount.expectedCloseDate || "—"}</strong>
            </div>
            <div className="feedback-row">
              <span>Allocation Trade</span>
              <strong>{selectedAccount.allocationTrade || "—"}</strong>
            </div>
            <div className="feedback-row">
              <span>Compliance Status</span>
              <strong>{selectedAccount.complianceStatus || "—"}</strong>
            </div>

            <p className="coach-text">{selectedAccount.notes || "—"}</p>
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
  }).format(Number(value) || 0);
}