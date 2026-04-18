import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { accounts as seedAccounts } from "../data/accounts";

const ACCOUNTS_STORAGE_KEY = "sales-simulator-orion-accounts-v1";
const TRAINING_STORAGE_KEY = "sales-simulator-orion-training-results-v1";

const scenarioMap = {
  "Growth Mission": {
    title: "Growth Mission",
    objective:
      "Expand the account by identifying the next best category, overcoming the dealer’s hesitation, and earning commitment to a clear next step.",
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

export default function Training() {
  const location = useLocation();
  const navigate = useNavigate();

  const scenarioType = location.state?.scenarioType ?? "Growth Mission";
  const dealerIdFromRoute = location.state?.dealerId ?? null;
  const dealerNameFromRoute = location.state?.dealerName ?? null;

  const accounts = useMemo(() => loadAccounts(), []);
  const trainingHistory = useMemo(() => loadTrainingResults(), []);

  const dealer = useMemo(() => {
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
  }, [accounts, dealerIdFromRoute, dealerNameFromRoute]);

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

  const dealerHistory = useMemo(() => {
    if (!dealer) return [];
    return trainingHistory.filter((entry) => entry.dealerId === dealer.id);
  }, [trainingHistory, dealer]);

  const latestScore = dealerHistory[0]?.totalScore ?? null;

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleCompleteTraining() {
    if (!dealer) return;

    const scoring = scoreTraining(form);

    const result = {
      id: createId("training"),
      completedAt: new Date().toISOString(),
      scenarioType: scenario.title,
      dealerId: dealer.id,
      dealerName: dealer.dealerName,
      primaryBuyer: dealer.primaryBuyer,
      scoreBreakdown: scoring.breakdown,
      totalScore: scoring.totalScore,
      maxScore: 100,
      repSummary: {
        openingApproach: form.openingApproach.trim(),
        discoveryQuestion: form.discoveryQuestion.trim(),
        valueStory: form.valueStory.trim(),
        closeAttempt: form.closeAttempt.trim(),
        coachNotes: form.coachNotes.trim(),
      },
      accountSnapshot: {
        categoryToExpand: dealer.categoryToExpand,
        skuFocus: dealer.skuFocus,
        plannedOrderFrequency: dealer.plannedOrderFrequency,
        barrier: dealer.barrier,
        aeActionRequired: dealer.aeActionRequired,
        howWeGetThere: dealer.howWeGetThere,
        lastMonthSales: dealer.lastMonthSales,
        currentMonthTarget: dealer.currentMonthTarget,
        growthGap: dealer.growthGap,
        progressPercent: dealer.progressPercent,
      },
    };

    saveTrainingResult(result);
    setSavedResult(result);
    setSubmitted(true);
  }

  function handlePracticeAnother() {
    setForm({
      openingApproach: "",
      discoveryQuestion: "",
      valueStory: "",
      closeAttempt: "",
      coachNotes: "",
    });
    setSubmitted(false);
    setSavedResult(null);
  }

  if (!dealer) {
    return (
      <Layout title="Training">
        <section className="dashboard-grid">
          <div className="card">
            <h2>No dealer context found</h2>
            <p className="section-subtext">
              Launch Training from the Accounts page so the simulator can load the
              correct dealer context.
            </p>

            <div className="button-row">
              <button
                className="btn-primary"
                onClick={() => navigate("/accounts")}
              >
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
                Use the live account strategy to guide your call.
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
            <span>Category to Expand</span>
            <strong>{dealer.categoryToExpand}</strong>
          </div>
          <div className="feedback-row">
            <span>SKU Focus</span>
            <strong>{dealer.skuFocus.join(", ")}</strong>
          </div>
          <div className="feedback-row">
            <span>Barrier</span>
            <strong>{dealer.barrier}</strong>
          </div>
          <div className="feedback-row">
            <span>AE Action Required</span>
            <strong>{dealer.aeActionRequired}</strong>
          </div>

          <p className="coach-text">How we get there: {dealer.howWeGetThere}</p>
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
                  placeholder="How would you open the conversation and frame the opportunity?"
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
                  placeholder="How would you connect the product recommendation to their business?"
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
                  placeholder="Optional: capture what you were trying to accomplish in the scenario."
                />
              </label>

              <div className="button-row">
                <button className="btn-primary" onClick={handleCompleteTraining}>
                  Complete Training
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => navigate("/accounts", {
                    state: { dealerName: dealer.dealerName },
                  })}
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
                <h2>Performance Saved</h2>
                <p className="section-subtext">
                  This result is now stored and ready for dashboard and level progression.
                </p>
              </div>
              <span className="status-pill status-positive">
                Score {savedResult.totalScore}/100
              </span>
            </div>

            <div className="detail-grid">
              <div className="mini-stat">
                <span>Opening</span>
                <strong>{savedResult.scoreBreakdown.opening}</strong>
              </div>
              <div className="mini-stat">
                <span>Discovery</span>
                <strong>{savedResult.scoreBreakdown.discovery}</strong>
              </div>
              <div className="mini-stat">
                <span>Value Story</span>
                <strong>{savedResult.scoreBreakdown.valueStory}</strong>
              </div>
              <div className="mini-stat">
                <span>Close</span>
                <strong>{savedResult.scoreBreakdown.close}</strong>
              </div>
            </div>

            <p className="coach-text">
              Result saved for {savedResult.dealerName} under {savedResult.scenarioType}.
            </p>

            <div className="button-row">
              <button className="btn-primary" onClick={handlePracticeAnother}>
                Practice Again
              </button>

              <button
                className="btn-secondary"
                onClick={() => navigate("/accounts", {
                  state: { dealerName: dealer.dealerName },
                })}
              >
                Back to Account
              </button>

              <button
                className="btn-secondary"
                onClick={() => navigate("/")}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-header">
            <div>
              <h2>Dealer Training History</h2>
              <p className="section-subtext">
                Recent saved results for this dealer.
              </p>
            </div>
          </div>

          <div className="feedback-row">
            <span>Total Sessions</span>
            <strong>{dealerHistory.length}</strong>
          </div>

          <div className="feedback-row">
            <span>Latest Score</span>
            <strong>{latestScore ?? "—"}</strong>
          </div>

          {dealerHistory.length > 0 ? (
            <div className="history-list">
              {dealerHistory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="feedback-row">
                  <span>
                    {entry.scenarioType} • {formatDate(entry.completedAt)}
                  </span>
                  <strong>{entry.totalScore}/100</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="coach-text">
              No training history saved for this dealer yet.
            </p>
          )}
        </div>
      </section>
    </Layout>
  );
}

function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);

    if (!raw) {
      return seedAccounts.map((account) => normalizeAccount(account));
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return seedAccounts.map((account) => normalizeAccount(account));
    }

    return parsed.map((account) => normalizeAccount(account));
  } catch (error) {
    console.error("Failed to load accounts for training:", error);
    return seedAccounts.map((account) => normalizeAccount(account));
  }
}

function loadTrainingResults() {
  try {
    const raw = localStorage.getItem(TRAINING_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load training results:", error);
    return [];
  }
}

function saveTrainingResult(result) {
  try {
    const existing = loadTrainingResults();
    const updated = [result, ...existing];
    localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save training result:", error);
  }
}

function normalizeAccount(account) {
  const lastMonthSales = Number(account.lastMonthSales ?? 0);
  const currentMonthTarget = Number(account.currentMonthTarget ?? 0);
  const growthGap = Math.max(currentMonthTarget - lastMonthSales, 0);

  const progressPercent =
    currentMonthTarget > 0
      ? Math.min(Math.round((lastMonthSales / currentMonthTarget) * 100), 100)
      : 0;

  return {
    ...account,
    growthGap,
    progressPercent,
    skuFocus: Array.isArray(account.skuFocus) ? account.skuFocus : [],
    primaryBuyingCategories: Array.isArray(account.primaryBuyingCategories)
      ? account.primaryBuyingCategories
      : [],
  };
}

function scoreTraining(form) {
  const opening = scoreResponse(form.openingApproach, 25);
  const discovery = scoreResponse(form.discoveryQuestion, 25);
  const valueStory = scoreResponse(form.valueStory, 25);
  const close = scoreResponse(form.closeAttempt, 25);

  return {
    breakdown: {
      opening,
      discovery,
      valueStory,
      close,
    },
    totalScore: opening + discovery + valueStory + close,
  };
}

function scoreResponse(text, maxPoints) {
  const clean = text.trim();

  if (!clean) return 0;
  if (clean.length < 40) return Math.round(maxPoints * 0.35);
  if (clean.length < 90) return Math.round(maxPoints * 0.6);
  if (clean.length < 180) return Math.round(maxPoints * 0.8);
  return maxPoints;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}