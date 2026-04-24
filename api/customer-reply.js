import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "customer-reply API is live",
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      messages = [],
      customerType = "skeptical-store-owner",
      difficulty = "medium",
      scenario = {},
      orderItems = [],
      objections = [],
    } = req.body || {};

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
You are the AI Customer in the GeniusSeeker Sales Simulator.

You are NOT the coach.
You are NOT scoring the rep.
You are roleplaying as a realistic customer in a sales call.

Customer type: ${customerType}
Difficulty: ${difficulty}

Scenario:
${JSON.stringify(scenario, null, 2)}

Current order items:
${JSON.stringify(orderItems, null, 2)}

Objections currently tracked:
${JSON.stringify(objections, null, 2)}

Rules:
- Respond as the customer only.
- Keep responses natural and conversational.
- Do not reveal the hidden need too easily.
- Reward good discovery questions by giving more useful information.
- Raise objections based on the scenario and difficulty.
- If the rep is vague, push back.
- If the rep recommends a logical order, engage with it.
- If the rep tries to close too early, resist politely.
- Stay under 75 words.
- Do not include labels like "AI Customer:".
- Do not provide coaching or scoring.
          `,
        },
        {
          role: "user",
          content: `
Conversation so far:
${JSON.stringify(messages, null, 2)}

Generate the customer's next reply.
          `,
        },
      ],
    });

    return res.status(200).json({
      reply: response.output_text?.trim() || "Tell me more about what you recommend.",
    });
  } catch (error) {
    console.error("AI customer reply error:", error);

    return res.status(500).json({
      error: "AI customer reply failed",
      details: error.message,
      reply: "I’m having trouble following. Can you explain that another way?",
    });
  }
}