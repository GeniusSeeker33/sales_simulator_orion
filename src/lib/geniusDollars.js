const IDENTITY_SERVICE_URL =
  import.meta.env.VITE_IDENTITY_SERVICE_URL || "https://identity.geniusseeker.com";

export function calcGlcd(overallScore, difficulty) {
  let base = 50;

  if (overallScore >= 90) base += 100;
  else if (overallScore >= 80) base += 50;
  else if (overallScore >= 70) base += 25;

  const multiplier = difficulty === "hard" ? 2 : difficulty === "medium" ? 1.5 : 1;
  return Math.round(base * multiplier);
}

export async function logGlcd({ actor, amount, overallScore, difficulty, sessionRef }) {
  try {
    await fetch(`${IDENTITY_SERVICE_URL}/api/value/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor,
        eventType: "SIMULATION_COMPLETED",
        amount: String(amount),
        currency: "GLCD",
        reference: sessionRef || "sales-simulator",
        metadata: { overallScore, difficulty, source: "orion-simulator" },
      }),
    });
  } catch {
    // Non-fatal — simulator works without identity-service
  }
}

export async function fetchBalance(actor) {
  try {
    const res = await fetch(`${IDENTITY_SERVICE_URL}/api/value/balance/${encodeURIComponent(actor)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitRedemption({ actor, reward, cost, notes }) {
  const res = await fetch(`${IDENTITY_SERVICE_URL}/api/value/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, reward, cost, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Redemption failed");
  }
  return await res.json();
}
