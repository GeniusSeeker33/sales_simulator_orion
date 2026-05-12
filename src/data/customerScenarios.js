export const customerTypes = [
  {
    id: "friendly-repeat-buyer",
    label: "Friendly Repeat Buyer",
    description: "Warm customer who is open to suggestions but still needs a clear order recommendation.",
  },
  {
    id: "skeptical-store-owner",
    label: "Skeptical Store Owner",
    description: "Questions value, trust, pricing, and whether the rep understands their business.",
  },
  {
    id: "price-shopper",
    label: "Price Shopper",
    description: "Focused on margin, competitor pricing, and getting the best deal.",
  },
  {
    id: "rushed-buyer",
    label: "Rushed Buyer",
    description: "Short on time and expects the rep to be concise and useful quickly.",
  },
  {
    id: "expert-buyer",
    label: "Expert Buyer",
    description: "Knows the market and challenges weak product knowledge or generic selling.",
  },
  {
    id: "new-cold-prospect",
    label: "New Account / Cold Prospect",
    description: "Does not know Orion yet and needs a reason to engage.",
  },
  {
    id: "dormant-dealer",
    label: "Dormant Dealer",
    description: "Previously bought but has not ordered recently due to a prior issue or lack of follow-up.",
  },
  {
    id: "angry-customer",
    label: "Angry / Frustrated Customer",
    description: "Has a complaint and needs the rep to de-escalate before selling.",
  },
  {
    id: "indecisive-buyer",
    label: "Indecisive Buyer",
    description: "Hedges every decision and asks the rep to choose for them. Trains confident recommending.",
  },
  {
    id: "defer-to-partner",
    label: "Defer-to-Partner Buyer",
    description: "\"I need to check with my partner / store manager.\" Trains reps to surface the real decision-maker early.",
  },
  {
    id: "ffl-compliance-dealer",
    label: "FFL Compliance-Focused Dealer",
    description: "Worried about ATF paperwork, transfer delays, and audit risk. Trains regulatory fluency.",
  },
  {
    id: "loyal-to-competitor",
    label: "Loyal-to-Competitor Dealer",
    description: "Long-standing relationship with another distributor. Trains wedge-selling and displacement.",
  },
];

export const difficultyLevels = [
  {
    id: "easy",
    label: "Easy",
    description: "Customer gives needs quickly and raises light objections.",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Customer has several objections and needs thoughtful discovery.",
  },
  {
    id: "hard",
    label: "Hard",
    description: "Customer resists, compares competitors, and withholds key buying information.",
  },
  {
    id: "expert",
    label: "Expert",
    description: "Customer challenges product knowledge, margin logic, urgency, and confidence.",
  },
];

export const scenarioGoals = [
  "Build a weekend promo order",
  "Restock top sellers",
  "Test a new distributor",
  "Solve an inventory gap",
  "Compare pricing and margin",
  "Recover from a previous bad experience",
  "Build a hunting-season bundle",
  "Build a women’s self-defense package",
  "Build an optics/accessories add-on order",
  "Displace a competitor distributor",
  "Walk through a compliance-sensitive order",
  "Re-engage a deferring buyer with a firm next step",
  "Lead an indecisive buyer to a clear order",
];

export const customerScenarios = {
  "friendly-repeat-buyer": {
    opener:
      "Good to hear from you. I need a few things, but I’m open to suggestions if you have anything moving well right now.",
    hiddenNeed:
      "Needs a practical restock order with a few add-on items that could move quickly.",
    budget: "$1,500–$3,000",
    likelyObjections: ["availability", "margin", "order size"],
    buyingSignals: [
      "Asks what is moving this week",
      "Mentions needing to restock",
      "Asks what pairs well with a product",
    ],
    successCondition:
      "Rep asks what has been selling, recommends a balanced order, adds one or two logical add-ons, and clearly recaps the order.",
    replies: [
      "I’m not looking for anything crazy, just something that makes sense.",
      "What are other stores having success with right now?",
      "That could work. What would you pair with it?",
      "I don’t want to overbuy. Keep it practical.",
      "Okay, recap the order for me.",
    ],
  },

  "skeptical-store-owner": {
    opener:
      "Before I add anything, tell me why I should order from you instead of my current distributor.",
    hiddenNeed:
      "Needs fast-moving inventory for an upcoming weekend promotion but does not want to admit urgency too early.",
    budget: "$2,500–$5,000",
    likelyObjections: ["trust", "price", "shipping"],
    buyingSignals: [
      "Asks what is moving this week",
      "Mentions not wanting dead inventory",
      "Asks about shipping speed",
    ],
    successCondition:
      "Rep earns trust, asks discovery questions, avoids overpitching, handles price and shipping concerns, and builds a targeted order.",
    replies: [
      "Price matters, but I also need to know what is actually moving right now.",
      "I do not want dead inventory sitting on my shelf.",
      "Shipping has burned me before. How fast can I realistically get this?",
      "Your competitor already has my business. What are you bringing me that is different?",
      "Okay, build me a small order that makes sense, but do not overload me.",
    ],
  },

  "price-shopper": {
    opener:
      "I’m mostly comparing prices today. If the numbers don’t work, I’m not placing an order.",
    hiddenNeed:
      "Wants margin confidence and a reason to buy beyond the cheapest price.",
    budget: "$1,000–$4,000",
    likelyObjections: ["price", "competitor", "margin"],
    buyingSignals: [
      "Asks about margin",
      "Compares competitor pricing",
      "Asks for best movers",
    ],
    successCondition:
      "Rep reframes value, discusses turn rate and margin, avoids immediately discounting, and recommends items with a clear business case.",
    replies: [
      "Your competitor says they can beat that.",
      "What kind of margin can I actually make on this?",
      "I do not want to buy something just because it is cheap.",
      "What is the strongest value item you have right now?",
      "Give me your tightest practical order.",
    ],
  },

  "rushed-buyer": {
    opener:
      "I only have five minutes. What do you have that I should care about?",
    hiddenNeed:
      "Needs a quick reorder but will only engage if the rep is concise and useful.",
    budget: "$1,000–$2,500",
    likelyObjections: ["time", "availability", "clarity"],
    buyingSignals: [
      "Asks for fastest recommendation",
      "Mentions limited time",
      "Responds well to concise recap",
    ],
    successCondition:
      "Rep quickly asks one or two focused questions, recommends a clear order, confirms availability, and closes efficiently.",
    replies: [
      "Get to the point for me.",
      "Is it in stock or not?",
      "I do not have time for a long pitch.",
      "What is the fastest order you can build for me?",
      "Okay, summarize it quickly.",
    ],
  },

  "expert-buyer": {
    opener:
      "I already know the market. Tell me what is different this week.",
    hiddenNeed:
      "Wants smart inventory insight and will reject generic recommendations.",
    budget: "$5,000–$10,000",
    likelyObjections: ["product knowledge", "margin", "market demand"],
    buyingSignals: [
      "Asks for market movement",
      "Challenges product logic",
      "Requests specific SKU rationale",
    ],
    successCondition:
      "Rep demonstrates business understanding, gives specific recommendations, ties products to demand, and asks for a confident commitment.",
    replies: [
      "What SKUs are moving that others are missing?",
      "I need data, not a generic pitch.",
      "Why that product instead of something with a better turn rate?",
      "How would you structure this order by customer demand?",
      "Convince me this order will turn.",
    ],
  },

  "new-cold-prospect": {
    opener:
      "I don’t think we’ve ordered from you before. What exactly are you calling about?",
    hiddenNeed:
      "Could be open to testing Orion if the rep creates trust and keeps the first order low-risk.",
    budget: "$500–$2,000 test order",
    likelyObjections: ["trust", "risk", "current distributor"],
    buyingSignals: [
      "Asks who else buys from Orion",
      "Asks what makes Orion different",
      "Mentions willingness to test a small order",
    ],
    successCondition:
      "Rep introduces value clearly, asks about the store, identifies a low-risk first order, and asks for a test commitment.",
    replies: [
      "I already have distributors. Why should I add another one?",
      "What do you carry that would actually help my store?",
      "I might consider a small test order, but I’m not switching everything.",
      "How do I know this will be worth my time?",
      "Give me one simple order that proves the value.",
    ],
  },

  "dormant-dealer": {
    opener:
      "We used to order, but honestly we haven’t heard much from you lately.",
    hiddenNeed:
      "May return if the rep acknowledges the gap, rebuilds trust, and offers a useful reason to reengage.",
    budget: "$1,000–$3,500",
    likelyObjections: ["trust", "follow-up", "previous experience"],
    buyingSignals: [
      "Mentions past ordering",
      "Explains why they stopped",
      "Asks what has changed",
    ],
    successCondition:
      "Rep acknowledges the lapse, asks what changed, identifies a fresh need, and proposes a practical restart order.",
    replies: [
      "Last time, follow-up was not great.",
      "What has changed since we last ordered?",
      "I do not want to restart unless there is a good reason.",
      "What would you suggest for a low-risk reorder?",
      "Okay, show me what a restart order looks like.",
    ],
  },

  "angry-customer": {
    opener:
      "I’m frustrated. The last order did not go the way I expected, so I’m not interested in another sales pitch.",
    hiddenNeed:
      "Needs the rep to listen, take responsibility, clarify the issue, and restore confidence before discussing a new order.",
    budget: "Unknown until trust is restored",
    likelyObjections: ["trust", "service issue", "frustration"],
    buyingSignals: [
      "Explains what went wrong",
      "Softens tone after being heard",
      "Asks what can be done differently",
    ],
    successCondition:
      "Rep de-escalates, listens carefully, apologizes where appropriate, asks clarifying questions, and only then suggests a next step.",
    replies: [
      "I do not want excuses. I want to know someone is actually listening.",
      "The problem was not just the product. It was the lack of communication.",
      "What are you going to do differently this time?",
      "I might be open to talking, but I’m not placing a big order today.",
      "Give me a small next step that rebuilds confidence.",
    ],
  },

  "indecisive-buyer": {
    opener:
      "Honestly, I keep going back and forth on this. What do you think I should do?",
    hiddenNeed:
      "Wants the rep to lead with one clear recommendation, not a menu. Will commit if the rep is confident and ties the choice to a specific business reason.",
    budget: "$1,500–$3,000",
    likelyObjections: [
      "analysis paralysis",
      "fear of wrong choice",
      "too many options",
    ],
    buyingSignals: [
      "Asks the rep to choose for them",
      "Asks what other dealers are doing",
      "Echoes back the rep’s confidence",
    ],
    successCondition:
      "Rep avoids stacking options, makes one specific recommendation backed by a clear reason (turn rate, margin, demand), and asks for the commitment directly.",
    replies: [
      "I’m not sure. What would you do in my shoes?",
      "There are too many options. Just tell me which one.",
      "If I pick wrong, I’m stuck with dead inventory.",
      "What are other stores like mine doing?",
      "Okay, I trust you on this. Build it.",
    ],
  },

  "defer-to-partner": {
    opener:
      "I like what I’m hearing, but I’ll need to run this by my partner before I commit to anything.",
    hiddenNeed:
      "‘Checking with my partner’ is often a stall. Needs the rep to surface the real decision-maker early and either loop them in now or lock in a firm, specific follow-up before the call ends.",
    budget: "$2,000–$4,000",
    likelyObjections: [
      "absent decision-maker",
      "need to check first",
      "soft commitment",
    ],
    buyingSignals: [
      "Mentions partner / spouse / manager early",
      "Asks the rep to send details for later review",
      "Softens when the rep includes the partner in the plan",
    ],
    successCondition:
      "Rep identifies who else needs to weigh in, loops them in by phone/email or sets a specific follow-up day and time, and leaves the call with a concrete next step rather than ‘think about it.’",
    replies: [
      "I’ll need to talk this over with my partner first.",
      "Can you send me the details so I can show my manager?",
      "My business partner handles the inventory side. I’d hate to commit without him.",
      "Let me think about it and get back to you next week.",
      "Okay, but I’m not putting this through until I check with them.",
    ],
  },

  "ffl-compliance-dealer": {
    opener:
      "Before we get into product, I want to know how you handle compliance. My last ATF audit was rough and I had a distributor that did not have their paperwork tight.",
    hiddenNeed:
      "Needs reassurance that the distributor’s compliance is solid — 4473 handling on transfers, eForm 3 turnaround, serialized inventory tracking — before any product conversation. Once compliance fears are addressed, becomes a high-value, repeat buyer.",
    budget: "$3,000–$6,000",
    likelyObjections: [
      "compliance risk",
      "paperwork errors",
      "audit history",
      "transfer delays",
    ],
    buyingSignals: [
      "Asks about compliance contacts or process",
      "Mentions past audit findings",
      "Asks for documentation in writing",
    ],
    successCondition:
      "Rep demonstrates real working knowledge of FFL transfers, ATF requirements, and the distributor’s compliance backbone, then ties product recommendations to clean, well-documented SKUs and a smooth transfer process.",
    replies: [
      "Walk me through how your eForm 3 transfers work. How fast are they usually processed?",
      "I do not want serialized inventory showing up without a clean paper trail.",
      "My last distributor missed a detail on a 4473 and I caught hell from ATF. What do you do differently?",
      "Is there a real compliance contact I can call if something goes sideways?",
      "Okay, if compliance is solid, then let’s talk product.",
    ],
  },

  "loyal-to-competitor": {
    opener:
      "I’ve been with my current distributor for twelve years. They take care of me. What could you possibly offer that they don’t?",
    hiddenNeed:
      "The loyalty is mostly inertia plus a few dependable contacts. Needs the rep to surface a specific weakness — a stockout, a slow ship, a missing SKU, a rep turnover — and offer a low-risk way to test Orion on that gap, without bashing the competitor.",
    budget: "$1,500–$3,500 test order if a real wedge is found",
    likelyObjections: [
      "existing relationship",
      "inertia",
      "no reason to switch",
    ],
    buyingSignals: [
      "Mentions a recent stockout or backorder from current distributor",
      "Complains about a rep change or service drop-off",
      "Asks about a SKU the competitor does not carry",
    ],
    successCondition:
      "Rep asks open-ended discovery questions, surfaces a specific weakness at the competitor, offers a small low-risk test order around that gap, and does not attack the competitor directly.",
    replies: [
      "Why would I move my business? They have not given me a reason to leave.",
      "Their rep knows my store inside and out. You do not.",
      "Last time I tried a second distributor, I just had more paperwork to deal with.",
      "What do you carry that they don’t?",
      "Okay, I’ll try one small order on a SKU they kept backordering. Prove yourselves.",
    ],
  },
};

export function getScenario(customerType) {
  return (
    customerScenarios[customerType] ||
    customerScenarios["skeptical-store-owner"]
  );
}