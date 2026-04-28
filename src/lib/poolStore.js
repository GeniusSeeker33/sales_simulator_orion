const POOL_STORAGE_KEY = "sales-simulator-orion-pools-v1";

function genId() {
  return "pool-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

const DEMO_POOLS = [
  {
    id: "pool-demo-1",
    rewardLabel: "Team Pizza Party",
    rewardCost: 2500,
    createdBy: "JamesF@Orionwholesaleonline.com",
    createdByName: "James Ferguson",
    createdAt: "2026-04-26T09:00:00Z",
    status: "open",
    notes: "Let's celebrate hitting Q2 quota!",
    pledges: [
      { email: "JamesF@Orionwholesaleonline.com", name: "James Ferguson", amount: 700 },
      { email: "TimH@orionwholesaleonline.com", name: "Tim Hardin", amount: 600 },
      { email: "CharlieK@Orionwholesaleonine.com", name: "Charlie Kronauer", amount: 500 },
    ],
  },
  {
    id: "pool-demo-2",
    rewardLabel: "Studio Session — 2 Hours",
    rewardCost: 5000,
    createdBy: "NeilD@Oronwholesaleonline.com",
    createdByName: "Neil Dickinson",
    createdAt: "2026-04-27T14:00:00Z",
    status: "open",
    notes: "End of month at Earthtone — who's in?",
    pledges: [
      { email: "NeilD@Oronwholesaleonline.com", name: "Neil Dickinson", amount: 800 },
      { email: "AlannaH@orionwholesaleonline.com", name: "Alanna Holland", amount: 500 },
    ],
  },
];

function getDefaultPools() {
  return { pools: [...DEMO_POOLS] };
}

export function loadPools() {
  try {
    const raw = localStorage.getItem(POOL_STORAGE_KEY);
    if (!raw) return getDefaultPools();
    return JSON.parse(raw);
  } catch {
    return getDefaultPools();
  }
}

export function savePools(data) {
  try {
    localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save pools:", err);
  }
}

export function getPoolTotal(pool) {
  return pool.pledges.reduce((sum, p) => sum + p.amount, 0);
}

export function createPool({ rewardLabel, rewardCost, createdBy, createdByName, pledge, notes }) {
  const data = loadPools();
  const pool = {
    id: genId(),
    rewardLabel,
    rewardCost,
    createdBy,
    createdByName,
    createdAt: new Date().toISOString(),
    status: "open",
    notes: notes || "",
    pledges: pledge > 0 ? [{ email: createdBy, name: createdByName, amount: pledge }] : [],
  };
  data.pools.unshift(pool);
  savePools(data);
  return pool;
}

export function addOrUpdatePledge(poolId, { email, name, amount }) {
  const data = loadPools();
  const pool = data.pools.find((p) => p.id === poolId);
  if (!pool || pool.status !== "open") return null;
  const existing = pool.pledges.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.amount = amount;
    existing.name = name;
  } else {
    pool.pledges.push({ email, name, amount });
  }
  savePools(data);
  return pool;
}

export function removePledge(poolId, email) {
  const data = loadPools();
  const pool = data.pools.find((p) => p.id === poolId);
  if (!pool) return null;
  pool.pledges = pool.pledges.filter((p) => p.email.toLowerCase() !== email.toLowerCase());
  savePools(data);
  return pool;
}

export function markPoolRedeemed(poolId) {
  const data = loadPools();
  const pool = data.pools.find((p) => p.id === poolId);
  if (pool) {
    pool.status = "redeemed";
    pool.redeemedAt = new Date().toISOString();
  }
  savePools(data);
  return pool;
}

export function deletePool(poolId, requesterEmail) {
  const data = loadPools();
  const pool = data.pools.find((p) => p.id === poolId);
  if (!pool || pool.createdBy.toLowerCase() !== requesterEmail.toLowerCase()) return false;
  data.pools = data.pools.filter((p) => p.id !== poolId);
  savePools(data);
  return true;
}
