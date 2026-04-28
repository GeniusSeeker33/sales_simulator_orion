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

  const { actor, reward, cost, notes } = req.body ?? {};
  if (!actor || !cost) return res.status(400).json({ error: "actor and cost required" });

  const deduct = parseInt(cost, 10);
  if (isNaN(deduct) || deduct <= 0) return res.status(400).json({ error: "invalid cost" });

  const key = `glcd:${actor.toLowerCase()}`;

  try {
    const existing = (await kv.get(key))
      ?? DEMO_BALANCES[actor.toLowerCase()]
      ?? { balance: 0, earned: 0, redeemed: 0 };

    if (existing.balance < deduct) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${existing.balance.toLocaleString()} GD but need ${deduct.toLocaleString()} GD.`,
      });
    }

    const updated = {
      balance: existing.balance - deduct,
      earned: existing.earned,
      redeemed: existing.redeemed + deduct,
    };
    await kv.set(key, updated);

    // Store the redemption record for admin visibility
    await kv.set(`redemption:${Date.now()}:${actor.toLowerCase()}`, {
      actor,
      reward,
      cost: deduct,
      notes: notes ?? "",
      redeemedAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, newBalance: updated.balance });
  } catch {
    return res.status(500).json({ error: "Service temporarily unavailable. Please try again." });
  }
}
