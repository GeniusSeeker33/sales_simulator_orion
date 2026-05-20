/**
 * Orion Remote Sales Associate (RSA) Compensation Plan
 * ----------------------------------------------------
 * Gamified, performance-driven comp model for remote
 * outbound reps. Built for nationwide scalability.
 *
 * Core principle:
 *   "Every call has value. Great calls have greater value.
 *    Elite performance compounds."
 *
 * Five pillars:
 *   1. Pay per completed call         (base activity pay)
 *   2. AI-scored call quality         (multiplier on call pay)
 *   3. Dealer engagement bonus        (qualified conversations)
 *   4. Capture bonus                  (new dealer accounts)
 *   5. Revenue participation          (ownership mentality)
 */

import { getEmploymentMetrics } from "./compPlan";

/**
 * Headline economic levers
 */
export const REMOTE_COMP_PLAN = {
  basePayPerCall: 0.75,
  engagementBonusPerQualifiedConversation: 6,
  captureBonusPerCapture: 30,
  revenueParticipationRate: 0.0015,
  workingDaysPerMonth: 22,
  targetDailyCalls: 90,
};

/**
 * AI call-score multipliers
 *
 * Score tiers reward skill development directly. A rep earning
 * an Elite score doubles their effective call rate.
 */
export const REMOTE_SCORE_MULTIPLIERS = [
  { minScore: 0,  maxScore: 49,  multiplier: 0.0, label: "Disqualified", tone: "status-risk" },
  { minScore: 50, maxScore: 59,  multiplier: 0.8, label: "Weak",         tone: "status-risk" },
  { minScore: 60, maxScore: 69,  multiplier: 1.0, label: "Developing",   tone: "status-neutral" },
  { minScore: 70, maxScore: 79,  multiplier: 1.2, label: "Good",         tone: "status-neutral" },
  { minScore: 80, maxScore: 89,  multiplier: 1.5, label: "Strong",       tone: "status-positive" },
  { minScore: 90, maxScore: 100, multiplier: 2.0, label: "Elite",        tone: "status-positive" },
];

/**
 * Daily / monthly activity expectations used to drive
 * gamified missions and leaderboards.
 */
export const REMOTE_MISSION_TARGETS = {
  monthlyCalls: 1980,
  dailyCalls: 90,
  averageScore: 80,
  engagements: 75,
  captures: 12,
};

/**
 * Representative monthly compensation examples drawn
 * directly from the Remote Sales Performance Model.
 */
export const REMOTE_COMP_EXAMPLES = [
  {
    id: "remote-entry",
    label: "Entry-Level Rep",
    callsCompleted: 1800,
    averageCallScore: 72,
    dealerEngagements: 42,
    captures: 7,
    revenueGenerated: 120000,
    expectedTotal: 2250,
  },
  {
    id: "remote-strong",
    label: "Strong Rep",
    callsCompleted: 2100,
    averageCallScore: 88,
    dealerEngagements: 108,
    captures: 17,
    revenueGenerated: 565000,
    expectedTotal: 4362,
  },
  {
    id: "remote-elite",
    label: "Elite National Rep",
    callsCompleted: 2200,
    averageCallScore: 95,
    dealerEngagements: 200,
    captures: 34,
    revenueGenerated: 1670000,
    expectedTotal: 8000,
  },
];

/**
 * Look up the score multiplier tier for a given AI call score.
 */
export function getRemoteScoreTier(score = 0) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    REMOTE_SCORE_MULTIPLIERS.find(
      (tier) => clamped >= tier.minScore && clamped <= tier.maxScore
    ) || REMOTE_SCORE_MULTIPLIERS[0]
  );
}

/**
 * Full monthly compensation estimate for a remote rep.
 *
 * Inputs:
 *   - callsCompleted:       completed connected calls this month
 *   - averageCallScore:     AI-graded average (0-100)
 *   - dealerEngagements:    qualified conversations (pricing, follow-up, etc.)
 *   - captures:             new dealer accounts won
 *   - revenueGenerated:     paid invoiced dollars attributed to the rep
 */
export function calculateRemoteMonthlyCompensation({
  startDate,
  callsCompleted = 0,
  averageCallScore = 0,
  dealerEngagements = 0,
  captures = 0,
  revenueGenerated = 0,
}) {
  const employment = getEmploymentMetrics(startDate);
  const tier = getRemoteScoreTier(averageCallScore);

  const effectivePerCallRate = REMOTE_COMP_PLAN.basePayPerCall * tier.multiplier;
  const callCompensation = callsCompleted * effectivePerCallRate;
  const engagementBonus =
    dealerEngagements * REMOTE_COMP_PLAN.engagementBonusPerQualifiedConversation;
  const captureBonus = captures * REMOTE_COMP_PLAN.captureBonusPerCapture;
  const revenueParticipation =
    revenueGenerated * REMOTE_COMP_PLAN.revenueParticipationRate;

  const totalEstimatedCompensation =
    callCompensation + engagementBonus + captureBonus + revenueParticipation;

  return {
    employment,
    tier,
    callsCompleted,
    averageCallScore,
    dealerEngagements,
    captures,
    revenueGenerated,
    basePerCallRate: REMOTE_COMP_PLAN.basePayPerCall,
    effectivePerCallRate,
    callCompensation,
    engagementBonus,
    captureBonus,
    revenueParticipation,
    totalEstimatedCompensation,
  };
}

/**
 * What would the rep earn if they pushed their average score
 * up by `scoreBoost` points? Used for upside coaching.
 */
export function calculateRemoteScoreUpside({
  startDate,
  callsCompleted = 0,
  averageCallScore = 0,
  dealerEngagements = 0,
  captures = 0,
  revenueGenerated = 0,
  scoreBoost = 10,
}) {
  const current = calculateRemoteMonthlyCompensation({
    startDate,
    callsCompleted,
    averageCallScore,
    dealerEngagements,
    captures,
    revenueGenerated,
  });

  const boostedScore = Math.min(100, averageCallScore + scoreBoost);
  const boosted = calculateRemoteMonthlyCompensation({
    startDate,
    callsCompleted,
    averageCallScore: boostedScore,
    dealerEngagements,
    captures,
    revenueGenerated,
  });

  return {
    current,
    boosted,
    boostedScore,
    extraMonthlyPay:
      boosted.totalEstimatedCompensation - current.totalEstimatedCompensation,
  };
}
