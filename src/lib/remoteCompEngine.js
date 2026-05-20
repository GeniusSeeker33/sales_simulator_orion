/**
 * Remote Sales Associate (RSA) compensation helpers.
 *
 * Mirrors the shape of compEngine.js so the dashboard can swap
 * between traditional AE and remote-rep views with minimal churn.
 */

import {
  REMOTE_COMP_PLAN,
  REMOTE_MISSION_TARGETS,
  REMOTE_SCORE_MULTIPLIERS,
  calculateRemoteMonthlyCompensation,
  calculateRemoteScoreUpside,
  getRemoteScoreTier,
} from "../data/compPlan_remote";
import { formatCurrency } from "./compEngine";

export { REMOTE_COMP_PLAN, REMOTE_SCORE_MULTIPLIERS, REMOTE_MISSION_TARGETS };

/**
 * Deterministic demo metrics for a remote rep so the dashboard
 * shows a realistic, populated picture in pitch demos.
 */
export function simulateRemoteRepMetrics({ repCode = "", startDate } = {}) {
  const hash = String(repCode)
    .split("")
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 17) || 17;

  const tenureMonths = monthsSince(startDate);
  const isRamp = tenureMonths < 1;

  const skillFactor = Math.min(1, Math.max(0.45, tenureMonths / 9));
  const baseScore = isRamp
    ? 58 + (hash % 8)
    : Math.min(98, 65 + Math.round(skillFactor * 30) + (hash % 6) - 3);

  const callsCompleted = isRamp
    ? 600 + (hash % 400)
    : 1500 + (hash % 800);
  const dealerEngagements = isRamp
    ? 20 + (hash % 25)
    : 60 + (hash % 120);
  const captures = isRamp ? 2 + (hash % 4) : 6 + (hash % 22);
  const revenueGenerated = isRamp
    ? 30000 + (hash % 40000)
    : 250000 + (hash % 1500000);

  return {
    callsCompleted,
    averageCallScore: baseScore,
    dealerEngagements,
    captures,
    revenueGenerated,
  };
}

export function buildRemoteRepCompSummary(inputs) {
  const comp = calculateRemoteMonthlyCompensation(inputs);
  const upside = calculateRemoteScoreUpside({ ...inputs, scoreBoost: 10 });

  return {
    ...inputs,
    ...comp,
    upside,
    employmentMonth: comp.employment.employmentMonth,
    isInRampBuffer: comp.employment.isInRampBuffer,
    daysEmployed: comp.employment.daysEmployed,
  };
}

export function buildRemoteCompKpiCards(summary) {
  const { tier, effectivePerCallRate, totalEstimatedCompensation, upside } =
    summary;

  return [
    {
      id: "remote-kpi-total",
      label: "Estimated Total Comp",
      value: formatCurrency(totalEstimatedCompensation),
      note: `${tier.label} tier — ${tier.multiplier.toFixed(1)}x multiplier`,
    },
    {
      id: "remote-kpi-rate",
      label: "Effective Per-Call Rate",
      value: `$${effectivePerCallRate.toFixed(2)}`,
      note: `Base $${REMOTE_COMP_PLAN.basePayPerCall.toFixed(2)} × ${tier.multiplier.toFixed(1)}x score multiplier`,
    },
    {
      id: "remote-kpi-score",
      label: "AI Call Score",
      value: `${Math.round(summary.averageCallScore)}/100`,
      note: tier.label,
    },
    {
      id: "remote-kpi-upside",
      label: "+10 Score Upside",
      value: formatCurrency(upside.extraMonthlyPay),
      note: `Earn this much more by lifting score to ${upside.boostedScore}`,
    },
  ];
}

export function buildRemoteMissions(summary) {
  const t = REMOTE_MISSION_TARGETS;

  const missions = [
    {
      id: "remote-mission-calls",
      label: `Complete ${t.monthlyCalls.toLocaleString()} calls this month`,
      value: `${summary.callsCompleted.toLocaleString()} / ${t.monthlyCalls.toLocaleString()}`,
      complete: summary.callsCompleted >= t.monthlyCalls,
    },
    {
      id: "remote-mission-score",
      label: `Maintain average AI score of ${t.averageScore}+`,
      value: `${Math.round(summary.averageCallScore)}/100`,
      complete: summary.averageCallScore >= t.averageScore,
    },
    {
      id: "remote-mission-engagements",
      label: `Land ${t.engagements} qualified dealer conversations`,
      value: `${summary.dealerEngagements} / ${t.engagements}`,
      complete: summary.dealerEngagements >= t.engagements,
    },
    {
      id: "remote-mission-captures",
      label: `Capture ${t.captures} new dealer accounts`,
      value: `${summary.captures} / ${t.captures}`,
      complete: summary.captures >= t.captures,
    },
  ];

  return missions;
}

export function buildRemoteCompBreakdown(summary) {
  return [
    { label: "Calls Completed", value: summary.callsCompleted.toLocaleString() },
    { label: "Average AI Score", value: `${Math.round(summary.averageCallScore)}/100` },
    { label: "Score Tier", value: `${summary.tier.label} (${summary.tier.multiplier.toFixed(1)}x)` },
    { label: "Base Per-Call Rate", value: `$${summary.basePerCallRate.toFixed(2)}` },
    { label: "Effective Per-Call Rate", value: `$${summary.effectivePerCallRate.toFixed(2)}` },
    { label: "Call Compensation", value: formatCurrency(summary.callCompensation) },
    { label: "Qualified Engagements", value: summary.dealerEngagements },
    { label: "Engagement Bonus", value: formatCurrency(summary.engagementBonus) },
    { label: "New Dealer Captures", value: summary.captures },
    { label: "Capture Bonus", value: formatCurrency(summary.captureBonus) },
    { label: "Revenue Generated", value: formatCurrency(summary.revenueGenerated) },
    { label: "Revenue Participation", value: formatCurrency(summary.revenueParticipation) },
    { label: "Total Estimated Comp", value: formatCurrency(summary.totalEstimatedCompensation) },
  ];
}

export function buildRemoteStatusMessage(summary) {
  const { tier, isInRampBuffer, upside } = summary;

  if (isInRampBuffer) {
    return `This rep is still inside the first 4 weeks. Activity and AI call scoring are tracking but ramp comp guardrails are active.`;
  }

  if (tier.multiplier >= 2) {
    return `Elite performance. ${Math.round(summary.averageCallScore)}/100 average score earns the 2.0x multiplier on every completed call. This is exactly the profile to highlight to leadership and use for recruiting.`;
  }

  if (tier.multiplier >= 1.5) {
    return `Strong performance — earning ${tier.multiplier.toFixed(1)}x on every completed call. A ${upside.boostedScore}-point average would unlock another ${formatCurrency(upside.extraMonthlyPay)} this month.`;
  }

  if (tier.multiplier >= 1.0) {
    return `Developing. Holding ${Math.round(summary.averageCallScore)}/100 keeps the rep at ${tier.multiplier.toFixed(1)}x. Pushing average score to ${upside.boostedScore} unlocks ${formatCurrency(upside.extraMonthlyPay)}/mo of additional pay.`;
  }

  return `Skill development is the clearest lever. Coaching the rep to a 70+ average score is the single biggest comp accelerator available right now.`;
}

export function buildRemoteCoachMessage(summary) {
  const { tier, callsCompleted, dealerEngagements, captures, upside } = summary;
  const t = REMOTE_MISSION_TARGETS;

  if (callsCompleted < t.monthlyCalls * 0.6) {
    return `Activity is the blocker right now — ${callsCompleted.toLocaleString()} calls vs. a ${t.monthlyCalls.toLocaleString()} target. Get back on a 90-dial cadence to unlock the rest of the comp model.`;
  }

  if (tier.multiplier < 1.2) {
    return `Call quality is the next unlock. A 10-point lift in average AI score is worth ${formatCurrency(upside.extraMonthlyPay)} this month. Spend time on the simulator before live dials.`;
  }

  if (dealerEngagements < t.engagements) {
    return `Volume and skill are strong. Convert more of those connects into qualified conversations — pricing asks, follow-ups, inventory needs — to unlock engagement bonuses.`;
  }

  if (captures < t.captures) {
    return `Activity, quality, and engagements are healthy. Next push: new dealer captures — each one is worth $${REMOTE_COMP_PLAN.captureBonusPerCapture} plus long-tail revenue participation.`;
  }

  return `All four pillars firing. This is the rep profile to feature on the leaderboard, in recruiting collateral, and in the elite-tier promotion track.`;
}

function monthsSince(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 30));
}
