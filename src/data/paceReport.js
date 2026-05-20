/**
 * Pace Report — adapter
 * --------------------------------
 * Surfaces Orion's live Pace Report data into the app. Mirrors the daily
 * report Orion runs in production, same columns, same column order, same math.
 *
 * Live source rows live in paceReportLive.js (generated from the gitignored
 * Pace Report_5_20_2026.xlsx export). This file shapes those rows into the
 * format the UI consumes, applies the team rollup, and derives the few fields
 * the export doesn't carry on every row (Shipping Day is only on row 1 of the
 * source workbook).
 *
 * Formulas (matched to the workbook):
 *   Daily Average        = Total Sales / Shipping Day
 *   Pace                 = Daily Average * Total Shipping Days in Month
 *   Pace To Goal         = Pace / Personal Goal           (1.00 = on goal)
 *   Daily Revenue Needed = Personal Goal / Total Shipping Days in Month
 *   Avg order size Month = Total Sales / # of monthly orders
 *   Avg order size Day   = Today's revenue / # of orders today
 */

import {
  PACE_LIVE_ROWS,
  PACE_LIVE_TEAMS,
  PACE_LIVE_DROPSHIP_BY_REP,
  PACE_LIVE_META,
} from "./paceReportLive.js";

export const PACE_REPORT_META = {
  reportDate: PACE_LIVE_META.reportDate,
  shippingDay: PACE_LIVE_META.shippingDay,
  totalShippingDaysInMonth: PACE_LIVE_META.totalShippingDaysInMonth,
  companyMonthlySalesNoDropship: PACE_LIVE_META.companyMonthlySalesNoDropship,
  companyTodaySalesNoDropship: PACE_LIVE_META.companyTodaySalesNoDropship,
  source: PACE_LIVE_META.source,
};

export const TEAMS = ["Chase", "Joey", "Don", "Tony", "Training", "Unassigned"];

export const PACE_REPORT_ROWS = PACE_LIVE_ROWS.map((r) => {
  const team = PACE_LIVE_TEAMS[r.repCode] || "Unassigned";
  const dropship = PACE_LIVE_DROPSHIP_BY_REP[r.repCode] || 0;
  return {
    ...r,
    team,
    dropshipSales: dropship,
    shippingDay: PACE_REPORT_META.shippingDay,
    totalShippingDaysInMonth: PACE_REPORT_META.totalShippingDaysInMonth,
  };
});

export const PACE_REPORT_COLUMNS = [
  { key: "repCode", label: "Rep Code" },
  { key: "name", label: "Name" },
  { key: "team", label: "Team" },
  { key: "tenureMonth", label: "Tenure Month", align: "right" },
  { key: "totalSales", label: "Total Sales", align: "right", format: "currency" },
  { key: "dailyAverage", label: "Daily Average", align: "right", format: "currency" },
  { key: "pace", label: "Pace", align: "right", format: "currency" },
  { key: "personalGoal", label: "Personal Goal", align: "right", format: "currency" },
  { key: "paceToGoal", label: "Pace To Goal", align: "right", format: "percent" },
  { key: "minGoal", label: "Min Goal", align: "right", format: "currency" },
  { key: "soldToTotal", label: "Sold To Total", align: "right" },
  { key: "soldToGoal", label: "Sold To Goal", align: "right" },
  { key: "captureTotal", label: "Capture Total", align: "right" },
  { key: "captureGoal", label: "Capture Goal", align: "right" },
  { key: "monthlyOrders", label: "# Monthly Orders", align: "right" },
  { key: "avgOrderSizeMonth", label: "Avg Order Size (Mo)", align: "right", format: "currency" },
  { key: "ordersToday", label: "# Orders Today", align: "right" },
  { key: "avgOrderSizeDay", label: "Avg Order Size (Day)", align: "right", format: "currency" },
  { key: "dailyRevenueNeeded", label: "Daily Revenue Needed", align: "right", format: "currency" },
  { key: "shippingDay", label: "Shipping Day", align: "right" },
  { key: "totalShippingDaysInMonth", label: "Total Shipping Days", align: "right" },
];

export function summarize(rows) {
  const totalSales = rows.reduce((s, r) => s + (r.totalSales || 0), 0);
  const totalGoal = rows.reduce((s, r) => s + (r.personalGoal || 0), 0);
  const totalMinGoal = rows.reduce((s, r) => s + (r.minGoal || 0), 0);
  const totalPace = rows.reduce((s, r) => s + (r.pace || 0), 0);
  const totalSoldTo = rows.reduce((s, r) => s + (r.soldToTotal || 0), 0);
  const soldToGoal = rows.reduce((s, r) => s + (r.soldToGoal || 0), 0);
  const totalCaptures = rows.reduce((s, r) => s + (r.captureTotal || 0), 0);
  const captureGoal = rows.reduce((s, r) => s + (r.captureGoal || 0), 0);
  const monthlyOrders = rows.reduce((s, r) => s + (r.monthlyOrders || 0), 0);
  const ordersToday = rows.reduce((s, r) => s + (r.ordersToday || 0), 0);
  const dropship = rows.reduce((s, r) => s + (r.dropshipSales || 0), 0);
  const onPace = rows.filter((r) => r.paceToGoal >= 1).length;
  const behind = rows.filter((r) => r.paceToGoal > 0 && r.paceToGoal < 0.85).length;

  return {
    totalSales,
    totalGoal,
    totalMinGoal,
    totalPace,
    teamPaceToGoal: totalGoal > 0 ? totalPace / totalGoal : 0,
    totalSoldTo,
    soldToGoal,
    totalCaptures,
    captureGoal,
    monthlyOrders,
    ordersToday,
    dropship,
    onPace,
    behind,
    totalReps: rows.length,
  };
}
