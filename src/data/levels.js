export const aeLevels = [
  {
    id: 1,
    levelNumber: 1,
    name: "Transactional / Foundation AE",
    shortName: "Foundation AE",
    objective:
      "Build confidence, accuracy, and speed while learning how dealers buy and how the business works.",
    dealerExperience:
      "Responsive, reliable, knowledgeable on products and availability.",
    keyVerbiage: [
      "Let me make sure I have this exactly right for you.",
      "Here’s what’s available right now that fits what you’re looking for.",
      "I can get this moving for you today.",
    ],
    coreQuestions: [
      "What are you looking to restock today?",
      "Is this for immediate sell-through or inventory on hand?",
      "Do you need this shipped right away?",
    ],
    avoid: [
      "Guessing on availability or pricing",
      "Overreaching into strategy too early",
    ],
    unlockedReward: "Base commission structure",
  },
  {
    id: 2,
    levelNumber: 2,
    name: "Account Aware AE",
    shortName: "Account-Aware AE",
    objective:
      "Move from order-taking to pattern recognition and credibility.",
    dealerExperience:
      "Organized, prepared, understands buying patterns.",
    keyVerbiage: [
      "I was reviewing your last few orders and noticed a pattern…",
      "I want to support how you actually sell, not just fill carts.",
    ],
    coreQuestions: [
      "What categories are moving best right now?",
      "What has slowed down?",
      "Who else weighs in on buying decisions?",
    ],
    avoid: ["Just checking in", "Let me know if you need anything"],
    unlockedReward: "+0.01% commission boost",
  },
  {
    id: 3,
    levelNumber: 3,
    name: "Growth-Driven AE",
    shortName: "Growth AE",
    objective:
      "Drive planned account growth and dealer commitments.",
    dealerExperience:
      "Brings ideas and growth strategies.",
    keyVerbiage: [
      "I mapped out where we can grow this account.",
      "To avoid a mid-cycle reorder, this needs to be closer to ___.",
      "If I can support you on availability here, are you comfortable committing to this level?",
    ],
    coreQuestions: [
      "What do you want this store to be known for?",
      "What categories do you want to grow?",
      "If I support consistency, would you commit to X?",
    ],
    avoid: ["Corporate needs this moved"],
    unlockedReward: "+0.02% commission boost",
  },
  {
    id: 4,
    levelNumber: 4,
    name: "Strategic Account AE",
    shortName: "Strategic AE",
    objective:
      "Co-plan business and lock predictability.",
    dealerExperience:
      "Thinks like a business partner.",
    keyVerbiage: [
      "Let’s treat this like a business review.",
      "Here’s what worked and what didn’t.",
    ],
    coreQuestions: [
      "What’s changing in your business this quarter?",
      "So we’re aligned, this is what I’m planning for on my side.",
      "What keeps you loyal to a partner?",
    ],
    avoid: ["That’s just how allocations work"],
    unlockedReward: "+0.03% commission boost",
  },
  {
    id: 5,
    levelNumber: 5,
    name: "Key Account / Partner AE",
    shortName: "Partner AE",
    objective:
      "Strategic alignment and long-term growth.",
    dealerExperience:
      "Embedded in dealer planning.",
    keyVerbiage: [
      "Here’s what I’m committing to.",
      "Let’s lock expectations so no one is guessing.",
    ],
    coreQuestions: [
      "Where are you investing capital this year?",
      "What would make us your primary partner?",
      "What would cause you to shift spend?",
    ],
    avoid: ["I’ll see what I can do"],
    unlockedReward: "+0.05% commission boost",
  },
];

export const advancementPaths = [
  {
    fromLevel: 1,
    toLevel: 2,
    label: "Foundation AE → Account-Aware AE",
    progressPercent: 82,
    requirements: [
      { text: "I consistently execute clean, accurate orders with minimal errors", complete: true },
      { text: "I understand core SKUs, fast movers, and allocation vs standard inventory", complete: true },
      { text: "I confidently navigate pricing, availability, and internal systems", complete: true },
      { text: "Dealers trust me to get orders right and follow through", complete: true },
      { text: "I ask clarifying questions beyond just taking the order", complete: true },
      { text: "I can explain why a dealer buys certain products repeatedly", complete: true },
      { text: "I reference prior orders at least occasionally during conversations", complete: true },
      { text: "I maintain organized CRM notes for every meaningful interaction", complete: true },
      { text: "I no longer rely solely on scripts to run calls", complete: false },
    ],
  },
  {
    fromLevel: 2,
    toLevel: 3,
    label: "Account-Aware AE → Growth-Driven AE",
    progressPercent: 72,
    requirements: [
      { text: "My accounts are segmented (A/B/C) and kept current", complete: true },
      { text: "I can explain buying patterns for my top 20 accounts", complete: true },
      { text: "I proactively reference order history in dealer conversations", complete: true },
      { text: "I consistently ask why behind dealer buying decisions", complete: true },
      { text: "I know who the true buyer is for each top account", complete: true },
      { text: "I identify at least one category gap per top account", complete: false },
      { text: "I document next actions for priority accounts", complete: true },
      { text: "Dealers acknowledge insights I bring to their buying behavior", complete: false },
      { text: "I am no longer relying on inbound or order-taking alone", complete: false },
    ],
  },
  {
    fromLevel: 3,
    toLevel: 4,
    label: "Growth AE → Strategic AE",
    progressPercent: 48,
    requirements: [
      { text: "I maintain monthly account plans for my top 10 accounts", complete: false },
      { text: "Each top account has a revenue target and growth strategy", complete: false },
      { text: "I drive specific dealer commitments (not vague interest)", complete: true },
      { text: "I trade allocation access for consistent buying behavior", complete: false },
      { text: "I expand product mix intentionally, not opportunistically", complete: true },
      { text: "I can forecast my month with improving accuracy", complete: false },
      { text: "I document wins, losses, and causes—not excuses", complete: true },
      { text: "Dealers ask for my input on what to buy", complete: false },
      { text: "My top accounts show sustained month-over-month growth", complete: false },
    ],
  },
  {
    fromLevel: 4,
    toLevel: 5,
    label: "Strategic AE → Partner AE",
    progressPercent: 22,
    requirements: [
      { text: "I conduct regular QBR-style conversations with top accounts", complete: false },
      { text: "I align dealer growth plans with manufacturer initiatives", complete: false },
      { text: "I protect and defend key accounts from competitors", complete: false },
      { text: "I have documented retention and expansion strategies", complete: false },
      { text: "I influence dealer buying behavior long-term", complete: true },
      { text: "I mentor other AEs and share repeatable best practices", complete: false },
      { text: "I create playbooks or tools that help the broader team", complete: false },
      { text: "Leadership trusts me with the most valuable relationships", complete: true },
      { text: "My top accounts view me as a planning partner, not a vendor", complete: false },
    ],
  },
];

export const currentRepSnapshot = {
  currentLevel: 2,
  nextLevel: 3,
  currentTitle: "Account-Aware AE",
  nextTitle: "Growth-Driven AE",
  commissionBoost: "+0.01%",
  nextReward: "+0.02% commission boost",
  simulationScore: 82,
  crmCompliance: 95,
  growthMissionsCompleted: 7,
  growthMissionsRequired: 10,
};