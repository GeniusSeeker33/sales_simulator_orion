import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const STORAGE_KEY = "sales-simulator-orion-state-v1";

const initialSeedState = {
  currentUser: {
    name: "AE User",
    level: 1,
    title: "Associate AE",
  },

  accounts: [
    {
      id: "acct-001",
      dealerName: "Bluegrass Armory",
      region: "Kentucky",
      segment: "Top 20%",
      owner: "AE User",
      status: "Active",
      opportunityScore: 88,
      monthlyRevenue: 42000,
      goalRevenue: 50000,
      mission: "Increase suppressor bundle adoption",
      plan: {
        focus: "Suppressor bundles + optics add-ons",
        nextAction: "Book owner strategy call",
        blocker: "Low staff product knowledge",
        notes: "Strong hunting season upside if trained on package selling.",
      },
      spotlight: true,
    },
    {
      id: "acct-002",
      dealerName: "Hoosier Tactical Supply",
      region: "Indiana",
      segment: "Growth",
      owner: "AE User",
      status: "Active",
      opportunityScore: 74,
      monthlyRevenue: 26000,
      goalRevenue: 35000,
      mission: "Launch women’s self-defense package",
      plan: {
        focus: "Women’s concealed carry bundle",
        nextAction: "Send floor display recommendations",
        blocker: "Owner wants proof of sell-through",
        notes: "Good market, needs clearer promotional plan.",
      },
      spotlight: false,
    },
    {
      id: "acct-003",
      dealerName: "Volunteer Outdoors",
      region: "Tennessee",
      segment: "Developing",
      owner: "AE User",
      status: "Watch",
      opportunityScore: 61,
      monthlyRevenue: 18000,
      goalRevenue: 30000,
      mission: "Re-engage dormant purchasing pattern",
      plan: {
        focus: "Reactivation + seasonal assortment",
        nextAction: "Review purchase history before outreach",
        blocker: "Limited engagement from manager",
        notes: "Needs a tighter value story and clearer call objective.",
      },
      spotlight: false,
    },
  ],

  trainingResults: [
    // Example structure:
    // {
    //   id: "tr-001",
    //   dealerId: "acct-001",
    //   dealerName: "Bluegrass Armory",
    //   scenarioKey: "growth-mission",
    //   scenarioLabel: "Growth Mission",
    //   score: 86,
    //   maxScore: 100,
    //   completedAt: "2026-04-18T13:00:00.000Z"
    // }
  ],
};

const AppStateContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "UPDATE_ACCOUNT_PLAN": {
      const { accountId, plan } = action.payload;

      return {
        ...state,
        accounts: state.accounts.map((account) =>
          account.id === accountId
            ? {
                ...account,
                plan: {
                  ...account.plan,
                  ...plan,
                },
              }
            : account
        ),
      };
    }

    case "UPDATE_ACCOUNT_FIELDS": {
      const { accountId, updates } = action.payload;

      return {
        ...state,
        accounts: state.accounts.map((account) =>
          account.id === accountId
            ? {
                ...account,
                ...updates,
              }
            : account
        ),
      };
    }

    case "ADD_TRAINING_RESULT": {
      return {
        ...state,
        trainingResults: [action.payload, ...state.trainingResults],
      };
    }

    case "RESET_APP_STATE": {
      return initialSeedState;
    }

    default:
      return state;
  }
}

function loadInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialSeedState;

    const parsed = JSON.parse(saved);

    return {
      ...initialSeedState,
      ...parsed,
      currentUser: {
        ...initialSeedState.currentUser,
        ...(parsed.currentUser || {}),
      },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : initialSeedState.accounts,
      trainingResults: Array.isArray(parsed.trainingResults)
        ? parsed.trainingResults
        : initialSeedState.trainingResults,
    };
  } catch (error) {
    console.error("Failed to load app state from localStorage", error);
    return initialSeedState;
  }
}

function getLevelFromPerformance(trainingResults) {
  const completed = trainingResults.length;
  const avgScore =
    completed === 0
      ? 0
      : Math.round(
          trainingResults.reduce((sum, item) => sum + (item.score || 0), 0) / completed
        );

  if (completed >= 20 && avgScore >= 92) return 5;
  if (completed >= 14 && avgScore >= 88) return 4;
  if (completed >= 9 && avgScore >= 82) return 3;
  if (completed >= 4 && avgScore >= 75) return 2;
  return 1;
}

function getLevelMeta(level) {
  const levels = {
    1: {
      label: "Associate AE",
      checklist: [
        "Complete 4 training missions",
        "Average 75+ training score",
        "Update account plans consistently",
      ],
    },
    2: {
      label: "Account Executive I",
      checklist: [
        "Complete 9 training missions",
        "Average 82+ training score",
        "Show active growth plans across accounts",
      ],
    },
    3: {
      label: "Account Executive II",
      checklist: [
        "Complete 14 training missions",
        "Average 88+ training score",
        "Demonstrate consistent dealer strategy execution",
      ],
    },
    4: {
      label: "Senior AE",
      checklist: [
        "Complete 20 training missions",
        "Average 92+ training score",
        "Lead strategic account growth decisions",
      ],
    },
    5: {
      label: "Strategic Dealer Growth Leader",
      checklist: [
        "Maintain elite performance",
        "Coach best practices",
        "Drive measurable dealer expansion strategy",
      ],
    },
  };

  return levels[level] || levels[1];
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const derived = useMemo(() => {
    const totalAccounts = state.accounts.length;
    const activeAccounts = state.accounts.filter((a) => a.status === "Active").length;
    const spotlightDealer = state.accounts.find((a) => a.spotlight) || state.accounts[0] || null;

    const totalRevenue = state.accounts.reduce(
      (sum, account) => sum + (account.monthlyRevenue || 0),
      0
    );

    const totalGoalRevenue = state.accounts.reduce(
      (sum, account) => sum + (account.goalRevenue || 0),
      0
    );

    const avgOpportunityScore =
      totalAccounts === 0
        ? 0
        : Math.round(
            state.accounts.reduce((sum, account) => sum + (account.opportunityScore || 0), 0) /
              totalAccounts
          );

    const completedTrainings = state.trainingResults.length;

    const avgTrainingScore =
      completedTrainings === 0
        ? 0
        : Math.round(
            state.trainingResults.reduce((sum, item) => sum + (item.score || 0), 0) /
              completedTrainings
          );

    const currentLevel = getLevelFromPerformance(state.trainingResults);
    const levelMeta = getLevelMeta(currentLevel);

    return {
      totalAccounts,
      activeAccounts,
      spotlightDealer,
      totalRevenue,
      totalGoalRevenue,
      revenueGap: totalGoalRevenue - totalRevenue,
      avgOpportunityScore,
      completedTrainings,
      avgTrainingScore,
      currentLevel,
      levelLabel: levelMeta.label,
      levelChecklist: levelMeta.checklist,
      recentTrainingResults: state.trainingResults.slice(0, 5),
    };
  }, [state]);

  const actions = useMemo(
    () => ({
      updateAccountPlan: (accountId, plan) => {
        dispatch({
          type: "UPDATE_ACCOUNT_PLAN",
          payload: { accountId, plan },
        });
      },

      updateAccountFields: (accountId, updates) => {
        dispatch({
          type: "UPDATE_ACCOUNT_FIELDS",
          payload: { accountId, updates },
        });
      },

      addTrainingResult: (result) => {
        dispatch({
          type: "ADD_TRAINING_RESULT",
          payload: {
            id: `tr-${Date.now()}`,
            completedAt: new Date().toISOString(),
            maxScore: 100,
            ...result,
          },
        });
      },

      resetAppState: () => {
        dispatch({ type: "RESET_APP_STATE" });
      },
    }),
    []
  );

  return (
    <AppStateContext.Provider value={{ state, derived, actions }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}