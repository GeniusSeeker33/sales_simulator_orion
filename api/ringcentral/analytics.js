/**
 * RingCentral — Call Analytics per Rep
 *
 * Returns call volume, connection rates, and duration breakdown per rep.
 * Used in Manager View and Admin View for performance tracking.
 *
 * RC API endpoints used:
 *   GET /account/{accountId}/extension  — list all extensions (map to reps)
 *   GET /account/{accountId}/call-log   — full call log with per-extension filter
 *
 * Better approach for scale:
 *   Use RC Analytics API v2 (Business Analytics):
 *   POST /analytics/phone/performance/v1/accounts/{accountId}/calls/aggregate
 *   This returns pre-aggregated call metrics per extension without paginating call logs.
 */

import { getRCToken, RC_BASE } from "./auth.js";

const DEMO_ANALYTICS = {
  summary: {
    totalCalls: 847,
    connectedCalls: 612,
    avgDurationSeconds: 187,
    connectRate: 72,
  },
  byRep: [
    { repCode: "CJF", repName: "Chase Farmer", calls: 94, connected: 71, avgDuration: 203, connectRate: 76 },
    { repCode: "DSC", repName: "Don Clark", calls: 87, connected: 63, avgDuration: 192, connectRate: 72 },
    { repCode: "JAA", repName: "Jason Arnstein", calls: 76, connected: 54, avgDuration: 178, connectRate: 71 },
    { repCode: "TLJ", repName: "Tony Lantrip", calls: 82, connected: 59, avgDuration: 195, connectRate: 72 },
    { repCode: "JWB", repName: "Joseph Babcock", calls: 71, connected: 49, avgDuration: 168, connectRate: 69 },
  ],
  source: "demo",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const accountId = process.env.RINGCENTRAL_ACCOUNT_ID || "~";

  const dateFrom = new Date();
  dateFrom.setDate(1);
  const dateFromStr = dateFrom.toISOString().slice(0, 10);

  try {
    const token = await getRCToken();

    const callLogRes = await fetch(
      `${RC_BASE}/account/${accountId}/call-log?dateFrom=${dateFromStr}T00:00:00Z&view=Detailed&type=Voice&perPage=1000`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );

    if (!callLogRes.ok) throw new Error(`RC call-log fetch failed: ${callLogRes.status}`);

    const data = await callLogRes.json();
    const records = data.records || [];

    const byExt = {};
    records.forEach((call) => {
      const ext = call.from?.extensionNumber || call.to?.extensionNumber || "unknown";
      if (!byExt[ext]) byExt[ext] = { calls: 0, connected: 0, totalDuration: 0 };
      byExt[ext].calls += 1;
      byExt[ext].totalDuration += Number(call.duration || 0);
      if (call.result === "Call connected") byExt[ext].connected += 1;
    });

    const byRep = Object.entries(byExt).map(([ext, stats]) => ({
      extension: ext,
      calls: stats.calls,
      connected: stats.connected,
      avgDuration: stats.calls ? Math.round(stats.totalDuration / stats.calls) : 0,
      connectRate: stats.calls ? Math.round((stats.connected / stats.calls) * 100) : 0,
    }));

    res.json({
      summary: {
        totalCalls: records.length,
        connectedCalls: byRep.reduce((s, r) => s + r.connected, 0),
        avgDurationSeconds: records.length
          ? Math.round(records.reduce((s, r) => s + Number(r.duration || 0), 0) / records.length)
          : 0,
      },
      byRep,
      source: "live",
    });
  } catch (err) {
    if (err.message.includes("not configured")) {
      return res.json(DEMO_ANALYTICS);
    }
    console.error("RC analytics error:", err.message);
    res.status(500).json({ error: err.message, ...DEMO_ANALYTICS, source: "demo-fallback" });
  }
}
