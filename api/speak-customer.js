import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "speak-customer API is live",
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text = "", voice = "alloy" } = req.body || {};

    if (!text.trim()) {
      return res.status(400).json({
        error: "Missing text",
      });
    }

    const audio = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      format: "mp3",
    });

    const buffer = Buffer.from(await audio.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Customer speech error:", error);

    return res.status(500).json({
      error: "Customer speech failed",
      details: error.message,
    });
  }
}