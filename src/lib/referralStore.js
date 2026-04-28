const REFERRAL_KEY = "sales-simulator-orion-referrals-v1";

const DEMO_REFERRALS = [
  {
    id: "ref-demo-1",
    submittedBy: "JamesF@Orionwholesaleonline.com",
    submittedByName: "James Ferguson",
    submittedAt: "2026-04-10T09:00:00Z",
    candidateName: "Derek Paulson",
    candidateEmail: "dpaulson@gmail.com",
    candidatePhone: "812-555-0144",
    relationship: "Former colleague",
    positionInterest: "Sales Executive",
    status: "completed_90",
    startedAt: "2026-04-21T00:00:00Z",
    ninetyDayAt: "2026-04-28T00:00:00Z",
  },
  {
    id: "ref-demo-2",
    submittedBy: "TimH@orionwholesaleonline.com",
    submittedByName: "Tim Hardin",
    submittedAt: "2026-04-18T14:00:00Z",
    candidateName: "Kayla Morrow",
    candidateEmail: "kayla.morrow@outlook.com",
    candidatePhone: "502-555-0287",
    relationship: "Friend",
    positionInterest: "Sales Executive",
    status: "started",
    startedAt: "2026-04-25T00:00:00Z",
    ninetyDayAt: null,
  },
  {
    id: "ref-demo-3",
    submittedBy: "AlannaH@orionwholesaleonline.com",
    submittedByName: "Alanna Holland",
    submittedAt: "2026-04-26T11:30:00Z",
    candidateName: "Marcus Webb",
    candidateEmail: "marcwebb@gmail.com",
    candidatePhone: "317-555-0391",
    relationship: "Former teammate",
    positionInterest: "Sales Manager",
    status: "submitted",
    startedAt: null,
    ninetyDayAt: null,
  },
];

export const REFERRAL_BONUSES = { start: 100, ninetyDay: 150 };

export const STATUS_LABELS = {
  submitted:    { label: "Submitted",        color: "#97a3c6" },
  started:      { label: "Employee Started", color: "#3ddc97" },
  completed_90: { label: "90-Day Complete",  color: "#c9a84c" },
};

export function loadReferrals() {
  try {
    const raw = localStorage.getItem(REFERRAL_KEY);
    if (!raw) return { referrals: [...DEMO_REFERRALS] };
    return JSON.parse(raw);
  } catch {
    return { referrals: [...DEMO_REFERRALS] };
  }
}

export function saveReferrals(data) {
  try {
    localStorage.setItem(REFERRAL_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save referrals:", err);
  }
}

export function createReferral({ submittedBy, submittedByName, candidateName, candidateEmail, candidatePhone, relationship, positionInterest }) {
  const data = loadReferrals();
  const referral = {
    id: "ref-" + Date.now().toString(36),
    submittedBy,
    submittedByName,
    submittedAt: new Date().toISOString(),
    candidateName,
    candidateEmail: candidateEmail || "",
    candidatePhone: candidatePhone || "",
    relationship: relationship || "",
    positionInterest: positionInterest || "Sales Executive",
    status: "submitted",
    startedAt: null,
    ninetyDayAt: null,
  };
  data.referrals.unshift(referral);
  saveReferrals(data);
  return referral;
}

export function advanceReferralStatus(id) {
  const data = loadReferrals();
  const ref = data.referrals.find((r) => r.id === id);
  if (!ref) return null;
  if (ref.status === "submitted") {
    ref.status = "started";
    ref.startedAt = new Date().toISOString();
  } else if (ref.status === "started") {
    ref.status = "completed_90";
    ref.ninetyDayAt = new Date().toISOString();
  }
  saveReferrals(data);
  return ref;
}

export function getReferralsByEmail(email) {
  const { referrals } = loadReferrals();
  return referrals.filter((r) => r.submittedBy.toLowerCase() === email.toLowerCase());
}

export function calcPendingBonuses(referrals) {
  return referrals.reduce((sum, r) => {
    if (r.status === "started") return sum + REFERRAL_BONUSES.start;
    if (r.status === "completed_90") return sum + REFERRAL_BONUSES.start + REFERRAL_BONUSES.ninetyDay;
    return sum;
  }, 0);
}
