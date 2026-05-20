import { supabase } from "./supabaseClient";

const TABLE = "FFL_holders";

/**
 * ATF FFL License Type reference.
 *
 * For Orion (firearms wholesaler), Type 01 (Dealer) is the
 * primary prospect target. Type 02 (Pawnbroker) and 07 (Manufacturer)
 * are secondary.
 */
export const FFL_LICENSE_TYPES = [
  { code: "01", label: "01 — Dealer in Firearms" },
  { code: "02", label: "02 — Pawnbroker" },
  { code: "03", label: "03 — Collector of Curios and Relics" },
  { code: "06", label: "06 — Ammunition Manufacturer" },
  { code: "07", label: "07 — Firearms Manufacturer" },
  { code: "08", label: "08 — Firearms Importer" },
  { code: "09", label: "09 — Dealer in Destructive Devices" },
  { code: "10", label: "10 — Manufacturer of Destructive Devices" },
  { code: "11", label: "11 — Importer of Destructive Devices" },
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","VI","GU",
];

/**
 * Normalize a raw Supabase row into the shape the UI uses.
 *
 * The ATF CSV column names are uppercase; Supabase typically
 * stores them lowercased after CSV import. We try both.
 */
function normalizeFFLRow(row) {
  const get = (key) =>
    row[key] ??
    row[key.toUpperCase()] ??
    row[key.toLowerCase()] ??
    "";

  const zip = get("PREMISE_ZIP_CODE");
  const mailZip = get("MAIL_ZIP_CODE");

  return {
    id:
      get("id") ||
      `${get("LIC_REGN")}-${get("LIC_DIST")}-${get("LIC_CNTY")}-${get("LIC_TYPE")}-${get("LIC_SEQN")}`,
    licenseRegion: get("LIC_REGN"),
    licenseDistrict: get("LIC_DIST"),
    licenseCounty: get("LIC_CNTY"),
    licenseType: String(get("LIC_TYPE") || "").padStart(2, "0"),
    licenseSequence: get("LIC_SEQN"),
    licenseExpiration: get("LIC_XPRDTE"),
    licenseeName: get("LICENSE_NAME"),
    businessName: get("BUSINESS_NAME") || get("LICENSE_NAME"),
    premiseStreet: get("PREMISE_STREET"),
    premiseCity: get("PREMISE_CITY"),
    premiseState: get("PREMISE_STATE"),
    premiseZip: zip ? String(zip).padStart(5, "0") : "",
    mailStreet: get("MAIL_STREET"),
    mailCity: get("MAIL_CITY"),
    mailState: get("MAIL_STATE"),
    mailZip: mailZip ? String(mailZip).padStart(5, "0") : "",
    phone: formatPhone(get("VOICE_PHONE")),
    raw: row,
  };
}

function formatPhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(raw);
}

/**
 * Search the FFL table with optional filters.
 *
 * @param {Object} opts
 * @param {string} [opts.state]         - 2-letter state code
 * @param {string} [opts.query]         - Business name fuzzy match
 * @param {string} [opts.city]          - City exact-ish match
 * @param {string} [opts.licenseType]   - "01", "02", etc.
 * @param {number} [opts.limit=50]
 * @param {number} [opts.offset=0]
 */
export async function searchFFL({
  state,
  query,
  city,
  licenseType,
  limit = 50,
  offset = 0,
} = {}) {
  let req = supabase
    .from(TABLE)
    .select("*", { count: "exact" })
    .range(offset, offset + limit - 1)
    .order("BUSINESS_NAME", { ascending: true });

  if (state) req = req.eq("PREMISE_STATE", state);
  if (city) req = req.ilike("PREMISE_CITY", `%${city}%`);
  if (licenseType) req = req.eq("LIC_TYPE", Number(licenseType));
  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    req = req.or(`BUSINESS_NAME.ilike.${q},LICENSE_NAME.ilike.${q}`);
  }

  const { data, count, error } = await req;

  if (error) {
    return { rows: [], total: 0, error: error.message || String(error) };
  }

  return {
    rows: (data || []).map(normalizeFFLRow),
    total: count ?? data?.length ?? 0,
    error: null,
  };
}

/**
 * Total FFL count for an at-a-glance hero stat.
 */
export async function getTotalFFLCount() {
  const { count, error } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true });

  if (error) return { count: 0, error: error.message || String(error) };
  return { count: count ?? 0, error: null };
}

/**
 * Counts grouped by state for a small map / dashboard.
 *
 * NOTE: Supabase doesn't expose group-by aggregations through
 * the rest client. We fetch counts state-by-state via parallel
 * `head: true` requests. Limited to a handful of states for
 * the demo.
 */
export async function getStateCounts(stateList) {
  const results = await Promise.all(
    stateList.map(async (st) => {
      const { count, error } = await supabase
        .from(TABLE)
        .select("*", { count: "exact", head: true })
        .eq("PREMISE_STATE", st);

      return { state: st, count: error ? 0 : count ?? 0, error };
    })
  );

  return results;
}

/**
 * Map an FFL row into the existing Account shape used by accountStore.
 */
export function fflToAccount(ffl, { assignedRepCode = null, monthlyTarget = 0 } = {}) {
  const dealerName = (ffl.businessName || ffl.licenseeName || "FFL Dealer").trim();
  const contact = (ffl.licenseeName || "").trim();

  return {
    id: `ffl-${ffl.id}`,
    dealerName,
    primaryBuyer: contact,
    secondaryContact: "",
    primaryBuyingCategories: [],
    lastMonthSales: 0,
    currentMonthTarget: monthlyTarget,
    growthGap: monthlyTarget,
    howWeGetThere: "Newly imported FFL prospect — needs discovery call.",
    month: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    revenueTarget: monthlyTarget,
    plannedOrderFrequency: "TBD",
    categoryToExpand: "Discovery",
    skuFocus: [],
    dealerCommitment: "",
    aeActionRequired: "Run discovery call and qualify category fit",
    statusLabel: "Prospect",
    statusTone: "neutral",
    barrier: "Cold prospect — no relationship yet",
    expectedCloseDate: "",
    allocationTrade: "",
    nextFollowUpDate: "",
    complianceStatus: "Pending",
    notes: [
      `FFL Type ${ffl.licenseType}`,
      `License: ${ffl.licenseRegion}-${ffl.licenseDistrict}-${ffl.licenseCounty}-${ffl.licenseType}-${ffl.licenseSequence}`,
      ffl.licenseExpiration ? `Expires: ${ffl.licenseExpiration}` : "",
      ffl.premiseStreet
        ? `${ffl.premiseStreet}, ${ffl.premiseCity}, ${ffl.premiseState} ${ffl.premiseZip}`
        : "",
      ffl.phone ? `Phone: ${ffl.phone}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    progressPercent: 0,
    assignedRep: assignedRepCode,
    territory: ffl.premiseState,
    phone: ffl.phone,
    email: "",
    location: `${ffl.premiseCity}, ${ffl.premiseState}`,
    source: "FFL Prospect Hub",
  };
}
