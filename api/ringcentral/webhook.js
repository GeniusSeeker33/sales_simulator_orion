/**
 * RingCentral — Real-Time Call Event Webhook
 *
 * RC pushes events in real-time as calls start, connect, and end.
 * Use this for live "calls in progress" visibility on Manager View.
 *
 * Setup in RC Developer Portal:
 *   1. Create an app with Push Notifications permission
 *   2. POST to /restapi/v1.0/subscription with your webhook URL:
 *      { "eventFilters": ["/restapi/v1.0/account/~/telephony/sessions"],
 *        "deliveryMode": { "transportType": "WebHook",
 *                          "address": "https://your-app.vercel.app/api/ringcentral/webhook",
 *                          "secret": "YOUR_WEBHOOK_SECRET" } }
 *
 * Required env var:
 *   RINGCENTRAL_WEBHOOK_SECRET — set when creating the subscription above
 */

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("RC Webhook endpoint active");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rcSecret = req.headers["verification-token"];
  const expectedSecret = process.env.RINGCENTRAL_WEBHOOK_SECRET;

  if (expectedSecret && rcSecret !== expectedSecret) {
    return res.status(401).json({ error: "Invalid verification token" });
  }

  if (req.headers["validation-token"]) {
    return res.status(200).set("Validation-Token", req.headers["validation-token"]).json({});
  }

  try {
    const event = req.body;
    const eventType = event?.event || "unknown";
    const body = event?.body || {};

    console.log(`RC event: ${eventType}`, JSON.stringify(body).slice(0, 200));

    // TODO: Handle telephony session events:
    // - session started → mark rep as "on a call" in real-time dashboard
    // - session ended → save call record to database for Manager View
    // - missed call → trigger coaching alert if rep has low connect rate

    res.status(200).json({ received: true, eventType });
  } catch (err) {
    console.error("RC webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
