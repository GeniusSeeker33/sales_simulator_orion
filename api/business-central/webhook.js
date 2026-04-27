/**
 * Business Central — Incoming Webhook Handler
 *
 * BC sends webhook notifications when records change (invoices, orders, items).
 * This endpoint receives those events and triggers a data sync.
 *
 * Setup in BC:
 *   BC Admin → Extensions → Webhooks → New Subscription
 *   - Notification URL: https://your-vercel-app.vercel.app/api/business-central/webhook
 *   - Entity: salesInvoice, salesOrder, item (one subscription per entity type)
 *   - Secret key: any string — set as BC_WEBHOOK_SECRET in Vercel env vars
 *
 * Required env var:
 *   BC_WEBHOOK_SECRET   — shared secret for validating incoming webhook calls
 *
 * Security: BC includes the secret in the Authorization header.
 * Always validate before processing.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const incomingSecret = req.headers["authorization"];
  const expectedSecret = process.env.BC_WEBHOOK_SECRET;

  if (expectedSecret && incomingSecret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = req.body;
    const entityName = payload?.subscriptionId || "unknown";
    const changeType = payload?.changeType || "unknown";

    console.log(`BC Webhook received: entity=${entityName} changeType=${changeType}`);

    // TODO: On real data change events, trigger a re-sync:
    // - If salesInvoice changed → re-fetch revenue totals
    // - If salesOrder changed → re-fetch open orders
    // - If item changed → re-fetch inventory levels
    // Then push updates to your frontend via server-sent events or a polling signal

    res.status(200).json({ received: true, entityName, changeType });
  } catch (err) {
    console.error("BC webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
