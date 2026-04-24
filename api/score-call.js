import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { transcript = [], orderItems = [], objections = [] } = req.body || {};

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
You are a sales training evaluator.

Score from 0-100:
- overall
- discovery
- orderBuilding
- objectionHandling
- closing

Return ONLY JSON:
{
  "overall": 0,
  "discovery": 0,
  "orderBuilding": 0,
  "objectionHandling": 0,
  "closing": 0,
  "strengths": [],
  "missedOpportunities": [],
  "coachingNote": "",
  "betterPhrases": []
}
          `,
        },
        {
          role: "user",
          content: JSON.stringify({ transcript, orderItems, objections }),
        },
      ],
    });

    const text = response.output_text;
    const parsed = JSON.parse(text);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("AI scoring error:", error);

    return res.status(500).json({
      error: "AI scoring failed",
      details: error.message,
    });
  }
}