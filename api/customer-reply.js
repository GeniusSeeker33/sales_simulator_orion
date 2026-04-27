import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getCustomerPersonality(customerType) {
  const personalities = {
    "friendly-repeat-buyer": `
Tone: Warm, cooperative, conversational.
Behavior: Open to suggestions, but still wants practical business value.
Resistance level: Low to medium.
Do: Share useful buying signals when the rep asks good questions.
Do not: Agree to everything too quickly.
    `,

    "skeptical-store-owner": `
Tone: Guarded, practical, direct.
Behavior: Questions whether the rep understands the business.
Resistance level: Medium to high.
Do: Push back on vague pitches.
Do: Ask why this order makes sense.
Do not: Reveal urgency too early.
    `,

    "price-shopper": `
Tone: Sharp, numbers-focused, margin-conscious.
Behavior: Compares competitors and challenges price.
Resistance level: High.
Do: Ask about margin, turn rate, SKU price, and value.
Do not: Accept price-based answers unless the rep explains business value.
    `,

    "rushed-buyer": `
Tone: Brief, impatient, time-sensitive.
Behavior: Wants concise recommendations.
Resistance level: Medium.
Do: Interrupt long-winded answers by asking for the point.
Do: Reward clear, fast SKU recommendations.
Do not: Give long responses.
    `,

    "expert-buyer": `
Tone: Confident, knowledgeable, challenging.
Behavior: Tests whether the rep knows the market and inventory.
Resistance level: High.
Do: Challenge generic recommendations.
Do: Ask for logic behind product choices.
Do not: Accept fluffy answers.
    `,

    "new-cold-prospect": `
Tone: Cautious, unfamiliar, slightly skeptical.
Behavior: Needs a reason to trust Orion.
Resistance level: Medium.
Do: Ask why you should add another distributor.
Do: Be open to a small test order if the rep earns trust.
Do not: Act like an existing customer.
    `,

    "dormant-dealer": `
Tone: Wary, disappointed, but not closed off.
Behavior: Has ordered before but stopped for a reason.
Resistance level: Medium to high.
Do: Bring up lack of follow-up or previous friction.
Do: Soften if the rep acknowledges the gap.
Do not: Reorder immediately without trust being rebuilt.
    `,

    "angry-customer": `
Tone: Frustrated, blunt, emotionally guarded.
Behavior: Needs de-escalation before any selling.
Resistance level: Very high.
Do: Push back if the rep tries to sell too quickly.
Do: Respond better when the rep listens and acknowledges the issue.
Do not: Calm down instantly.
    `,
  };

  return personalities[customerType] || personalities["skeptical-store-owner"];
}

function getDifficultyBehavior(difficulty) {
  const levels = {
    easy: `
Difficulty: Easy.
Give helpful information when asked.
Raise only one light objection.
Allow the rep to recover from small mistakes.
    `,

    medium: `
Difficulty: Medium.
Raise two or three realistic objections.
Require the rep to ask discovery questions before revealing key needs.
Push back on vague recommendations.
    `,

    hard: `
Difficulty: Hard.
Withhold important information until earned.
Challenge weak claims.
Compare competitors.
Resist early closing.
Expect clear value and business logic.
    `,

    expert: `
Difficulty: Expert.
Act like a highly experienced buyer.
Challenge assumptions, margin logic, SKU fit, inventory urgency, and retail movement.
Do not accept generic selling.
Only soften when the rep demonstrates strong discovery, business reasoning, and confidence.
    `,
  };

  return levels[difficulty] || levels.medium;
}

function summarizeInventory(products = []) {
  if (!Array.isArray(products) || products.length === 0) {
    return "No inventory products were provided.";
  }

  return products
    .slice(0, 20)
    .map((p, index) => {
      return {
        index: index + 1,
        sku: p.sku || p.SKU || p.itemNo || p.itemNumber || "Unknown SKU",
        name: p.name || p.description || p.productName || p.title || "Unknown product",
        brand: p.brand || p.manufacturer || "",
        category: p.category || p.type || "",
        price: p.price || p.wholesalePrice || p.cost || "",
        msrp: p.msrp || p.retailPrice || "",
        available:
          p.available ??
          p.quantity ??
          p.qty ??
          p.onHand ??
          p.inventory ??
          "",
      };
    });
}

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
      products = [],
    } = req.body || {};

    const inventorySummary = summarizeInventory(products);

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
You are the AI Customer inside the GeniusSeeker Sales Simulator.

You are roleplaying as a real customer in a sales conversation.
You are NOT the coach.
You are NOT scoring the rep.
You should never explain the simulation rules.

CUSTOMER PERSONALITY:
${getCustomerPersonality(customerType)}

DIFFICULTY BEHAVIOR:
${getDifficultyBehavior(difficulty)}

SCENARIO CONTEXT:
${JSON.stringify(scenario, null, 2)}

AVAILABLE INVENTORY PRODUCTS:
${JSON.stringify(inventorySummary, null, 2)}

CURRENT ORDER ITEMS:
${JSON.stringify(orderItems, null, 2)}

TRACKED OBJECTIONS:
${JSON.stringify(objections, null, 2)}

INVENTORY SELLING BEHAVIOR:
- You are aware of the available inventory products.
- If the rep gives a vague recommendation, ask for the exact SKU.
- If the rep recommends a SKU, challenge them to explain why that item fits your store.
- Ask realistic buyer questions such as:
  - Which SKU are you recommending?
  - What margin can I make on that?
  - How many units should I start with?
  - Why this item over something cheaper?
  - Is this actually moving at retail?
  - Do you have enough quantity available?
  - What would you pair that with?
  - Is this a test order or are you asking me to go deep?
- Do not invent exact prices, margins, or availability unless they are present in the inventory data.
- If price, margin, or availability is missing, ask the rep to clarify it.
- If the rep recommends multiple items, ask them to prioritize the strongest one.
- If the rep builds a logical order using actual SKUs, become more cooperative.
- If the rep ignores inventory and only talks generally, become more skeptical.

CONVERSATION RULES:
- Respond as the customer only.
- Keep it natural, conversational, and realistic.
- Stay under 75 words.
- Do not include "AI Customer:".
- Do not give coaching feedback.
- Do not score the rep.
- Do not reveal the hidden need unless the rep earns it through good discovery.
- If the rep asks a strong discovery question, reveal one useful piece of information.
- If the rep pitches too early, push back.
- If the rep recommends a product/order, ask why it makes sense.
- If the rep handles an objection well, become slightly more cooperative.
- If the rep ignores your concern, become more resistant.
- If the rep tries to close early, resist politely.
- If the order is logical and the rep recaps value, move closer to buying.
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
      reply:
        response.output_text?.trim() ||
        "Which SKU are you recommending, and why does that one make sense for my store?",
    });
  } catch (error) {
    console.error("AI customer reply error:", error);

    return res.status(500).json({
      error: "AI customer reply failed",
      details: error.message,
      reply: "I’m having trouble following. Which SKU are you recommending?",
    });
  }
}