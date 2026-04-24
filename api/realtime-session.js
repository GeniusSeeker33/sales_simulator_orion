export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "realtime-session API is live",
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      customerType = "skeptical-store-owner",
      difficulty = "medium",
      scenario = {},
    } = req.body || {};

    const voice =
      customerType === "friendly-repeat-buyer"
        ? "nova"
        : customerType === "expert-buyer"
        ? "onyx"
        : customerType === "price-shopper"
        ? "echo"
        : customerType === "angry-customer"
        ? "verse"
        : "alloy";

    const instructions = `
You are the AI Customer in the GeniusSeeker Sales Simulator.

You are having a live voice sales call with a sales rep.

Customer type: ${customerType}
Difficulty: ${difficulty}

Scenario:
${JSON.stringify(scenario, null, 2)}

Rules:
- Speak naturally like a real customer.
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
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
            audio: {
              output: {
                voice,
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const data = await response.json();

    return res.status(200).json({
      clientSecret:
        data?.value || data?.client_secret?.value || data?.client_secret,
    });
  } catch (error) {
    console.error("Realtime session error:", error);

    return res.status(500).json({
      error: "Realtime session failed",
      details: error.message,
    });
  }
}