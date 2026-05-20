import { accounts as seedAccounts } from "../data/accounts";
import { accountsLive } from "../data/accountsLive";

// Bumped from v1 to v2 when the real Orion dealer book was imported (5,240 accounts).
export const ACCOUNTS_STORAGE_KEY = "sales-simulator-orion-accounts-v2";

function baseAccounts() {
  return [...seedAccounts, ...accountsLive];
}

export function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);

    if (!raw) {
      return baseAccounts().map((account) => normalizeAccount(account));
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return baseAccounts().map((account) => normalizeAccount(account));
    }

    return parsed.map((account) => normalizeAccount(account));
  } catch (error) {
    console.error("Failed to load accounts:", error);
    return baseAccounts().map((account) => normalizeAccount(account));
  }
}

export function saveAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    // Quota errors are expected if the user has lots of local data — silently fall back
    // so the page still renders. The next load will hydrate from the bundled seed/live data.
    console.error("Failed to save accounts:", error);
  }
}

export function resetAccounts() {
  const resetData = baseAccounts().map((account) => normalizeAccount(account));
  saveAccounts(resetData);
  return resetData;
}

export function normalizeAccount(account) {
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