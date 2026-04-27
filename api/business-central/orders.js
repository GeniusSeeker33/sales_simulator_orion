/**
 * Business Central — Sales Orders
 *
 * Returns open and recently shipped sales orders.
 * Used to populate Admin View order pipeline and match orders to rep accounts.
 *
 * BC API endpoints used:
 *   GET /salesOrders?$filter=status ne 'Released'&$expand=salesOrderLines&$top=200
 */

import { getBCToken, getBCBaseUrl } from "./auth.js";

const DEMO_DATA = {
  openOrders: 34,
  pendingValue: 1102400,
  orders: [
    { orderNumber: "SO-10451", customerName: "Green Energy Depot", amount: 48200, status: "Open", dueDate: "2026-05-02" },
    { orderNumber: "SO-10452", customerName: "SolarTech Midwest", amount: 31750, status: "Open", dueDate: "2026-05-03" },
    { orderNumber: "SO-10453", customerName: "Bright Future Energy", amount: 67400, status: "Pending Approval", dueDate: "2026-05-01" },
  ],
  source: "demo",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const token = await getBCToken();
    const base = getBCBaseUrl();

    const ordersRes = await fetch(
      `${base}/salesOrders?$filter=status ne 'Released'&$select=number,customerName,amount,status,requestedDeliveryDate&$top=200`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );

    if (!ordersRes.ok) throw new Error(`BC orders fetch failed: ${ordersRes.status}`);

    const data = await ordersRes.json();
    const orders = (data.value || []).map((o) => ({
      orderNumber: o.number,
      customerName: o.customerName,
      amount: o.amount,
      status: o.status,
      dueDate: o.requestedDeliveryDate,
    }));

    const pendingValue = orders.reduce((s, o) => s + Number(o.amount || 0), 0);

    res.json({ openOrders: orders.length, pendingValue, orders: orders.slice(0, 50), source: "live" });
  } catch (err) {
    if (err.message.includes("not configured")) {
      return res.json(DEMO_DATA);
    }
    console.error("BC orders error:", err.message);
    res.status(500).json({ error: err.message, ...DEMO_DATA, source: "demo-fallback" });
  }
}
