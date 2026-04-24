export const scoringCategories = {
  discovery: {
    label: "Discovery",
    weight: 25,
    description:
      "Measures whether the rep uncovered the customer’s real business need before pitching.",
    excellent: [
      "Asked open-ended questions",
      "Identified customer goals, urgency, budget, and constraints",
      "Listened before recommending",
      "Clarified what success looks like for the customer",
    ],
    weak: [
      "Started pitching too early",
      "Asked only yes/no questions",
      "Missed buying signals",
      "Did not uncover budget, urgency, or product need",
    ],
  },

  orderBuilding: {
    label: "Order Building",
    weight: 25,
    description:
      "Measures whether the rep built a logical, useful order tied to the customer’s needs.",
    excellent: [
      "Recommended specific products or categories",
      "Connected items to the customer’s selling opportunity",
      "Balanced core products with add-ons",
      "Avoided overloading or underbuilding the order",
    ],
    weak: [
      "Did not recommend specific items",
      "Added products without rationale",
      "Failed to connect order to customer need",
      "Missed add-on or bundle opportunities",
    ],
  },

  objectionHandling: {
    label: "Objection Handling",
    weight: 25,
    description:
      "Measures how well the rep handled hesitation, resistance, or customer concerns.",
    excellent: [
      "Acknowledged the concern",
      "Reframed value without sounding defensive",
      "Handled price, shipping, trust, timing, or competitor concerns",
      "Moved the conversation forward confidently",
    ],
    weak: [
      "Ignored the objection",
      "Discounted too quickly",
      "Became defensive",
      "Failed to confirm the customer felt heard",
    ],
  },

  closing: {
    label: "Closing",
    weight: 25,
    description:
      "Measures whether the rep earned commitment or created a clear next step.",
    excellent: [
      "Recapped the recommended order",
      "Confirmed value and fit",
      "Asked for the order or next step",
      "Created clear forward momentum",
    ],
    weak: [
      "Ended without asking for commitment",
      "Did not summarize the value",
      "Left next steps unclear",
      "Failed to confirm the customer’s agreement",
    ],
  },
};

export const overallScoringGuidance = {
  excellent: "90–100: Strong sales execution. Rep demonstrated control, discovery, value creation, and a clear close.",
  good: "75–89: Solid call with some missed opportunities. Rep showed useful sales behavior but could sharpen discovery, objection handling, or closing.",
  developing: "60–74: Mixed performance. Rep participated but relied too much on generic selling or incomplete order logic.",
  needsWork: "40–59: Weak sales execution. Rep missed important customer signals, did not build enough value, or failed to guide the call.",
  poor: "0–39: Call lacked structure. Rep did not uncover needs, handle objections, or move toward an order.",
};

export const coachingPromptAddOn = `
Use this rubric when scoring the sales simulation.

Discovery:
- Score high when the rep asks open-ended questions, identifies need, budget, urgency, customer type, and desired outcome.
- Score low when the rep pitches before understanding the buyer.

Order Building:
- Score high when the rep recommends a specific, logical order tied to the customer scenario.
- Score low when the rep adds random items or fails to build an order.

Objection Handling:
- Score high when the rep acknowledges objections, reframes value, and moves forward.
- Score low when the rep ignores concerns, becomes defensive, or discounts without reason.

Closing:
- Score high when the rep recaps the recommendation and asks for commitment or a clear next step.
- Score low when the call ends without a close.
`;