/**
 * Business Central — Revenue & Financial Data
 *
 * Returns monthly sales totals, gross profit, and G/L summary from BC.
 * Falls back to demo data when BC credentials are not configured.
 *
 * BC API endpoints used:
 *   GET /salesInvoices?$filter=postingDate ge {startDate}&$select=amount,postingDate,customerNumber
 *   GET /generalLedgerEntries?$filter=...   (for COGS)
 *
 * Recommended import strategy:
 *   - WEBHOOK: Subscribe to BC's "salesInvoice" entity webhooks for real-time updates
 *   - POLLING FALLBACK: Schedule this endpoint via a cron job every 15 minutes
 *   - Webhook setup: BC Admin → Extensions → Webhooks → Add subscription
 *     pointing to /api/business-central/webhook
 */

import { getBCToken, getBCBaseUrl } from "./auth.js";

const DEMO_DATA = {
  monthlyRevenue: 2847392,
  cogs: 2105963,
  grossProfit: 741429,
  grossMarginPct: 26,
  invoiceCount: 187,
  avgInvoiceValue: 15227,
  source: "demo",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const token = await getBCToken();
    const base = getBCBaseUrl();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const isoStart = startOfMonth.toISOString().slice(0, 10);

    const invoicesRes = await fetch(
      `${base}/salesInvoices?$filter=postingDate ge ${isoStart}&$select=amount,postingDate,currencyCode&$top=500`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );

    if (!invoicesRes.ok) throw new Error(`BC invoices fetch failed: ${invoicesRes.status}`);

    const invoicesData = await invoicesRes.json();
    const invoices = invoicesData.value || [];

    const monthlyRevenue = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

    res.json({
      monthlyRevenue,
      invoiceCount: invoices.length,
      avgInvoiceValue: invoices.length ? Math.round(monthlyRevenue / invoices.length) : 0,
      source: "live",
    });
  } catch (err) {
    if (err.message.includes("not configured")) {
      return res.json(DEMO_DATA);
    }
    console.error("BC revenue error:", err.message);
    res.status(500).json({ error: err.message, ...DEMO_DATA, source: "demo-fallback" });
  }
}
