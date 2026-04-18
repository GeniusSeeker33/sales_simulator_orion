/**
 * Orion Sales Compensation Plan
 * --------------------------------
 * Source of truth for:
 * - base pay by employment tenure
 * - KPI definitions
 * - KPI measurement timing
 * - measured-month KPI roadmap
 * - commission tiers
 * - capture bonus
 * - customer sold bonus
 *
 * IMPORTANT:
 * KPI roadmap below is based on MEASURED MONTH, not raw employment month.
 * KPI measurement starts only after the first 4 weeks of employment.
 */

export const HOURS_PER_MONTH = 160;
export const KPI_MEASUREMENT_DELAY_DAYS = 28;

/**
 * Base pay by employment month
 */
export const BASE_PAY_RULES = [
  {
    startMonth: 1,
    endMonth: 12,
    annualBaseSalary: 31200,
    monthlyBaseSalary: 2600,
    hourlyRate: 15.0,
    label: "Year 1",
  },
  {
    startMonth: 13,
    endMonth: 999,
    annualBaseSalary: 25000,
    monthlyBaseSalary: 2083.33,
    hourlyRate: 12.02,
    label: "Year 2+",
  },
];

/**
 * KPI definitions
 */
export const KPI_DEFINITIONS = {
  revenue: {
    key: "revenue",
    label: "Net Invoiced Dollars",
    description:
      "Eligible inventory dollars only. Shipping, adult signature, and other non-inventory items are excluded. Revenue must be shipped, invoiced, and paid in full.",
    paidRequired: true,
  },

  captures: {
    key: "captures",
    label: "Captured New Customers",
    description:
      "A capture is a new account that has never done business with Orion, or has not done business with Orion in at least the last 12 months.",
    paidRequired: false,
  },

  customersSold: {
    key: "customersSold",
    label: "Sold-To Customers",
    description:
      "Eligible customer must have at least $1,000 invoiced during the current month to qualify. Paid or unpaid can count. Prepay invoices do not count until released and shipped.",
    paidRequired: false,
  },
};

/**
 * KPI roadmap by measured month
 * Month 1 here means the first KPI-measured month AFTER the 4-week delay.
 */
export const KPI_MINIMUM_ROADMAP = [
  { month: 1, minimumRevenue: 20000, minimumCaptures: 15, minimumCustomersSold: 15, source: "confirmed-chart" },
  { month: 2, minimumRevenue: 30000, minimumCaptures: 15, minimumCustomersSold: 20, source: "confirmed-chart" },
  { month: 3, minimumRevenue: 40000, minimumCaptures: 15, minimumCustomersSold: 25, source: "confirmed-chart" },
  { month: 4, minimumRevenue: 50000, minimumCaptures: 15, minimumCustomersSold: 30, source: "confirmed-chart" },
  { month: 5, minimumRevenue: 65000, minimumCaptures: 15, minimumCustomersSold: 35, source: "confirmed-chart" },
  { month: 6, minimumRevenue: 80000, minimumCaptures: 15, minimumCustomersSold: 40, source: "confirmed-chart" },

  { month: 7, minimumRevenue: 100000, minimumCaptures: 12, minimumCustomersSold: 45, source: "confirmed-chart" },
  { month: 8, minimumRevenue: 125000, minimumCaptures: 12, minimumCustomersSold: 50, source: "confirmed-chart" },
  { month: 9, minimumRevenue: 150000, minimumCaptures: 12, minimumCustomersSold: 55, source: "confirmed-chart" },
  { month: 10, minimumRevenue: 175000, minimumCaptures: 12, minimumCustomersSold: 60, source: "confirmed-chart" },
  { month: 11, minimumRevenue: 200000, minimumCaptures: 12, minimumCustomersSold: 65, source: "confirmed-chart" },
  { month: 12, minimumRevenue: 250000, minimumCaptures: 12, minimumCustomersSold: 70, source: "confirmed-chart" },

  { month: 13, minimumRevenue: 300000, minimumCaptures: 10, minimumCustomersSold: 75, source: "confirmed-chart" },
  { month: 14, minimumRevenue: 300000, minimumCaptures: 10, minimumCustomersSold: 80, source: "confirmed-chart" },
  { month: 15, minimumRevenue: 350000, minimumCaptures: 10, minimumCustomersSold: 85, source: "confirmed-chart" },
  { month: 16, minimumRevenue: 350000, minimumCaptures: 10, minimumCustomersSold: 90, source: "confirmed-chart" },
  { month: 17, minimumRevenue: 400000, minimumCaptures: 10, minimumCustomersSold: 95, source: "confirmed-chart" },
  { month: 18, minimumRevenue: 400000, minimumCaptures: 10, minimumCustomersSold: 100, source: "confirmed-chart" },

  { month: 19, minimumRevenue: 450000, minimumCaptures: 8, minimumCustomersSold: 105, source: "confirmed-chart" },
  { month: 20, minimumRevenue: 450000, minimumCaptures: 8, minimumCustomersSold: 110, source: "confirmed-chart" },
  { month: 21, minimumRevenue: 450000, minimumCaptures: 8, minimumCustomersSold: 115, source: "confirmed-chart" },
  { month: 22, minimumRevenue: 500000, minimumCaptures: 8, minimumCustomersSold: 120, source: "confirmed-chart" },
  { month: 23, minimumRevenue: 500000, minimumCaptures: 6, minimumCustomersSold: 125, source: "confirmed-chart" },
  { month: 24, minimumRevenue: 500000, minimumCaptures: 6, minimumCustomersSold: 125, source: "confirmed-chart" },
];

/**
 * Revenue commission tiers
 *
 * Rule:
 * - Hit ALL 3 KPI minimums => qualified tier
 * - Miss ANY 1 KPI minimum => base tier
 *
 * Rates stored as decimals:
 * 0.0075 = 0.75%
 * 0.0060 = 0.60%
 */
export const COMMISSION_RATE_PLAN = {
  qualified: [
    {
      minRevenue: 0,
      maxRevenue: 999999.99,
      rate: 0.0075,
      label: "Qualified Tier A",
      displayRate: "0.75%",
    },
    {
      minRevenue: 1000000,
      maxRevenue: 1499999.99,
      rate: 0.008,
      label: "Qualified Tier B",
      displayRate: "0.80%",
    },
    {
      minRevenue: 1500000,
      maxRevenue: Infinity,
      rate: 0.009,
      label: "Qualified Tier C",
      displayRate: "0.90%",
    },
  ],

  base: [
    {
      minRevenue: 0,
      maxRevenue: Infinity,
      rate: 0.006,
      label: "Base Tier",
      displayRate: "0.60%",
    },
  ],
};

/**
 * Capture bonus
 */
export const CAPTURE_BONUS_PLAN = [
  {
    startMonth: 1,
    endMonth: 999,
    amountPerCapture: 20,
    displayAmount: "$20",
  },
];

/**
 * Customer sold bonus by employment month
 *
 * This follows the example structure previously established.
 * Adjust here later if Orion confirms a different official payout table.
 */
export const CUSTOMER_SOLD_BONUS_PLAN = [
  {
    startMonth: 1,
    endMonth: 12,
    qualifiedAmount: 3,
    baseAmount: 3,
    label: "Year 1",
  },
  {
    startMonth: 13,
    endMonth: 24,
    qualifiedAmount: 10,
    baseAmount: 7,
    label: "Year 2",
  },
  {
    startMonth: 25,
    endMonth: 999,
    qualifiedAmount: 10,
    baseAmount: 10,
    label: "Year 3+",
  },
];

/**
 * Example scenarios from the plan
 */
export const COMP_PLAN_EXAMPLES = [
  {
    id: "month-5-hit-all",
    measuredMonth: 5,
    revenue: 97844,
    captures: 17,
    customersSold: 41,
    hitAllKpis: true,
    expectedRevenueRate: 0.0075,
  },
  {
    id: "month-5-miss-one",
    measuredMonth: 5,
    revenue: 97844,
    captures: 17,
    customersSold: 30,
    hitAllKpis: false,
    expectedRevenueRate: 0.006,
  },
  {
    id: "month-18-hit-all",
    measuredMonth: 18,
    revenue: 785114,
    captures: 12,
    customersSold: 119,
    hitAllKpis: true,
    expectedRevenueRate: 0.0075,
  },
  {
    id: "month-18-miss-one",
    measuredMonth: 18,
    revenue: 785114,
    captures: 12,
    customersSold: 88,
    hitAllKpis: false,
    expectedRevenueRate: 0.006,
  },
];

/**
 * Base pay by employment month
 */
export function getBasePayForMonth(employmentMonth) {
  return (
    BASE_PAY_RULES.find(
      (rule) =>
        employmentMonth >= rule.startMonth && employmentMonth <= rule.endMonth
    ) || BASE_PAY_RULES[BASE_PAY_RULES.length - 1]
  );
}

/**
 * Employment timing derived from start date
 */
export function getEmploymentMetrics(startDate) {
  const now = new Date();
  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    return {
      isValidStartDate: false,
      startDate: null,
      daysEmployed: 0,
      employmentMonth: 1,
      isInRampBuffer: true,
      measuredMonth: 0,
      kpiMeasurementActive: false,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysEmployed = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / msPerDay)
  );

  const employmentMonth = Math.max(1, Math.floor(daysEmployed / 30) + 1);

  const isInRampBuffer = daysEmployed < KPI_MEASUREMENT_DELAY_DAYS;
  const measuredMonth = isInRampBuffer
    ? 0
    : Math.floor((daysEmployed - KPI_MEASUREMENT_DELAY_DAYS) / 30) + 1;

  return {
    isValidStartDate: true,
    startDate,
    daysEmployed,
    employmentMonth,
    isInRampBuffer,
    measuredMonth,
    kpiMeasurementActive: measuredMonth >= 1,
  };
}

/**
 * KPI targets by measured month
 * For month 24+, keep using month 24 values.
 */
export function getKpiTargetsForMeasuredMonth(measuredMonth) {
  if (!measuredMonth || measuredMonth < 1) {
    return {
      month: 0,
      minimumRevenue: null,
      minimumCaptures: null,
      minimumCustomersSold: null,
      source: "not-yet-measured",
    };
  }

  const cappedMonth = Math.min(measuredMonth, 24);

  const exact = KPI_MINIMUM_ROADMAP.find((row) => row.month === cappedMonth);
  if (exact) return exact;

  return KPI_MINIMUM_ROADMAP[KPI_MINIMUM_ROADMAP.length - 1];
}

/**
 * KPI attainment using start date + current month metrics
 */
export function evaluateKpiAttainment({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const employment = getEmploymentMetrics(startDate);

  if (!employment.kpiMeasurementActive) {
    return {
      employment,
      targets: getKpiTargetsForMeasuredMonth(0),
      hitRevenue: false,
      hitCaptures: false,
      hitCustomersSold: false,
      hitAllKpis: false,
      isPreMeasurement: true,
    };
  }

  const targets = getKpiTargetsForMeasuredMonth(employment.measuredMonth);

  const hitRevenue = revenue >= (targets.minimumRevenue ?? Infinity);
  const hitCaptures = captures >= (targets.minimumCaptures ?? Infinity);
  const hitCustomersSold =
    customersSold >= (targets.minimumCustomersSold ?? Infinity);

  return {
    employment,
    targets,
    hitRevenue,
    hitCaptures,
    hitCustomersSold,
    hitAllKpis: hitRevenue && hitCaptures && hitCustomersSold,
    isPreMeasurement: false,
  };
}

/**
 * Revenue commission tier lookup
 */
export function getRevenueCommissionRate({ revenue = 0, hitAllKpis = false }) {
  const plan = hitAllKpis
    ? COMMISSION_RATE_PLAN.qualified
    : COMMISSION_RATE_PLAN.base;

  return (
    plan.find(
      (tier) => revenue >= tier.minRevenue && revenue <= tier.maxRevenue
    ) || plan[plan.length - 1]
  );
}

/**
 * Capture bonus lookup by employment month
 */
export function getCaptureBonusRule(employmentMonth) {
  return (
    CAPTURE_BONUS_PLAN.find(
      (rule) =>
        employmentMonth >= rule.startMonth && employmentMonth <= rule.endMonth
    ) || CAPTURE_BONUS_PLAN[CAPTURE_BONUS_PLAN.length - 1]
  );
}

/**
 * Customer sold bonus lookup by employment month
 */
export function getCustomerSoldBonusRule({
  employmentMonth,
  hitAllKpis = false,
}) {
  const rule =
    CUSTOMER_SOLD_BONUS_PLAN.find(
      (item) =>
        employmentMonth >= item.startMonth && employmentMonth <= item.endMonth
    ) || CUSTOMER_SOLD_BONUS_PLAN[CUSTOMER_SOLD_BONUS_PLAN.length - 1];

  return {
    ...rule,
    amountPerCustomer: hitAllKpis ? rule.qualifiedAmount : rule.baseAmount,
  };
}

/**
 * Full monthly compensation estimate
 */
export function calculateMonthlyCompensation({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const attainment = evaluateKpiAttainment({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  const employmentMonth = attainment.employment.employmentMonth;
  const basePay = getBasePayForMonth(employmentMonth);

  const revenueTier = getRevenueCommissionRate({
    revenue,
    hitAllKpis: attainment.hitAllKpis,
  });

  const captureRule = getCaptureBonusRule(employmentMonth);
  const customerRule = getCustomerSoldBonusRule({
    employmentMonth,
    hitAllKpis: attainment.hitAllKpis,
  });

  const revenueCommission = revenue * revenueTier.rate;
  const captureBonus = captures * captureRule.amountPerCapture;
  const customerSoldBonus = customersSold * customerRule.amountPerCustomer;
  const hourlyCompensation = basePay.hourlyRate * HOURS_PER_MONTH;

  const totalEstimatedCompensation =
    revenueCommission +
    captureBonus +
    customerSoldBonus +
    hourlyCompensation;

  return {
    attainment,
    employment: attainment.employment,
    basePay,
    revenueTier,
    captureRule,
    customerRule,
    revenueCommission,
    captureBonus,
    customerSoldBonus,
    hourlyCompensation,
    totalEstimatedCompensation,
  };
}