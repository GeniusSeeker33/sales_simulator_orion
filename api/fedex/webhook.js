/**
 * FedEx — Shipment Event Notifications (Webhook)
 *
 * FedEx pushes real-time shipment events to this endpoint when package
 * status changes (picked up, in transit, out for delivery, delivered, exception).
 *
 * Setup in FedEx Developer Portal:
 *   1. Go to developer.fedex.com → My Apps → Notifications
 *   2. Subscribe to events: Shipment → In Transit, Delivered, Exception
 *   3. Set notification URL: https://your-vercel-app.vercel.app/api/fedex/webhook
 *   4. FedEx will send POST requests with X-FedEx-Signature header
 *
 * Required env var:
 *   FEDEX_WEBHOOK_SECRET — from FedEx Developer Portal subscription settings
 *
 * Data protection:
 *   Always validate the FedEx signature before processing.
 *   Never trust the body without verifying origin.
 */

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["x-fedex-signature"];
  const secret = process.env.FEDEX_WEBHOOK_SECRET;

  if (secret && signature) {
    const rawBody = JSON.stringify(req.body);
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expected) {
      return res.status(401).json({ error: "Signature mismatch" });
    }
  }

  try {
    const event = req.body;
    const trackingNumber = event?.TrackDetail?.TrackingNumber || "unknown";
    const eventType = event?.TrackDetail?.Events?.[0]?.EventDescription || "unknown";

    console.log(`FedEx event: ${trackingNumber} — ${eventType}`);

    // TODO: When a real event arrives:
    // 1. Find the matching order in BC by tracking number
    // 2. Update shipment status in your database / localStorage equivalent
    // 3. If "Exception" event, trigger a manager alert or Slack notification

    res.status(200).json({ received: true, trackingNumber, eventType });
  } catch (err) {
    console.error("FedEx webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
