export const PRIZES_STORAGE_KEY = "sales-simulator-orion-prizes-v1";

export const PRIZE_TIERS = [
  { rank: 1, cashPrize: 10, geniusDollars: 100, label: "1st Place" },
  { rank: 2, cashPrize: 6, geniusDollars: 65, label: "2nd Place" },
  { rank: 3, cashPrize: 3, geniusDollars: 30, label: "3rd Place" },
];

export const NEW_HIRE_MAX_MONTHS = 6;

const DEMO_HISTORY = [
  {
    date: "2026-04-26",
    winners: [
      { rank: 1, repCode: "CWK", repName: "Charlie Kronauer", cashPrize: 10, geniusDollars: 100, score: 94 },
      { rank: 2, repCode: "JMF", repName: "James Ferguson", cashPrize: 6, geniusDollars: 65, score: 88 },
      { rank: 3, repCode: "TAH", repName: "Tim Hardin", cashPrize: 3, geniusDollars: 30, score: 83 },
    ],
  },
  {
    date: "2026-04-25",
    winners: [
      { rank: 1, repCode: "NKD", repName: "Neil Dickinson", cashPrize: 10, geniusDollars: 100, score: 91 },
      { rank: 2, repCode: "JMF", repName: "James Ferguson", cashPrize: 6, geniusDollars: 65, score: 88 },
      { rank: 3, repCode: "TAH", repName: "Tim Hardin", cashPrize: 3, geniusDollars: 30, score: 83 },
    ],
  },
  {
    date: "2026-04-24",
    winners: [
      { rank: 1, repCode: "JMF", repName: "James Ferguson", cashPrize: 10, geniusDollars: 100, score: 90 },
      { rank: 2, repCode: "ACH", repName: "Alanna Holland", cashPrize: 6, geniusDollars: 65, score: 87 },
      { rank: 3, repCode: "CWK", repName: "Charlie Kronauer", cashPrize: 3, geniusDollars: 30, score: 82 },
    ],
  },
  {
    date: "2026-04-23",
    winners: [
      { rank: 1, repCode: "TAH", repName: "Tim Hardin", cashPrize: 10, geniusDollars: 100, score: 93 },
      { rank: 2, repCode: "NKD", repName: "Neil Dickinson", cashPrize: 6, geniusDollars: 65, score: 89 },
      { rank: 3, repCode: "ACH", repName: "Alanna Holland", cashPrize: 3, geniusDollars: 30, score: 84 },
    ],
  },
  {
    date: "2026-04-22",
    winners: [
      { rank: 1, repCode: "NKD", repName: "Neil Dickinson", cashPrize: 10, geniusDollars: 100, score: 88 },
      { rank: 2, repCode: "ADA", repName: "Ahmad Abri", cashPrize: 6, geniusDollars: 65, score: 85 },
      { rank: 3, repCode: "JMF", repName: "James Ferguson", cashPrize: 3, geniusDollars: 30, score: 81 },
    ],
  },
  {
    date: "2026-04-21",
    winners: [
      { rank: 1, repCode: "ACH", repName: "Alanna Holland", cashPrize: 10, geniusDollars: 100, score: 89 },
      { rank: 2, repCode: "CWK", repName: "Charlie Kronauer", cashPrize: 6, geniusDollars: 65, score: 86 },
      { rank: 3, repCode: "TNH", repName: "Tanner Hammond", cashPrize: 3, geniusDollars: 30, score: 79 },
    ],
  },
  {
    date: "2026-04-19",
    winners: [
      { rank: 1, repCode: "JMF", repName: "James Ferguson", cashPrize: 10, geniusDollars: 100, score: 92 },
      { rank: 2, repCode: "TAH", repName: "Tim Hardin", cashPrize: 6, geniusDollars: 65, score: 87 },
      { rank: 3, repCode: "SLB", repName: "Stacy Bentley", cashPrize: 3, geniusDollars: 30, score: 78 },
    ],
  },
];

function buildDefaultRepEarnings() {
  const earnings = {};
  DEMO_HISTORY.forEach((day) => {
    day.winners.forEach((w) => {
      if (!earnings[w.repCode]) {
        earnings[w.repCode] = { repName: w.repName, totalCash: 0, totalGeniusDollars: 0, wins: 0, podiums: 0 };
      }
      earnings[w.repCode].totalCash += w.cashPrize;
      earnings[w.repCode].totalGeniusDollars += w.geniusDollars;
      earnings[w.repCode].podiums += 1;
      if (w.rank === 1) earnings[w.repCode].wins += 1;
    });
  });
  return earnings;
}

function getDefaultPrizes() {
  return { dailyWinners: [...DEMO_HISTORY], repEarnings: buildDefaultRepEarnings() };
}

export function loadPrizes() {
  try {
    const raw = localStorage.getItem(PRIZES_STORAGE_KEY);
    if (!raw) return getDefaultPrizes();
    return JSON.parse(raw);
  } catch {
    return getDefaultPrizes();
  }
}

export function savePrizes(prizes) {
  try {
    localStorage.setItem(PRIZES_STORAGE_KEY, JSON.stringify(prizes));
  } catch (err) {
    console.error("Failed to save prizes:", err);
  }
}

export function recordDailyWinners(date, winners) {
  const prizes = loadPrizes();
  const existingIdx = prizes.dailyWinners.findIndex((d) => d.date === date);
  const entry = { date, winners, recordedAt: new Date().toISOString() };

  if (existingIdx >= 0) {
    const oldWinners = prizes.dailyWinners[existingIdx].winners;
    oldWinners.forEach((w) => {
      const rep = prizes.repEarnings[w.repCode];
      if (rep) {
        rep.totalCash = Math.max(0, rep.totalCash - w.cashPrize);
        rep.totalGeniusDollars = Math.max(0, rep.totalGeniusDollars - w.geniusDollars);
        rep.podiums = Math.max(0, rep.podiums - 1);
        if (w.rank === 1) rep.wins = Math.max(0, rep.wins - 1);
      }
    });
    prizes.dailyWinners[existingIdx] = entry;
  } else {
    prizes.dailyWinners.unshift(entry);
  }

  winners.forEach((winner) => {
    if (!prizes.repEarnings[winner.repCode]) {
      prizes.repEarnings[winner.repCode] = { repName: winner.repName, totalCash: 0, totalGeniusDollars: 0, wins: 0, podiums: 0 };
    }
    const rep = prizes.repEarnings[winner.repCode];
    rep.totalCash += winner.cashPrize;
    rep.totalGeniusDollars += winner.geniusDollars;
    rep.podiums += 1;
    if (winner.rank === 1) rep.wins += 1;
    rep.repName = winner.repName;
  });

  savePrizes(prizes);
  return prizes;
}

export function getTodayWinners(prizes) {
  const today = new Date().toISOString().slice(0, 10);
  return prizes.dailyWinners.find((d) => d.date === today)?.winners ?? [];
}

export function getRepEarnings(prizes, repCode) {
  return prizes.repEarnings[repCode] ?? { totalCash: 0, totalGeniusDollars: 0, wins: 0, podiums: 0 };
}

export function isNewHireEligible(hireDate) {
  if (!hireDate) return false;
  const hired = new Date(hireDate);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - NEW_HIRE_MAX_MONTHS);
  return hired >= cutoff;
}

export function generateDailyScore(repCode) {
  const today = new Date().toISOString().slice(0, 10);
  const hash = repCode.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 1);
  const dayNum = parseInt(today.replace(/-/g, ""), 10) % 1000;
  return 62 + (Math.abs(hash * 7 + dayNum * 3) % 32);
}

export function calcTenureMonths(hireDate) {
  if (!hireDate) return 0;
  const hired = new Date(hireDate);
  const now = new Date();
  return (now.getFullYear() - hired.getFullYear()) * 12 + (now.getMonth() - hired.getMonth());
}
