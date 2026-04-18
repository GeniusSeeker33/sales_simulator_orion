import { describe, it, expect } from "vitest";
import {
  getBasePayForMonth,
  getEmploymentMetrics,
  getKpiTargetsForMeasuredMonth,
  evaluateKpiAttainment,
  getRevenueCommissionRate,
  getCaptureBonusRule,
  getCustomerSoldBonusRule,
  calculateMonthlyCompensation,
  KPI_MEASUREMENT_DELAY_DAYS,
} from "../../../src/data/compPlan.js";

function dateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ─── getBasePayForMonth ────────────────────────────────────────────────────────

describe("getBasePayForMonth", () => {
  it("returns Year 1 rates for months 1-12", () => {
    const m1 = getBasePayForMonth(1);
    expect(m1.annualBaseSalary).toBe(31200);
    expect(m1.hourlyRate).toBe(15.0);

    const m12 = getBasePayForMonth(12);
    expect(m12.annualBaseSalary).toBe(31200);
  });

  it("returns Year 2+ rates for month 13+", () => {
    const m13 = getBasePayForMonth(13);
    expect(m13.annualBaseSalary).toBe(25000);
    expect(m13.hourlyRate).toBeCloseTo(12.02, 1);

    const m24 = getBasePayForMonth(24);
    expect(m24.annualBaseSalary).toBe(25000);
  });
});

// ─── getEmploymentMetrics ─────────────────────────────────────────────────────

describe("getEmploymentMetrics", () => {
  it("returns invalid metrics for a bad date", () => {
    const result = getEmploymentMetrics("not-a-date");
    expect(result.isValidStartDate).toBe(false);
    expect(result.kpiMeasurementActive).toBe(false);
  });

  it("places rep in ramp buffer within first 28 days", () => {
    const result = getEmploymentMetrics(dateString(10));
    expect(result.isInRampBuffer).toBe(true);
    expect(result.kpiMeasurementActive).toBe(false);
    expect(result.measuredMonth).toBe(0);
  });

  it("activates KPI measurement after 28 days", () => {
    const result = getEmploymentMetrics(dateString(35));
    expect(result.isInRampBuffer).toBe(false);
    expect(result.kpiMeasurementActive).toBe(true);
    expect(result.measuredMonth).toBeGreaterThanOrEqual(1);
  });

  it("does not produce negative daysEmployed for a future date", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const result = getEmploymentMetrics(futureDate.toISOString().slice(0, 10));
    expect(result.daysEmployed).toBe(0);
  });

  it("calculates correct measured month for 60 days employed", () => {
    const result = getEmploymentMetrics(dateString(60));
    // 60 - 28 = 32 days into measurement → floor(32/30)+1 = 2
    expect(result.measuredMonth).toBe(2);
  });

  it("KPI_MEASUREMENT_DELAY_DAYS is 28", () => {
    expect(KPI_MEASUREMENT_DELAY_DAYS).toBe(28);
  });
});

// ─── getKpiTargetsForMeasuredMonth ────────────────────────────────────────────

describe("getKpiTargetsForMeasuredMonth", () => {
  it("returns null targets for month 0", () => {
    const result = getKpiTargetsForMeasuredMonth(0);
    expect(result.minimumRevenue).toBeNull();
    expect(result.minimumCaptures).toBeNull();
  });

  it("returns month-1 targets correctly", () => {
    const result = getKpiTargetsForMeasuredMonth(1);
    expect(result.minimumRevenue).toBe(20000);
    expect(result.minimumCaptures).toBe(15);
    expect(result.minimumCustomersSold).toBe(15);
  });

  it("returns month-12 targets correctly", () => {
    const result = getKpiTargetsForMeasuredMonth(12);
    expect(result.minimumRevenue).toBe(250000);
  });

  it("caps at month-24 for any month beyond 24", () => {
    const m24 = getKpiTargetsForMeasuredMonth(24);
    const m99 = getKpiTargetsForMeasuredMonth(99);
    expect(m99.minimumRevenue).toBe(m24.minimumRevenue);
    expect(m99.minimumCaptures).toBe(m24.minimumCaptures);
  });
});

// ─── evaluateKpiAttainment ────────────────────────────────────────────────────

describe("evaluateKpiAttainment", () => {
  it("returns pre-measurement when within ramp buffer", () => {
    const result = evaluateKpiAttainment({
      startDate: dateString(10),
      revenue: 99999,
      captures: 99,
      customersSold: 99,
    });
    expect(result.isPreMeasurement).toBe(true);
    expect(result.hitAllKpis).toBe(false);
  });

  it("qualifies rep that hits all month-1 KPIs", () => {
    const result = evaluateKpiAttainment({
      startDate: dateString(35),
      revenue: 25000,
      captures: 20,
      customersSold: 20,
    });
    expect(result.hitRevenue).toBe(true);
    expect(result.hitCaptures).toBe(true);
    expect(result.hitCustomersSold).toBe(true);
    expect(result.hitAllKpis).toBe(true);
  });

  it("fails rep that misses one KPI", () => {
    const result = evaluateKpiAttainment({
      startDate: dateString(35),
      revenue: 25000,
      captures: 20,
      customersSold: 5, // below minimum of 15
    });
    expect(result.hitCustomersSold).toBe(false);
    expect(result.hitAllKpis).toBe(false);
  });
});

// ─── getRevenueCommissionRate ─────────────────────────────────────────────────

describe("getRevenueCommissionRate", () => {
  it("applies base rate (0.60%) when not qualified", () => {
    const tier = getRevenueCommissionRate({ revenue: 100000, hitAllKpis: false });
    expect(tier.rate).toBe(0.006);
    expect(tier.displayRate).toBe("0.60%");
  });

  it("applies qualified Tier A (0.75%) for revenue < $1M when qualified", () => {
    const tier = getRevenueCommissionRate({ revenue: 100000, hitAllKpis: true });
    expect(tier.rate).toBe(0.0075);
    expect(tier.label).toBe("Qualified Tier A");
  });

  it("applies qualified Tier B (0.80%) for revenue $1M-$1.5M when qualified", () => {
    const tier = getRevenueCommissionRate({ revenue: 1200000, hitAllKpis: true });
    expect(tier.rate).toBe(0.008);
    expect(tier.label).toBe("Qualified Tier B");
  });

  it("applies qualified Tier C (0.90%) for revenue >= $1.5M when qualified", () => {
    const tier = getRevenueCommissionRate({ revenue: 2000000, hitAllKpis: true });
    expect(tier.rate).toBe(0.009);
    expect(tier.label).toBe("Qualified Tier C");
  });
});

// ─── getCaptureBonusRule ──────────────────────────────────────────────────────

describe("getCaptureBonusRule", () => {
  it("returns $20 per capture for any month", () => {
    expect(getCaptureBonusRule(1).amountPerCapture).toBe(20);
    expect(getCaptureBonusRule(24).amountPerCapture).toBe(20);
  });
});

// ─── getCustomerSoldBonusRule ─────────────────────────────────────────────────

describe("getCustomerSoldBonusRule", () => {
  it("returns $3/customer Year 1 base tier", () => {
    const rule = getCustomerSoldBonusRule({ employmentMonth: 6, hitAllKpis: false });
    expect(rule.amountPerCustomer).toBe(3);
  });

  it("returns $3/customer Year 1 qualified tier", () => {
    const rule = getCustomerSoldBonusRule({ employmentMonth: 6, hitAllKpis: true });
    expect(rule.amountPerCustomer).toBe(3);
  });

  it("returns $7/customer Year 2 base tier", () => {
    const rule = getCustomerSoldBonusRule({ employmentMonth: 14, hitAllKpis: false });
    expect(rule.amountPerCustomer).toBe(7);
  });

  it("returns $10/customer Year 2 qualified tier", () => {
    const rule = getCustomerSoldBonusRule({ employmentMonth: 14, hitAllKpis: true });
    expect(rule.amountPerCustomer).toBe(10);
  });
});

// ─── calculateMonthlyCompensation ────────────────────────────────────────────

describe("calculateMonthlyCompensation", () => {
  it("calculates total comp components for a ramp-buffer rep", () => {
    const result = calculateMonthlyCompensation({
      startDate: dateString(10),
      revenue: 50000,
      captures: 10,
      customersSold: 15,
    });
    // ramp buffer → base tier commission
    expect(result.revenueTier.rate).toBe(0.006);
    expect(result.revenueCommission).toBeCloseTo(300, 0);
    // hourly = 15 * 160 = 2400
    expect(result.hourlyCompensation).toBe(2400);
    expect(result.totalEstimatedCompensation).toBeGreaterThan(0);
  });

  it("matches plan example: month-5 hit-all (qualified at 0.75%)", () => {
    // startDate 35 days ago → measured month 1, but we need measured month 5
    // 28 + (4 * 30) = 148 days → measured month 5
    const result = calculateMonthlyCompensation({
      startDate: dateString(148),
      revenue: 97844,
      captures: 17,
      customersSold: 41,
    });
    expect(result.attainment.hitAllKpis).toBe(true);
    expect(result.revenueTier.rate).toBe(0.0075);
    expect(result.revenueCommission).toBeCloseTo(97844 * 0.0075, 2);
  });

  it("matches plan example: month-5 miss-one (base at 0.60%)", () => {
    const result = calculateMonthlyCompensation({
      startDate: dateString(148),
      revenue: 97844,
      captures: 17,
      customersSold: 30, // below month-5 min of 35
    });
    expect(result.attainment.hitAllKpis).toBe(false);
    expect(result.revenueTier.rate).toBe(0.006);
  });

  it("totalEstimatedCompensation = hourly + commission + capture bonus + customer bonus", () => {
    const result = calculateMonthlyCompensation({
      startDate: dateString(60),
      revenue: 30000,
      captures: 20,
      customersSold: 25,
    });
    const expected =
      result.hourlyCompensation +
      result.revenueCommission +
      result.captureBonus +
      result.customerSoldBonus;
    expect(result.totalEstimatedCompensation).toBeCloseTo(expected, 5);
  });
});
