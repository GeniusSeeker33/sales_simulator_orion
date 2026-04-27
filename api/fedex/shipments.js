/**
 * FedEx — Active Shipments
 *
 * Returns current shipment status for all active Orion outbound shipments.
 * Cross-references with BC sales orders for dealer name and order context.
 *
 * FedEx API used:
 *   POST /track/v1/trackingnumbers  — batch tracking up to 30 numbers
 *
 * Best practice:
 *   Store tracking numbers in your database when orders are created in BC.
 *   Query this endpoint to show live status on Admin View.
 *
 * For real-time updates use the FedEx Event Notifications webhook instead
 * (/api/fedex/webhook) to avoid polling.
 */

import { getFedExToken, getFedExBase } from "./auth.js";

const DEMO_SHIPMENTS = [
  { trackingNumber: "777849049601", status: "In Transit", destination: "Indianapolis, IN", estimatedDelivery: "2026-04-29", dealer: "Midwest Solar Group" },
  { trackingNumber: "777849049602", status: "In Transit", destination: "Grand Rapids, MI", estimatedDelivery: "2026-04-28", dealer: "Great Lakes Energy" },
  { trackingNumber: "777849049603", status: "Delivered", destination: "Columbus, OH", estimatedDelivery: "2026-04-27", dealer: "Ohio Power Solutions" },
  { trackingNumber: "777849049604", status: "Exception", destination: "Louisville, KY", estimatedDelivery: "2026-04-30", dealer: "Bluegrass Energy" },
  { trackingNumber: "777849049605", status: "Pending Pickup", destination: "Chicago, IL", estimatedDelivery: "2026-05-01", dealer: "Windy City Solar" },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { trackingNumbers } = req.body || {};

  try {
    const token = await getFedExToken();
    const base = getFedExBase();

    const numbers = Array.isArray(trackingNumbers) ? trackingNumbers.slice(0, 30) : [];
    if (!numbers.length) {
      return res.json({ shipments: DEMO_SHIPMENTS, source: "demo" });
    }

    const trackRes = await fetch(`${base}/track/v1/trackingnumbers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-locale": "en_US",
        "X-Customer-Transaction-Id": `orion-${Date.now()}`,
      },
      body: JSON.stringify({
        includeDetailedScans: false,
        trackingInfo: numbers.map((n) => ({ trackingNumberInfo: { trackingNumber: n } })),
      }),
    });

    if (!trackRes.ok) throw new Error(`FedEx track failed: ${trackRes.status}`);

    const data = await trackRes.json();
    const shipments = (data.output?.completeTrackResults || []).map((r) => {
      const t = r.trackResults?.[0] || {};
      return {
        trackingNumber: t.trackingNumberInfo?.trackingNumber,
        status: t.latestStatusDetail?.description || "Unknown",
        destination: t.recipientInformation?.address?.city || "—",
        estimatedDelivery: t.estimatedDeliveryTimeWindow?.window?.ends?.slice(0, 10) || "—",
      };
    });

    res.json({ shipments, source: "live" });
  } catch (err) {
    if (err.message.includes("not configured")) {
      return res.json({ shipments: DEMO_SHIPMENTS, source: "demo" });
    }
    console.error("FedEx shipments error:", err.message);
    res.status(500).json({ error: err.message, shipments: DEMO_SHIPMENTS, source: "demo-fallback" });
  }
}
