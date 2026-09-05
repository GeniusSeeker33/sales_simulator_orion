import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { loadAccounts, normalizeAccount } from "../lib/accountStore";
import { beginAttempt, finishAttempt } from "../lib/learnerRecords";
import LearnerHistory from "../components/LearnerHistory";

const scenarioMap = {
  "Growth Mission": {
    title: "Growth Mission",
    objective:
      "Expand the account by identifying the next best category, overcoming hesitation, and earning commitment to a clear next step.",
    opener:
      "You are speaking with the dealer’s primary buyer. Your goal is to guide the conversation toward growth without sounding transactional.",
  },
  "Objection Handling": {
    title: "Objection Handling",
    objective:
      "Handle pricing, inventory, and sell-through concerns while maintaining trust and momentum.",
    opener:
      "The buyer is hesitant and wants a reason to believe your recommendation will move at retail.",
  },
  "New Product Launch": {
    title: "New Product Launch",
    objective:
      "Position a new item or program in a way that matches the dealer’s business model and customer base.",
    opener:
      "The dealer is interested, but only if the recommendation feels grounded in their specific store reality.",
  },
};

function loadImportedContacts() {
  try {
    return JSON.parse(localStorage.getItem("importedContacts") || "[]");
  } catch {
    return [];
  }
}

function mapContactToAccount(contact, index) {
  return normalizeAccount({
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
  });
}

export default function Training() {
  const location = useLocation();
  const navigate = useNavigate();

  const scenarioType = location.state?.scenarioType ?? "Growth Mission";
  const dealerIdFromRoute = location.state?.dealerId ?? null;
  const dealerNameFromRoute = location.state?.dealerName ?? null;
  const accountFromRoute = location.state?.account ?? null;

  const accounts = useMemo(() => {
    const demoAccounts = loadAccounts();
    const importedAccounts = loadImportedContacts().map(mapContactToAccount);
    return [...importedAccounts, ...demoAccounts];
  }, []);



  const dealer = useMemo(() => {
    if (accountFromRoute) return normalizeAccount(accountFromRoute);

    if (dealerIdFromRoute) {
      const byId = accounts.find((account) => account.id === dealerIdFromRoute);
      if (byId) return byId;
    }

    if (dealerNameFromRoute) {
      const byName = accounts.find(
        (account) => account.dealerName === dealerNameFromRoute
      );
      if (byName) return byName;
    }

    return accounts[0] ?? null;
  }, [accounts, dealerIdFromRoute, dealerNameFromRoute, accountFromRoute]);

  const scenario = scenarioMap[scenarioType] ?? scenarioMap["Growth Mission"];

  const [form, setForm] = useState({
    openingApproach: "",
    discoveryQuestion: "",
    valueStory: "",
    closeAttempt: "",
    coachNotes: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [savedResult, setSavedResult] = useState(null);

  const attemptId = useRef(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleCompleteTraining() {
    if (!dealer || savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setSaveError("");
    attemptId.current ||= crypto.randomUUID();
    try {
      await beginAttempt(attemptId.current, "written", scenario.title);
      await finishAttempt(attemptId.current, "completed");
      setSavedResult({ id: attemptId.current, scenarioType: scenario.title });
      setSubmitted(true);
    } catch (error) { setSaveError(error.message); }
    finally { savingRef.current = false; setSaving(false); }
  }

  function handlePracticeAnother() {
    setForm({
      openingApproach: "",
      discoveryQuestion: "",
      valueStory: "",
      closeAttempt: "",
      coachNotes: "",
    });
    attemptId.current = null;
    setSubmitted(false);
    setSavedResult(null);
  }

  if (!dealer) {
    return (
      <Layout title="Training Simulator">
        <section className="dashboard-grid">
          <div className="card">
            <h2>No dealer context found</h2>
            <p className="section-subtext">
              Launch Training from the Accounts page so the simulator can load the
              correct dealer context.
            </p>

            <div className="button-row">
              <button className="btn-primary" onClick={() => navigate("/accounts")}>
                Go to Accounts
              </button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="Training Simulator">
      {saveError && <p role="alert">{saveError}</p>}
      <section className="dashboard-grid">
        <div className="card">
          <div className="section-header">
            <div>
              <h2>{scenario.title}</h2>
              <p className="section-subtext">{scenario.objective}</p>
            </div>
            <span className="status-pill status-positive">Live Scenario</span>
          </div>

          <p className="coach-text">{scenario.opener}</p>
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Dealer Context</h2>
              <p className="section-subtext">
                Use this live account strategy to guide your call.
              </p>
            </div>
          </div>

          <div className="feedback-row">
            <span>Dealer</span>
            <strong>{dealer.dealerName}</strong>
          </div>

          <div className="feedback-row">
            <span>Primary Buyer</span>
            <strong>{dealer.primaryBuyer}</strong>
          </div>

          <div className="feedback-row">
            <span>Assigned Rep</span>
            <strong>{dealer.assignedRep || "—"}</strong>
          </div>

          <div className="feedback-row">
            <span>Phone</span>
            <strong>{dealer.phone || "—"}</strong>
          </div>

          <div className="feedback-row">
            <span>Email</span>
            <strong>{dealer.email || "—"}</strong>
          </div>

          <div className="feedback-row">
            <span>Category to Expand</span>
            <strong>{dealer.categoryToExpand || "—"}</strong>
          </div>

          <div className="feedback-row">
            <span>SKU Focus</span>
            <strong>{dealer.skuFocus?.length ? dealer.skuFocus.join(", ") : "—"}</strong>
          </div>

          <div className="feedback-row">
            <span>Barrier</span>
            <strong>{dealer.barrier || "—"}</strong>
          </div>

          <div className="feedback-row">
            <span>AE Action Required</span>
            <strong>{dealer.aeActionRequired || "—"}</strong>
          </div>

          <p className="coach-text">How we get there: {dealer.howWeGetThere || "—"}</p>
        </div>

        {!submitted ? (
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Simulation Response</h2>
                <p className="section-subtext">
                  Complete the exercise to generate a saved performance result.
                </p>
              </div>
            </div>

            <div className="plan-editor">
              <label className="form-field">
                <span>Opening Approach</span>
                <textarea
                  className="response-box"
                  value={form.openingApproach}
                  onChange={(e) => updateField("openingApproach", e.target.value)}
                  placeholder={`How would you open the conversation with ${dealer.primaryBuyer}?`}
                />
              </label>

              <label className="form-field">
                <span>Discovery Question</span>
                <textarea
                  className="response-box"
                  value={form.discoveryQuestion}
                  onChange={(e) => updateField("discoveryQuestion", e.target.value)}
                  placeholder="What question would you ask to learn what the dealer truly needs?"
                />
              </label>

              <label className="form-field">
                <span>Value Story</span>
                <textarea
                  className="response-box"
                  value={form.valueStory}
                  onChange={(e) => updateField("valueStory", e.target.value)}
                  placeholder="How would you connect the recommendation to their business?"
                />
              </label>

              <label className="form-field">
                <span>Close Attempt / Next Step</span>
                <textarea
                  className="response-box"
                  value={form.closeAttempt}
                  onChange={(e) => updateField("closeAttempt", e.target.value)}
                  placeholder="How would you earn a concrete next step or commitment?"
                />
              </label>

              <label className="form-field">
                <span>Coach Notes</span>
                <textarea
                  className="response-box compact-textarea"
                  value={form.coachNotes}
                  onChange={(e) => updateField("coachNotes", e.target.value)}
                  placeholder="Optional: capture what you were trying to accomplish."
                />
              </label>

              <div className="button-row">
                <button className="btn-primary" disabled={saving} onClick={handleCompleteTraining}>
                  Complete Training
                </button>

                <button
                  className="btn-secondary"
                  onClick={() =>
                    navigate("/accounts", {
                      state: { dealerName: dealer.dealerName },
                    })
                  }
                >
                  Back to Accounts
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="section-header">
              <div>
                <h2>Practice saved</h2>
                <p className="section-subtext">Your completion record is saved durably. This written exercise is unscored. Responses and personal notes stay on this page and are not retained.</p>
              </div>
            </div>
            <p>Record {savedResult.id} · {savedResult.scenarioType}</p>
            <div className="button-row">
              <button className="btn-primary" onClick={handlePracticeAnother}>
                Practice Again
              </button>

              <button
                className="btn-secondary"
                onClick={() =>
                  navigate("/accounts", {
                    state: { dealerName: dealer.dealerName },
                  })
                }
              >
                Back to Account
              </button>

              <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        <LearnerHistory revision={savedResult?.id} />
      </section>
    </Layout>
  );
}
