import { accounts as seedAccounts } from "../data/accounts";

export const ACCOUNTS_STORAGE_KEY = "sales-simulator-orion-accounts-v1";

export function loadAccounts() {
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
    console.error("Failed to load accounts:", error);
    return seedAccounts.map((account) => normalizeAccount(account));
  }
}

export function saveAccounts(accounts) {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("Failed to save accounts:", error);
  }
}

export function resetAccounts() {
  const resetData = seedAccounts.map((account) => normalizeAccount(account));
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