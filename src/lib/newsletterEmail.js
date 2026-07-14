// Builds an email-safe HTML version of the Orion Insider newsletter.
//
// The on-screen newsletter (components/NewsletterContent.jsx) is styled with
// Tailwind classes and fl/grid layout — email clients strip both, so it can't
// be pasted into Gmail/Outlook as-is. This module reproduces the same sections
// using the rules email clients actually respect: table layout, inline styles,
// and web-safe fonts. The output is meant to be copied to the clipboard and
// pasted into a compose window.

const AMBER = "#f59e0b";
const AMBER_DARK = "#b45309";
const INK = "#020617"; // slate-950
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748b";
const SLATE_400 = "#94a3b8";
const SLATE_200 = "#e2e8f0";
const SLATE_50 = "#f8fafc";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Escape user-entered text so it can't break the surrounding markup.
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Format an ISO date (YYYY-MM-DD) as "Month Day" without constructing a Date,
// which would shift the day across time zones. Mirrors NewsletterContent.
function formatMonthDay(iso) {
  if (!iso) return "";
  const [, m, d] = String(iso).split("-").map(Number);
  if (!m || !d) return esc(iso);
  return `${MONTHS[m - 1]} ${d}`;
}

// Section kicker + headline + amber rule, matching the on-screen design.
function heading(kicker, title) {
  return `
    <p style="margin:0;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:3px;color:${AMBER_DARK};">${esc(kicker)}</p>
    <h2 style="margin:6px 0 0;font:800 24px/1.2 ${FONT};color:${INK};">${esc(title)}</h2>
    <div style="width:48px;height:2px;background:${AMBER};margin:12px 0 20px;"></div>`;
}

// A standard padded section wrapped in a full-width row with a bottom border.
function section(inner, { dark = false } = {}) {
  const bg = dark ? INK : "#ffffff";
  return `
    <tr>
      <td style="padding:32px 40px;background:${bg};border-bottom:1px solid ${SLATE_200};">
        ${inner}
      </td>
    </tr>`;
}

function card(inner) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${SLATE_200};border-radius:8px;background:${SLATE_50};"><tr><td style="padding:20px 24px;">${inner}</td></tr></table>`;
}

function buildUpdates(updates) {
  // Optional section — omitted entirely when there's nothing to report.
  if (!updates.length) return "";
  const body = updates
    .map((u) =>
      card(`
            <p style="margin:0;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:1px;color:${AMBER_DARK};">${esc(u.category)}</p>
            <h3 style="margin:6px 0 0;font:700 18px/1.3 ${FONT};color:${INK};">${esc(u.title)}</h3>
            <p style="margin:8px 0 0;font:400 15px/1.6 ${FONT};color:${SLATE_600};">${esc(u.description)}</p>`)
    )
    .join("");
  return section(heading("The Latest", "Company Updates") + body);
}

function buildReviews(reviews) {
  // Optional section — omitted entirely when there are no reviews.
  if (!reviews.length) return "";
  const body = reviews
        .map((r) => {
          const rating = r.rating || 5;
          const critical = rating <= 3;
          const accent = critical ? SLATE_400 : AMBER;
          const stars =
            "★".repeat(rating) +
            `<span style="color:${SLATE_200};">${"★".repeat(Math.max(0, 5 - rating))}</span>`;
          const response = r.response
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;border-left:2px solid ${AMBER};background:#ffffff;border-radius:4px;"><tr><td style="padding:10px 16px;">
                 <p style="margin:0;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:1px;color:${AMBER_DARK};">Our response</p>
                 <p style="margin:4px 0 0;font:400 14px/1.6 ${FONT};color:${SLATE_600};">${esc(r.response)}</p>
               </td></tr></table>`
            : "";
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-left:4px solid ${accent};background:${SLATE_50};border-radius:6px;"><tr><td style="padding:18px 22px;">
            <p style="margin:0;font:400 14px/1.4 ${FONT};color:${critical ? SLATE_500 : AMBER};letter-spacing:1px;">${stars}</p>
            <p style="margin:12px 0 0;font:italic 400 17px/1.6 ${FONT};color:${SLATE_700};">&ldquo;${esc(r.review_text)}&rdquo;</p>
            <p style="margin:12px 0 0;font:500 14px/1.4 ${FONT};color:${SLATE_500};">${esc(r.reviewer_name || "Customer")} · via ${esc(r.source)}</p>
            ${response}
          </td></tr></table>`;
        })
    .join("");
  return section(heading("In Their Words", "Reviews") + body);
}

function peopleList(people, renderMeta) {
  if (!people.length) return "";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    people
      .map(
        (p) => `<tr><td style="padding:4px 0;font:400 15px/1.5 ${FONT};color:${SLATE_700};">
          <strong style="color:${INK};">${esc(p.name)}</strong>${renderMeta(p)}
        </td></tr>`
      )
      .join("") +
    `</table>`
  );
}

function buildHires(newHires, departments) {
  const blocks = departments
    .map((dept) => {
      const inDept = newHires.filter((h) => h.department === dept);
      const inner = inDept.length
        ? peopleList(inDept, (h) => {
            const title = h.title
              ? `<span style="color:${SLATE_600};"> — ${esc(h.title)}</span>`
              : "";
            const start = h.start_date
              ? `<br><span style="font-size:13px;color:${SLATE_400};">Started ${esc(h.start_date)}</span>`
              : "";
            return `${title}${start}`;
          })
        : `<p style="margin:0;font:400 14px/1.5 ${FONT};color:${SLATE_400};">No new ${esc(dept)} hires this issue.</p>`;
      return card(
        `<h3 style="margin:0 0 8px;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:1px;color:${SLATE_500};">${esc(dept)}</h3>${inner}`
      );
    })
    .join("");
  return section(heading("Welcome Aboard", "New Team Members") + blocks);
}

function buildCelebrations(birthdays, anniversaries) {
  const bdayInner = birthdays.length
    ? peopleList(birthdays, (p) => {
        const dept = p.department
          ? `<span style="color:${SLATE_500};"> · ${esc(p.department)}</span>`
          : "";
        const date = p.date
          ? `<br><span style="font-size:13px;color:${SLATE_400};">${formatMonthDay(p.date)}</span>`
          : "";
        return `${dept}${date}`;
      })
    : `<p style="margin:0;font:400 14px/1.5 ${FONT};color:${SLATE_400};">No birthdays this issue.</p>`;

  const annInner = anniversaries.length
    ? peopleList(anniversaries, (p) => {
        const dept = p.department
          ? `<span style="color:${SLATE_500};"> · ${esc(p.department)}</span>`
          : "";
        const yrs = p.years
          ? `<br><span style="font-size:13px;color:${AMBER_DARK};">${esc(p.years)} ${Number(p.years) === 1 ? "year" : "years"}${p.start_date ? `<span style="color:${SLATE_400};"> · since ${esc(p.start_date)}</span>` : ""}</span>`
          : "";
        return `${dept}${yrs}`;
      })
    : `<p style="margin:0;font:400 14px/1.5 ${FONT};color:${SLATE_400};">No work anniversaries this issue.</p>`;

  const body =
    card(
      `<h3 style="margin:0 0 8px;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:1px;color:${SLATE_500};">🎂 Birthdays</h3>${bdayInner}`
    ) +
    card(
      `<h3 style="margin:0 0 8px;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:1px;color:${SLATE_500};">🎉 Work Anniversaries</h3>${annInner}`
    );
  return section(heading("Celebrations", "Birthdays & Anniversaries") + body);
}

function buildShoutouts(shoutouts) {
  // Optional section — omitted entirely when there are no shout-outs.
  if (!shoutouts.length) return "";
  const body = shoutouts
    .map(
      (s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px;"><tr><td style="padding:20px 24px;">
            <h3 style="margin:0;font:700 17px/1.3 ${FONT};color:${INK};">${esc(s.employee_name)}</h3>
            <p style="margin:8px 0 0;font:400 15px/1.6 ${FONT};color:${SLATE_700};">${esc(s.shoutout_text)}</p>
            <p style="margin:12px 0 0;font:500 13px/1.4 ${FONT};color:${SLATE_500};">Submitted by ${esc(s.submitted_by || "Leadership")}</p>
          </td></tr></table>`
    )
    .join("");
  return section(heading("Recognition", "Team Shout-Outs") + body);
}

function buildReferral() {
  // Light pills: tinted background with matching dark text, so they stay
  // readable even if a client strips text colors (white-on-color would vanish).
  const pill = (bg, color, text) =>
    `<span style="display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border-radius:999px;background:${bg};color:${color};font:600 13px/1 ${FONT};">${text}</span>`;
  const inner = `
    <p style="margin:0;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:3px;color:${AMBER_DARK};">Grow The Team</p>
    <h2 style="margin:6px 0 0;font:800 26px/1.2 ${FONT};color:${INK};">Employee Referral Program</h2>
    <div style="width:48px;height:2px;background:${AMBER};margin:12px 0 18px;"></div>
    <p style="margin:0 0 16px;font:400 15px/1.6 ${FONT};color:${SLATE_600};max-width:520px;">Great people know great people. Help us build the best team in the industry by referring qualified candidates to Orion Wholesale, Taylor Customs, and our warehouse operations.</p>
    ${pill("#dcfce7", "#166534", "$100 when they start")}${pill("#fef3c7", AMBER_DARK, "$150 after 90 days")}${pill("#ede9fe", "#6d28d9", "$250 total")}
    <div style="margin-top:18px;">
      <a href="https://join-orion.com/careers" style="display:inline-block;padding:11px 22px;border-radius:8px;background:${AMBER};color:${INK};font:700 14px/1 ${FONT};text-decoration:none;">View Careers</a>
    </div>`;
  return `<tr><td style="padding:36px 40px;background:${SLATE_50};border-top:1px solid ${SLATE_200};">${inner}</td></tr>`;
}

const DEFAULT_JOKE =
  "My pipeline is like my gym membership: technically active, full of good intentions, and somehow it never converts.";

export function buildNewsletterEmailHTML({
  issueName = "Bi-Weekly Employee Newsletter",
  joke,
  updates = [],
  reviews = [],
  newHires = [],
  birthdays = [],
  anniversaries = [],
  shoutouts = [],
  departments = [],
} = {}) {
  // Light masthead: dark text on white. Email clients (notably Gmail's paste
  // sanitizer) often strip light text colors while keeping dark backgrounds,
  // which would render white-on-black text invisible — so we avoid that entirely
  // and lean on a heavy amber rule for brand presence.
  const masthead = `
    <tr>
      <td style="padding:40px 40px 32px;background:#ffffff;border-top:6px solid ${AMBER};border-bottom:1px solid ${SLATE_200};">
        <p style="margin:0;font:600 11px/1.4 ${FONT};text-transform:uppercase;letter-spacing:5px;color:${AMBER_DARK};">Orion Wholesale</p>
        <h1 style="margin:14px 0 0;font:800 40px/1.1 ${FONT};color:${INK};letter-spacing:-1px;">Orion Insider</h1>
        <p style="margin:16px 0 0;padding-top:14px;border-top:1px solid ${SLATE_200};font:400 13px/1.4 ${FONT};text-transform:uppercase;letter-spacing:2px;color:${SLATE_500};">${esc(issueName)}</p>
      </td>
    </tr>`;

  const jokeSection = section(
    heading("A Lighter Note", "From the Floor") +
      `<p style="margin:0;font:400 17px/1.6 ${FONT};color:${SLATE_700};">${esc(joke || DEFAULT_JOKE)}</p>`
  );

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;margin:0;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid ${SLATE_200};border-radius:16px;overflow:hidden;">
      ${masthead}
      ${jokeSection}
      ${buildUpdates(updates)}
      ${buildReviews(reviews)}
      ${buildHires(newHires, departments)}
      ${buildCelebrations(birthdays, anniversaries)}
      ${buildShoutouts(shoutouts)}
      ${buildReferral()}
    </table>
  </td></tr></table>`;
}

// Plain-text fallback used as the text/plain clipboard flavor (and for clients
// that ignore HTML). Keeps the joke and a link rather than a flattened layout.
export function buildNewsletterEmailText({ issueName, joke, link } = {}) {
  return [
    "Team,",
    "",
    `The latest issue of the Orion Insider — ${issueName} — is out.`,
    link ? `Read it here: ${link}` : "",
    "",
    joke || DEFAULT_JOKE,
    "",
    "— Orion Wholesale",
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}
