import { kv } from "@vercel/kv";

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { actor, amount } = req.body ?? {};
  if (!actor || !amount) return res.status(400).json({ error: "actor and amount required" });

  const add = parseInt(amount, 10);
  if (isNaN(add) || add <= 0) return res.status(400).json({ error: "invalid amount" });

  const key = `glcd:${actor.toLowerCase()}`;

  try {
    const existing = (await kv.get(key))
      ?? DEMO_BALANCES[actor.toLowerCase()]
      ?? { balance: 0, earned: 0, redeemed: 0 };

    const updated = {
      balance: existing.balance + add,
      earned: existing.earned + add,
      redeemed: existing.redeemed,
    };
    await kv.set(key, updated);
    return res.status(200).json({ ok: true, newBalance: updated.balance });
  } catch {
    // Non-fatal — simulator works without a live KV store
    return res.status(200).json({ ok: true, newBalance: null });
  }
}
