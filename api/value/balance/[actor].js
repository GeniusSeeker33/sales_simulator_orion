import { kv } from "@vercel/kv";

// Seeded starting balances for demo accounts.
// Used when no KV record exists yet — survives cold starts and works before KV is connected.
const DEMO_BALANCES = {
  "desireethayer1@gmail.com":           { balance: 5200, earned: 5200, redeemed: 0 },
  "desiree@orionwholesaleonline.com":   { balance: 5200, earned: 5200, redeemed: 0 },
  "jamesf@orionwholesaleonline.com":    { balance: 1800, earned: 1800, redeemed: 0 },
  "timh@orionwholesaleonline.com":      { balance: 1200, earned: 1200, redeemed: 0 },
  "charliek@orionwholesaleonine.com":   { balance: 800,  earned: 800,  redeemed: 0 },
  "neild@oronwholesaleonline.com":      { balance: 600,  earned: 600,  redeemed: 0 },
  "alannah@orionwholesaleonline.com":   { balance: 450,  earned: 450,  redeemed: 0 },
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { actor } = req.query;
  if (!actor) return res.status(400).json({ error: "actor required" });

  const key = `glcd:${actor.toLowerCase()}`;

  try {
    const stored = await kv.get(key);
    if (stored) return res.status(200).json(stored);

    const demo = DEMO_BALANCES[actor.toLowerCase()] ?? { balance: 0, earned: 0, redeemed: 0 };
    return res.status(200).json(demo);
  } catch {
    // KV not connected yet — fall back to demo seed so the widget still works
    const demo = DEMO_BALANCES[actor.toLowerCase()] ?? { balance: 0, earned: 0, redeemed: 0 };
    return res.status(200).json(demo);
  }
}
