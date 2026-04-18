import {
  HOURS_PER_MONTH,
  KPI_MEASUREMENT_DELAY_DAYS,
  getEmploymentMetrics,
  getKpiTargetsForMeasuredMonth,
  evaluateKpiAttainment,
  calculateMonthlyCompensation,
} from "../data/compPlan";

/**
 * Formatting helpers
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function formatPercentFromDecimal(decimalValue) {
  return `${(Number(decimalValue ?? 0) * 100).toFixed(2)}%`;
}

/**
 * Core summary for a rep-month
 */
export function buildRepCompSummary({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const comp = calculateMonthlyCompensation({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  const {
    attainment,
    employment,
    basePay,
    revenueTier,
    captureRule,
    customerRule,
    revenueCommission,
    captureBonus,
    customerSoldBonus,
    hourlyCompensation,
    totalEstimatedCompensation,
  } = comp;

  return {
    startDate,
    revenue,
    captures,
    customersSold,

    employmentMonth: employment.employmentMonth,
    measuredMonth: employment.measuredMonth,
    daysEmployed: employment.daysEmployed,
    isInRampBuffer: employment.isInRampBuffer,
    kpiMeasurementActive: employment.kpiMeasurementActive,
    kpiMeasurementDelayDays: KPI_MEASUREMENT_DELAY_DAYS,

    hitRevenue: attainment.hitRevenue,
    hitCaptures: attainment.hitCaptures,
    hitCustomersSold: attainment.hitCustomersSold,
    hitAllKpis: attainment.hitAllKpis,

    kpiTargets: attainment.targets,

    annualBaseSalary: basePay.annualBaseSalary,
    monthlyBaseSalary: basePay.monthlyBaseSalary,
    hourlyRate: basePay.hourlyRate,
    hoursPerMonth: HOURS_PER_MONTH,

    revenueCommissionRate: revenueTier.rate,
    revenueCommissionRateLabel: revenueTier.displayRate,
    revenueCommissionTierLabel: revenueTier.label,

    captureBonusPerUnit: captureRule.amountPerCapture,
    customerSoldBonusPerUnit: customerRule.amountPerCustomer,

    revenueCommission,
    captureBonus,
    customerSoldBonus,
    hourlyCompensation,
    totalEstimatedCompensation,
  };
}

/**
 * Compare actual comp vs. the upside if all KPI gates were hit.
 */
export function buildCompOpportunitySummary({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const actual = buildRepCompSummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  if (!actual.kpiMeasurementActive) {
    return {
      actual,
      qualifiedScenario: actual,
      missedCompensation: 0,
      missedCommissionOnly: 0,
      needsRevenue: false,
      needsCaptures: false,
      needsCustomersSold: false,
      targetRevenue: null,
      targetCaptures: null,
      targetCustomersSold: null,
      isPreMeasurement: true,
    };
  }

  const qualifiedScenario = buildQualifiedScenario({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  const missedCompensation =
    qualifiedScenario.totalEstimatedCompensation -
    actual.totalEstimatedCompensation;

  return {
    actual,
    qualifiedScenario,
    missedCompensation: Math.max(0, missedCompensation),
    missedCommissionOnly: Math.max(
      0,
      qualifiedScenario.revenueCommission - actual.revenueCommission
    ),
    needsRevenue: !actual.hitRevenue,
    needsCaptures: !actual.hitCaptures,
    needsCustomersSold: !actual.hitCustomersSold,
    targetRevenue: actual.kpiTargets.minimumRevenue,
    targetCaptures: actual.kpiTargets.minimumCaptures,
    targetCustomersSold: actual.kpiTargets.minimumCustomersSold,
    isPreMeasurement: false,
  };
}

/**
 * Build a scenario where the rep qualifies for the accelerated tier.
 */
export function buildQualifiedScenario({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const employment = getEmploymentMetrics(startDate);
  const targets = getKpiTargetsForMeasuredMonth(employment.measuredMonth);

  const qualifiedRevenue = Math.max(
    Number(revenue ?? 0),
    Number(targets.minimumRevenue ?? 0)
  );

  const qualifiedCaptures = Math.max(
    Number(captures ?? 0),
    Number(targets.minimumCaptures ?? 0)
  );

  const qualifiedCustomersSold = Math.max(
    Number(customersSold ?? 0),
    Number(targets.minimumCustomersSold ?? 0)
  );

  return buildRepCompSummary({
    startDate,
    revenue: qualifiedRevenue,
    captures: qualifiedCaptures,
    customersSold: qualifiedCustomersSold,
  });
}

/**
 * Dashboard-friendly KPI cards
 */
export function buildCompKpiCards({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const summary = buildRepCompSummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  const opportunity = buildCompOpportunitySummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  return [
    {
      id: "comp-card-total",
      label: "Estimated Total Compensation",
      value: formatCurrency(summary.totalEstimatedCompensation),
      note: summary.kpiMeasurementActive
        ? `${summary.hitAllKpis ? "Accelerated" : "Base"} revenue tier`
        : "KPI measurement not active yet",
    },
    {
      id: "comp-card-rate",
      label: "Commission Rate",
      value: summary.revenueCommissionRateLabel,
      note: summary.revenueCommissionTierLabel,
    },
    {
      id: "comp-card-revenue",
      label: "Revenue Commission",
      value: formatCurrency(summary.revenueCommission),
      note: `${formatCurrency(summary.revenue)} invoiced and paid`,
    },
    {
      id: "comp-card-opportunity",
      label: "Missed Upside",
      value: formatCurrency(opportunity.missedCompensation),
      note: summary.kpiMeasurementActive
        ? summary.hitAllKpis
          ? "All KPI gates achieved"
          : "Potential gain by hitting all KPI minimums"
        : "Rep is still in the first 4 weeks",
    },
  ];
}

/**
 * Human-readable status messaging
 */
export function buildKpiStatusMessage({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const summary = buildRepCompSummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  if (!summary.kpiMeasurementActive) {
    return `This rep is still within the first ${KPI_MEASUREMENT_DELAY_DAYS} days of employment. KPI qualification has not started yet.`;
  }

  if (summary.hitAllKpis) {
    return `All 3 KPI minimums achieved for measured month ${summary.measuredMonth}. Rep qualifies for the ${summary.revenueCommissionRateLabel} commission tier this month.`;
  }

  const misses = [];
  if (!summary.hitRevenue) misses.push("Revenue");
  if (!summary.hitCaptures) misses.push("Captures");
  if (!summary.hitCustomersSold) misses.push("Customers Sold");

  return `Rep missed ${misses.join(", ")} and therefore falls to the base ${summary.revenueCommissionRateLabel} commission tier for measured month ${summary.measuredMonth}.`;
}

/**
 * Leadership-facing breakdown rows
 */
export function buildLeadershipCompBreakdown({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const summary = buildRepCompSummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  return [
    {
      label: "Start Date",
      value: summary.startDate || "—",
    },
    {
      label: "Days Employed",
      value: summary.daysEmployed,
    },
    {
      label: "Employment Month",
      value: summary.employmentMonth,
    },
    {
      label: "Measured KPI Month",
      value: summary.kpiMeasurementActive ? summary.measuredMonth : "Not active",
    },
    {
      label: "Revenue",
      value: formatCurrency(summary.revenue),
    },
    {
      label: "Revenue Target",
      value:
        summary.kpiTargets.minimumRevenue == null
          ? "Not set"
          : formatCurrency(summary.kpiTargets.minimumRevenue),
    },
    {
      label: "Captures",
      value: summary.captures,
    },
    {
      label: "Capture Target",
      value:
        summary.kpiTargets.minimumCaptures == null
          ? "Not set"
          : summary.kpiTargets.minimumCaptures,
    },
    {
      label: "Customers Sold",
      value: summary.customersSold,
    },
    {
      label: "Customers Sold Target",
      value:
        summary.kpiTargets.minimumCustomersSold == null
          ? "Not set"
          : summary.kpiTargets.minimumCustomersSold,
    },
    {
      label: "Qualified for Accelerated Tier",
      value: summary.kpiMeasurementActive
        ? summary.hitAllKpis
          ? "Yes"
          : "No"
        : "Not measured yet",
    },
    {
      label: "Commission Rate",
      value: summary.revenueCommissionRateLabel,
    },
    {
      label: "Revenue Commission",
      value: formatCurrency(summary.revenueCommission),
    },
    {
      label: "Capture Bonus",
      value: formatCurrency(summary.captureBonus),
    },
    {
      label: "Customer Sold Bonus",
      value: formatCurrency(summary.customerSoldBonus),
    },
    {
      label: "Hourly Compensation",
      value: formatCurrency(summary.hourlyCompensation),
    },
    {
      label: "Total Estimated Compensation",
      value: formatCurrency(summary.totalEstimatedCompensation),
    },
  ];
}

/**
 * Quick calculator for examples/tests
 */
export function runCompExample({
  startDate,
  revenue,
  captures,
  customersSold,
}) {
  const summary = buildRepCompSummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  const opportunity = buildCompOpportunitySummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  return {
    summary,
    opportunity,
    statusMessage: buildKpiStatusMessage({
      startDate,
      revenue,
      captures,
      customersSold,
    }),
  };
}

/**
 * Validate KPI roadmap readiness.
 */
export function getCompPlanReadiness(startDate) {
  const employment = getEmploymentMetrics(startDate);
  const targets = getKpiTargetsForMeasuredMonth(employment.measuredMonth);

  const hasRevenueTarget = targets.minimumRevenue != null;
  const hasCaptureTarget = targets.minimumCaptures != null;
  const hasCustomersTarget = targets.minimumCustomersSold != null;

  return {
    startDate,
    employment,
    targets,
    isFullyConfigured:
      !employment.kpiMeasurementActive
        ? true
        : hasRevenueTarget && hasCaptureTarget && hasCustomersTarget,
    missingFields: [
      !employment.kpiMeasurementActive || hasRevenueTarget ? null : "minimumRevenue",
      !employment.kpiMeasurementActive || hasCaptureTarget ? null : "minimumCaptures",
      !employment.kpiMeasurementActive || hasCustomersTarget
        ? null
        : "minimumCustomersSold",
    ].filter(Boolean),
  };
}

/**
 * Small utility for raw UI usage
 */
export function getSimpleCompSnapshot({
  startDate,
  revenue = 0,
  captures = 0,
  customersSold = 0,
}) {
  const summary = buildRepCompSummary({
    startDate,
    revenue,
    captures,
    customersSold,
  });

  return {
    startDate: summary.startDate,
    employmentMonth: summary.employmentMonth,
    measuredMonth: summary.measuredMonth,
    kpiMeasurementActive: summary.kpiMeasurementActive,
    totalEstimatedCompensation: summary.totalEstimatedCompensation,
    commissionRate: summary.revenueCommissionRate,
    commissionRateLabel: summary.revenueCommissionRateLabel,
    hitAllKpis: summary.hitAllKpis,
    revenueCommission: summary.revenueCommission,
    captureBonus: summary.captureBonus,
    customerSoldBonus: summary.customerSoldBonus,
    hourlyCompensation: summary.hourlyCompensation,
  };
}