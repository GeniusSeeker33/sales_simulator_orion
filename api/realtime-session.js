import { requireLearner } from "./_lib/learner-auth.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!await requireLearner(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "realtime-session API is live",
      hasApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ code: "realtime_not_configured", error: "Live voice is not configured on the server." });

  try {
    const {
      customerType = "skeptical-store-owner",
      difficulty = "medium",
      scenario = {},
    } = req.body || {};

    const voice =
      customerType === "friendly-repeat-buyer"
        ? "coral"
        : customerType === "expert-buyer"
        ? "sage"
        : customerType === "price-shopper"
        ? "echo"
        : customerType === "angry-customer"
        ? "verse"
        : customerType === "indecisive-buyer"
        ? "shimmer"
        : customerType === "defer-to-partner"
        ? "ballad"
        : customerType === "ffl-compliance-dealer"
        ? "ash"
        : customerType === "loyal-to-competitor"
        ? "verse"
        : "alloy";

    const instructions = `
You are the AI Customer in the GeniusSeeker Sales Simulator.

You are having a live voice sales call with a sales rep.

Customer type: ${customerType}
Difficulty: ${difficulty}

Scenario:
${JSON.stringify(scenario, null, 2)}

Language:
- Always speak and respond in English (United States).
- Never switch to Spanish or any other language, even if the rep speaks another language or asks you to.

Rules:
- Speak naturally like a real American customer.
- Do not explain that you are AI.
- Do not coach or score the rep.
- Stay in character.
- Keep responses conversational and concise.
- If the rep is vague, push back.
- If the rep asks good discovery questions, reveal useful information.
- If the rep pitches too early, resist.
- If the rep earns trust, become more cooperative.
`;

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expires_after: {
            anchor: "created_at",
            seconds: 600,
          },
          session: {
            type: "realtime",
            model: "gpt-realtime",
            instructions,
            output_modalities: ["audio"],
            audio: {
              input: {
                transcription: {
                  model: "whisper-1",
                },
              },
              output: {
                voice,
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      // Never echo/log upstream bodies, which can contain request or credential details.
      console.warn("Realtime client-secret upstream failure", { status: response.status });
      return res.status(502).json({ code: "realtime_upstream_error", error: "Live voice provider is unavailable. Try text simulation." });
    }

    let data;
    try { data = await response.json(); }
    catch { return res.status(502).json({ code: "realtime_invalid_response", error: "Live voice provider returned an invalid session." }); }
    // Current GA client_secrets response is {value, expires_at, session}; no beta fallbacks.
    if (typeof data?.value !== "string" || !data.value.startsWith("ek_") || data.value.length <= 3 ||
        data.value === apiKey || !Number.isSafeInteger(data.expires_at) || data.expires_at <= Math.floor(Date.now() / 1000)) {
      return res.status(502).json({ code: "realtime_invalid_response", error: "Live voice provider returned an invalid session." });
    }
    return res.status(200).json({ clientSecret: data.value, expiresAt: data.expires_at });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.warn("Realtime client-secret request failed", { code: timeout ? "timeout" : "request_failed" });
    return res.status(timeout ? 504 : 502).json({
      code: timeout ? "realtime_upstream_timeout" : "realtime_upstream_error",
      error: "Live voice provider is unavailable. Try text simulation.",
    });
  }
}
