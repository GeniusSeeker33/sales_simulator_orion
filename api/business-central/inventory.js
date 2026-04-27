/**
 * Business Central — Inventory Levels
 *
 * Returns current item inventory, quantities on hand, and reorder status.
 *
 * BC API endpoints used:
 *   GET /items?$select=number,displayName,unitPrice,inventory,unitCost&$top=500
 *
 * Data protection:
 *   - BC credentials stay server-side in Vercel env vars
 *   - Client never sees BC_CLIENT_SECRET or tenant tokens
 *   - Only scoped inventory fields are returned to the frontend
 */

import { getBCToken, getBCBaseUrl } from "./auth.js";

const DEMO_DATA = {
  items: [
    { number: "ITEM-001", name: "Solar Panel Kit 400W", unitPrice: 1249, inventory: 142, unitCost: 890 },
    { number: "ITEM-002", name: "Inverter 5kW", unitPrice: 2199, inventory: 87, unitCost: 1540 },
    { number: "ITEM-003", name: "Battery Pack 10kWh", unitPrice: 3799, inventory: 54, unitCost: 2800 },
    { number: "ITEM-004", name: "Mounting System 20 Panel", unitPrice: 649, inventory: 203, unitCost: 430 },
    { number: "ITEM-005", name: "EV Charger Level 2", unitPrice: 899, inventory: 31, unitCost: 600 },
  ],
  totalItems: 5,
  lowStockCount: 1,
  source: "demo",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const token = await getBCToken();
    const base = getBCBaseUrl();

    const itemsRes = await fetch(
      `${base}/items?$select=number,displayName,unitPrice,inventory,unitCost&$top=500`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );

    if (!itemsRes.ok) throw new Error(`BC items fetch failed: ${itemsRes.status}`);

    const data = await itemsRes.json();
    const items = (data.value || []).map((item) => ({
      number: item.number,
      name: item.displayName,
      unitPrice: item.unitPrice,
      inventory: item.inventory,
      unitCost: item.unitCost,
    }));

    res.json({
      items,
      totalItems: items.length,
      lowStockCount: items.filter((i) => i.inventory < 10).length,
      source: "live",
    });
  } catch (err) {
    if (err.message.includes("not configured")) {
      return res.json(DEMO_DATA);
    }
    console.error("BC inventory error:", err.message);
    res.status(500).json({ error: err.message, ...DEMO_DATA, source: "demo-fallback" });
  }
}
