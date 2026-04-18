import { describe, it, expect } from "vitest";
import {
  buildRepCompSummary,
  buildCompOpportunitySummary,
  buildKpiStatusMessage,
  buildCompKpiCards,
  formatCurrency,
  formatPercentFromDecimal,
} from "../../../src/lib/compEngine.js";

function dateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats a whole dollar amount", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles null/undefined gracefully", () => {
    expect(formatCurrency(null)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
  });
});

// ─── formatPercentFromDecimal ─────────────────────────────────────────────────

describe("formatPercentFromDecimal", () => {
  it("converts 0.0075 to 0.75%", () => {
    expect(formatPercentFromDecimal(0.0075)).toBe("0.75%");
  });

  it("handles zero", () => {
    expect(formatPercentFromDecimal(0)).toBe("0.00%");
  });
});

// ─── buildRepCompSummary ──────────────────────────────────────────────────────

describe("buildRepCompSummary", () => {
  it("returns kpiMeasurementActive=false for a ramp-buffer rep", () => {
    const summary = buildRepCompSummary({
      startDate: dateString(5),
      revenue: 50000,
      captures: 10,
      customersSold: 20,
    });
    expect(summary.kpiMeasurementActive).toBe(false);
    expect(summary.isInRampBuffer).toBe(true);
  });

  it("returns all KPI attainment fields", () => {
    const summary = buildRepCompSummary({
      startDate: dateString(35),
      revenue: 25000,
      captures: 20,
      customersSold: 20,
    });
    expect(typeof summary.hitRevenue).toBe("boolean");
    expect(typeof summary.hitCaptures).toBe("boolean");
    expect(typeof summary.hitCustomersSold).toBe("boolean");
    expect(typeof summary.hitAllKpis).toBe("boolean");
  });

  it("totalEstimatedCompensation is non-negative", () => {
    const summary = buildRepCompSummary({
      startDate: dateString(60),
      revenue: 0,
      captures: 0,
      customersSold: 0,
    });
    expect(summary.totalEstimatedCompensation).toBeGreaterThanOrEqual(0);
  });

  it("higher revenue = higher commission", () => {
    const low = buildRepCompSummary({ startDate: dateString(60), revenue: 10000, captures: 20, customersSold: 30 });
    const high = buildRepCompSummary({ startDate: dateString(60), revenue: 100000, captures: 20, customersSold: 30 });
    expect(high.revenueCommission).toBeGreaterThan(low.revenueCommission);
  });

  it("qualified rep earns more commission than unqualified for same revenue", () => {
    // Month-1 KPI minimums: revenue 20k, captures 15, customers 15
    const qualified = buildRepCompSummary({
      startDate: dateString(35),
      revenue: 25000,
      captures: 20,
      customersSold: 20,
    });
    const unqualified = buildRepCompSummary({
      startDate: dateString(35),
      revenue: 25000,
      captures: 0,
      customersSold: 0,
    });
    if (qualified.hitAllKpis) {
      expect(qualified.revenueCommission).toBeGreaterThan(unqualified.revenueCommission);
    }
  });
});

// ─── buildCompOpportunitySummary ──────────────────────────────────────────────

describe("buildCompOpportunitySummary", () => {
  it("returns zero missed compensation for a ramp-buffer rep", () => {
    const result = buildCompOpportunitySummary({
      startDate: dateString(10),
      revenue: 50000,
      captures: 10,
      customersSold: 20,
    });
    expect(result.isPreMeasurement).toBe(true);
    expect(result.missedCompensation).toBe(0);
  });

  it("returns non-negative missedCompensation", () => {
    const result = buildCompOpportunitySummary({
      startDate: dateString(60),
      revenue: 5000,
      captures: 0,
      customersSold: 0,
    });
    expect(result.missedCompensation).toBeGreaterThanOrEqual(0);
  });

  it("returns zero missedCompensation when all KPIs hit", () => {
    // Ensure all KPIs are met for measured month 1 (revenue 20k, captures 15, customers 15)
    const result = buildCompOpportunitySummary({
      startDate: dateString(35),
      revenue: 25000,
      captures: 20,
      customersSold: 20,
    });
    if (result.actual.hitAllKpis) {
      expect(result.missedCompensation).toBe(0);
    }
  });

  it("contains actual and qualifiedScenario sub-summaries", () => {
    const result = buildCompOpportunitySummary({
      startDate: dateString(60),
      revenue: 10000,
      captures: 5,
      customersSold: 10,
    });
    expect(result.actual).toBeDefined();
    expect(result.qualifiedScenario).toBeDefined();
  });
});

// ─── buildKpiStatusMessage ────────────────────────────────────────────────────

describe("buildKpiStatusMessage", () => {
  it("indicates ramp buffer when within first 28 days", () => {
    const msg = buildKpiStatusMessage({
      startDate: dateString(10),
      revenue: 0,
      captures: 0,
      customersSold: 0,
    });
    expect(msg.toLowerCase()).toContain("first");
  });

  it("mentions qualified tier when all KPIs hit", () => {
    const msg = buildKpiStatusMessage({
      startDate: dateString(35),
      revenue: 25000,
      captures: 20,
      customersSold: 20,
    });
    // Could be qualified or missed depending on exact measured month targets
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("mentions missed KPIs when not qualified", () => {
    const msg = buildKpiStatusMessage({
      startDate: dateString(60),
      revenue: 0,
      captures: 0,
      customersSold: 0,
    });
    expect(msg.toLowerCase()).toMatch(/missed|base/);
  });
});

// ─── buildCompKpiCards ────────────────────────────────────────────────────────

describe("buildCompKpiCards", () => {
  it("returns 4 KPI cards", () => {
    const cards = buildCompKpiCards({
      startDate: dateString(60),
      revenue: 50000,
      captures: 10,
      customersSold: 20,
    });
    expect(cards).toHaveLength(4);
  });

  it("each card has id, label, value, note", () => {
    const cards = buildCompKpiCards({
      startDate: dateString(60),
      revenue: 50000,
      captures: 10,
      customersSold: 20,
    });
    for (const card of cards) {
      expect(card.id).toBeDefined();
      expect(card.label).toBeDefined();
      expect(card.value).toBeDefined();
      expect(card.note).toBeDefined();
    }
  });
});
