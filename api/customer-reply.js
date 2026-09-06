import { buildDealerInstructions, dealerDialogue } from "./_lib/dealer-conversation.js";
import { requireLearner } from "./_lib/learner-auth.js";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (!await requireLearner(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "customer-reply API is live", hasApiKey: Boolean(process.env.OPENAI_API_KEY) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { messages = [], customerType = "skeptical-store-owner", difficulty = "medium", scenario = {}, orderItems = [], products = [] } = req.body || {};
    const dialogue = dealerDialogue(messages);
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: buildDealerInstructions({ customerType, difficulty, scenario, products, orderItems }) },
        ...dialogue,
        ...(dialogue.length ? [] : [{ role: "user", content: "The phone rings. Answer as the dealer." }]),
      ],
    });
    const reply = response.output_text?.trim();
    if (!reply) throw new Error("Missing customer response");
    return res.status(200).json({ reply });
  } catch {
    // An empty/failed response is a provider failure, never a scripted customer objection.
    return res.status(500).json({ error: "AI customer reply failed" });
  }
}
