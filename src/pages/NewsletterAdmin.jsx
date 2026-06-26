import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { employees, getEmployeeFullName } from "../data/employees";
import NewsletterContent from "../components/NewsletterContent";
import { NEW_HIRE_DEPARTMENTS, REVIEW_SOURCES } from "../lib/newsletter";
import {
  buildNewsletterEmailHTML,
  buildNewsletterEmailText,
} from "../lib/newsletterEmail";
import Layout from "../components/layout/Layout";

// Fallback jokes used only if the newsletter_jokes table can't be reached.
const FALLBACK_JOKES = [
  "My pipeline is like my gym membership: technically active, full of good intentions, and somehow it never converts.",
  "Quota is the only houseguest that shows up on the 1st, judges everything you did last month, and never brings wine.",
  "A prospect told me he'd 'circle back.' That was 2019. I assume he's still orbiting.",
  "The fastest way to close a deal is a discount. The fastest way to end a career is explaining that discount to finance.",
  "Cold calling is just texting your ex, except the rejection is faster and you get to log it in a spreadsheet.",
  "Our forecast and a fortune cookie have a lot in common: vague, oddly confident, and best taken with a grain of salt.",
  "My manager asked where I see myself in five years. Honestly? This same call, still on hold with procurement.",
  "Wholesale is just retail for people who prefer to buy their problems in bulk.",
];

const SECTIONS = [
  { key: "setup", label: "Issue Setup" },
  { key: "review", label: "Add Review" },
  { key: "shoutout", label: "Add Shout-Out" },
  { key: "update", label: "Add Company Update" },
  { key: "hires", label: "New Hires" },
  { key: "celebrations", label: "Celebrations" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

// The in-progress issue is a "living draft": new hires, birthdays, anniversaries
// and the issue name/date are kept in localStorage so they survive a refresh and
// only clear once the issue is generated. (Reviews/shout-outs/updates already
// persist in Supabase, so they're not duplicated here.) localStorage is
// per-browser, so the draft lives on the machine it was edited from.
const DRAFT_KEY = "orion_newsletter_draft";

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage full or unavailable — draft just won't persist this session */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// The same draft, but kept in Supabase so it follows the editor from one
// computer/browser to another (localStorage above is a per-machine cache only).
// There is a single draft row, id = 'current'.
const DRAFT_ROW_ID = "current";

async function readCloudDraft() {
  try {
    const { data, error } = await supabase
      .from("newsletter_draft")
      .select("data")
      .eq("id", DRAFT_ROW_ID)
      .maybeSingle();
    if (error || !data) return null;
    return data.data || null;
  } catch {
    return null;
  }
}

async function writeCloudDraft(draft) {
  return supabase
    .from("newsletter_draft")
    .upsert({
      id: DRAFT_ROW_ID,
      data: draft,
      updated_at: new Date().toISOString(),
    });
}

async function clearCloudDraft() {
  try {
    await supabase.from("newsletter_draft").delete().eq("id", DRAFT_ROW_ID);
  } catch {
    /* ignore */
  }
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1";
const btnPrimary =
  "rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

export default function NewsletterAdmin() {
  const { session } = useAuth();

  const [activeSection, setActiveSection] = useState("setup");
  const [status, setStatus] = useState("");

  // Content pool (pulled from Supabase)
  const [reviews, setReviews] = useState([]);
  const [shoutouts, setShoutouts] = useState([]);
  const [updates, setUpdates] = useState([]);

  // Issue setup — seeded from the saved draft (if any) so a refresh doesn't
  // wipe in-progress work.
  const [issueName, setIssueName] = useState(
    () => readDraft().issueName ?? `Orion Insider — ${todayISO()}`
  );
  const [issueDate, setIssueDate] = useState(
    () => readDraft().issueDate ?? todayISO()
  );
  const [joke, setJoke] = useState(FALLBACK_JOKES[0]);

  // Joke pool from newsletter_jokes (least-used first); jokeId tracks the
  // selected joke so we can bump its usage stats when the issue is generated.
  const [jokes, setJokes] = useState([]);
  const [jokeId, setJokeId] = useState(null);

  // New hires, birthdays and anniversaries for this issue. Seeded from the
  // saved draft so they persist across refreshes until the issue is generated.
  const [newHires, setNewHires] = useState(() => readDraft().newHires ?? []);
  const [birthdays, setBirthdays] = useState(() => readDraft().birthdays ?? []);
  const [anniversaries, setAnniversaries] = useState(
    () => readDraft().anniversaries ?? []
  );

  // Tracks the shared-database draft: draftLoaded gates auto-save until we've
  // pulled the cloud copy (so we never overwrite it with stale local state on
  // load); draftStatus drives the "Saving…/Saved" indicator in the toolbar.
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");

  useEffect(() => {
    loadPool();
    loadJokes();
    // Pull the in-progress issue from the shared database so it picks up where
    // it was left off, even on a different computer. Falls back to whatever the
    // local cache already seeded above.
    (async () => {
      const cloud = await readCloudDraft();
      if (cloud) {
        if (typeof cloud.issueName === "string") setIssueName(cloud.issueName);
        if (typeof cloud.issueDate === "string") setIssueDate(cloud.issueDate);
        if (Array.isArray(cloud.newHires)) setNewHires(cloud.newHires);
        if (Array.isArray(cloud.birthdays)) setBirthdays(cloud.birthdays);
        if (Array.isArray(cloud.anniversaries))
          setAnniversaries(cloud.anniversaries);
      }
      setDraftLoaded(true);
    })();
  }, []);

  // Keep the living draft in sync with the editable issue fields. Saves to the
  // local cache immediately and to the shared database (debounced) so the issue
  // survives a refresh AND follows the editor across devices. Cleared on
  // Generate. We wait for the cloud load before pushing, so we never clobber a
  // saved draft with empty starting state.
  useEffect(() => {
    const draft = { issueName, issueDate, newHires, birthdays, anniversaries };
    saveDraft(draft);
    if (!draftLoaded) return;
    const t = setTimeout(async () => {
      setDraftStatus("Saving…");
      const { error } = await writeCloudDraft(draft);
      setDraftStatus(error ? "Save failed — check connection" : "Saved ✓");
    }, 800);
    return () => clearTimeout(t);
  }, [issueName, issueDate, newHires, birthdays, anniversaries, draftLoaded]);

  async function loadJokes() {
    const { data } = await supabase
      .from("newsletter_jokes")
      .select("*")
      .eq("active", true)
      .order("used_count", { ascending: true });
    if (data && data.length) {
      setJokes(data);
      setJoke(data[0].joke_text);
      setJokeId(data[0].id);
    }
  }

  // Jump to a random joke (never the one already showing). Prefers the live
  // table and falls back to the hardcoded list if it's empty/unreachable.
  function shuffleJoke() {
    if (jokes.length) {
      const others = jokes.filter((j) => j.id !== jokeId);
      const pool = others.length ? others : jokes;
      const next = pool[Math.floor(Math.random() * pool.length)];
      setJoke(next.joke_text);
      setJokeId(next.id);
    } else {
      const others = FALLBACK_JOKES.filter((j) => j !== joke);
      const pool = others.length ? others : FALLBACK_JOKES;
      setJoke(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  const currentJoke = jokes.find((j) => j.id === jokeId);

  async function loadPool() {
    const [{ data: r }, { data: s }, { data: u }, { data: issues }] =
      await Promise.all([
        supabase
          .from("newsletter_reviews")
          .select("*")
          .eq("approved", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("newsletter_shoutouts")
          .select("*")
          .eq("approved", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("newsletter_updates")
          .select("*")
          .eq("approved", true)
          .order("update_date", { ascending: false }),
        supabase.from("newsletter_issues").select("generated_content"),
      ]);

    // Collect IDs already published in a prior issue so each new cycle starts
    // with only the items added since the last "Generate".
    const usedReviewIds = new Set();
    const usedShoutoutIds = new Set();
    const usedUpdateIds = new Set();
    for (const issue of issues || []) {
      try {
        const snap = JSON.parse(issue.generated_content || "{}");
        (snap.reviewIds || []).forEach((id) => usedReviewIds.add(id));
        (snap.shoutoutIds || []).forEach((id) => usedShoutoutIds.add(id));
        (snap.updateIds || []).forEach((id) => usedUpdateIds.add(id));
      } catch {
        /* skip malformed snapshot */
      }
    }

    setReviews((r || []).filter((row) => !usedReviewIds.has(row.id)));
    setShoutouts((s || []).filter((row) => !usedShoutoutIds.has(row.id)));
    setUpdates((u || []).filter((row) => !usedUpdateIds.has(row.id)));
  }

  function flash(msg) {
    setStatus(msg);
    setTimeout(() => setStatus(""), 3000);
  }

  /* ---------------- Add Review ---------------- */
  const [reviewForm, setReviewForm] = useState({
    source: "Google",
    rating: 5,
    reviewer_name: "",
    review_text: "",
    response: "",
    review_date: todayISO(),
  });

  async function addReview(e) {
    e.preventDefault();
    if (!reviewForm.review_text.trim()) return flash("Review text is required.");
    const { error } = await supabase.from("newsletter_reviews").insert([
      { ...reviewForm, rating: Number(reviewForm.rating), approved: true },
    ]);
    if (error) return flash(`Error: ${error.message}`);
    setReviewForm({
      source: "Google",
      rating: 5,
      reviewer_name: "",
      review_text: "",
      response: "",
      review_date: todayISO(),
    });
    flash("Review added ✓");
    loadPool();
  }

  /* ---------------- Add Shout-Out ---------------- */
  const [shoutForm, setShoutForm] = useState({
    employee_name: "",
    department: "Sales",
    submitted_by: session?.name || "Leadership",
    shoutout_text: "",
  });

  async function addShoutout(e) {
    e.preventDefault();
    if (!shoutForm.employee_name.trim() || !shoutForm.shoutout_text.trim())
      return flash("Employee name and shout-out text are required.");
    const { error } = await supabase
      .from("newsletter_shoutouts")
      .insert([{ ...shoutForm, approved: true }]);
    if (error) return flash(`Error: ${error.message}`);
    setShoutForm({
      employee_name: "",
      department: "Sales",
      submitted_by: session?.name || "Leadership",
      shoutout_text: "",
    });
    flash("Shout-out added ✓");
    loadPool();
  }

  /* ---------------- Add / Edit Company Update ---------------- */
  const emptyUpdateForm = {
    title: "",
    description: "",
    category: "Company",
    update_date: todayISO(),
  };
  const [updateForm, setUpdateForm] = useState(emptyUpdateForm);
  // null = adding a new update; an id = editing that existing one.
  const [editingUpdateId, setEditingUpdateId] = useState(null);

  async function addUpdate(e) {
    e.preventDefault();
    if (!updateForm.title.trim() || !updateForm.description.trim())
      return flash("Title and description are required.");

    if (editingUpdateId) {
      const { error } = await supabase
        .from("newsletter_updates")
        .update({
          title: updateForm.title,
          description: updateForm.description,
          category: updateForm.category,
          update_date: updateForm.update_date,
        })
        .eq("id", editingUpdateId);
      if (error) return flash(`Error: ${error.message}`);
      flash("Update saved ✓");
    } else {
      const { error } = await supabase
        .from("newsletter_updates")
        .insert([{ ...updateForm, approved: true }]);
      if (error) return flash(`Error: ${error.message}`);
      flash("Update added ✓");
    }
    setUpdateForm(emptyUpdateForm);
    setEditingUpdateId(null);
    loadPool();
  }

  // Load an existing update into the form so it can be corrected.
  function editUpdate(u) {
    setEditingUpdateId(u.id);
    setUpdateForm({
      title: u.title || "",
      description: u.description || "",
      category: u.category || "Company",
      update_date: u.update_date || todayISO(),
    });
    setActiveSection("update");
  }

  function cancelEditUpdate() {
    setEditingUpdateId(null);
    setUpdateForm(emptyUpdateForm);
  }

  async function deleteUpdate(id) {
    const { error } = await supabase
      .from("newsletter_updates")
      .delete()
      .eq("id", id);
    if (error) return flash(`Error: ${error.message}`);
    if (editingUpdateId === id) cancelEditUpdate();
    flash("Update deleted ✓");
    loadPool();
  }

  /* ---------------- New Hires ---------------- */
  const [hireForm, setHireForm] = useState({
    name: "",
    department: "Sales",
    title: "",
    start_date: todayISO(),
  });

  // Recent roster hires, newest first, to quick-add from
  const recentRoster = useMemo(
    () =>
      [...employees]
        .filter((e) => e.hireDate)
        .sort((a, b) => (a.hireDate < b.hireDate ? 1 : -1))
        .slice(0, 12),
    []
  );

  function addHire() {
    if (!hireForm.name.trim()) return flash("New hire name is required.");
    setNewHires((prev) => [
      ...prev,
      { ...hireForm, id: `${hireForm.name}-${prev.length}` },
    ]);
    setHireForm({
      name: "",
      department: "Sales",
      title: "",
      start_date: todayISO(),
    });
  }

  function quickAddFromRoster(emp) {
    setNewHires((prev) => [
      ...prev,
      {
        id: `${emp.code}-${prev.length}`,
        name: getEmployeeFullName(emp),
        department: "Sales",
        title: "Sales Executive",
        start_date: emp.hireDate || todayISO(),
      },
    ]);
  }

  function removeHire(id) {
    setNewHires((prev) => prev.filter((h) => h.id !== id));
  }

  /* ---------------- Celebrations (birthdays + anniversaries) ---------------- */
  const [birthdayForm, setBirthdayForm] = useState({
    name: "",
    department: "Sales",
    date: todayISO(),
  });

  function addBirthday() {
    if (!birthdayForm.name.trim()) return flash("Birthday name is required.");
    setBirthdays((prev) => [
      ...prev,
      { ...birthdayForm, id: `bday-${birthdayForm.name}-${prev.length}` },
    ]);
    setBirthdayForm({ name: "", department: "Sales", date: todayISO() });
  }

  function removeBirthday(id) {
    setBirthdays((prev) => prev.filter((b) => b.id !== id));
  }

  const [anniversaryForm, setAnniversaryForm] = useState({
    name: "",
    department: "Sales",
    years: 1,
    start_date: todayISO(),
  });

  function addAnniversary() {
    if (!anniversaryForm.name.trim())
      return flash("Anniversary name is required.");
    setAnniversaries((prev) => [
      ...prev,
      {
        ...anniversaryForm,
        years: Number(anniversaryForm.years),
        id: `anniv-${anniversaryForm.name}-${prev.length}`,
      },
    ]);
    setAnniversaryForm({
      name: "",
      department: "Sales",
      years: 1,
      start_date: todayISO(),
    });
  }

  function removeAnniversary(id) {
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
  }

  // Quick-add a roster anniversary — years are derived from hire date relative
  // to the issue year so the count is correct for the cycle being published.
  function quickAddAnniversary(emp) {
    const years = emp.hireDate
      ? Number(issueDate.slice(0, 4)) - Number(emp.hireDate.slice(0, 4))
      : 0;
    setAnniversaries((prev) => [
      ...prev,
      {
        id: `anniv-${emp.code}-${prev.length}`,
        name: getEmployeeFullName(emp),
        department: "Sales",
        years,
        start_date: emp.hireDate || todayISO(),
      },
    ]);
  }

  // Reps whose hire-date anniversary falls in the issue month — the natural
  // candidates to celebrate this cycle, newest milestone first.
  const anniversaryCandidates = useMemo(() => {
    const issueMonth = issueDate.slice(5, 7);
    return [...employees]
      .filter((e) => e.hireDate && e.hireDate.slice(5, 7) === issueMonth)
      .sort((a, b) => (a.hireDate < b.hireDate ? -1 : 1));
  }, [issueDate]);

  /* ---------------- Generate (save issue snapshot) ---------------- */
  const [generating, setGenerating] = useState(false);

  async function generateIssue() {
    setGenerating(true);
    const generated_content = JSON.stringify({
      newHires,
      birthdays,
      anniversaries,
      reviewIds: reviews.map((r) => r.id),
      shoutoutIds: shoutouts.map((s) => s.id),
      updateIds: updates.map((u) => u.id),
    });
    const { error } = await supabase.from("newsletter_issues").insert([
      {
        issue_name: issueName,
        issue_date: issueDate,
        joke,
        generated_content,
      },
    ]);
    setGenerating(false);
    if (error) return flash(`Error saving issue: ${error.message}`);

    // Mark the published joke as used so rotation favors fresh ones next time.
    if (jokeId) {
      await supabase
        .from("newsletter_jokes")
        .update({
          used_count: (currentJoke?.used_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", jokeId);
    }

    flash("Issue generated & saved ✓ — live at /newsletter");
    // Items in this issue are now "published"; clear the desk (and the saved
    // draft, both local and shared) for the next cycle.
    clearDraft();
    clearCloudDraft();
    setDraftStatus("");
    setNewHires([]);
    setBirthdays([]);
    setAnniversaries([]);
    loadPool();
    loadJokes();
  }

  /* ---------------- Export PDF ---------------- */
  function exportPDF() {
    window.print();
  }

  /* ---------------- Email Distribution ---------------- */
  function emailNewsletter() {
    const recipients = employees
      .map((e) => e.email)
      .filter(Boolean)
      .join(",");
    const link = `${window.location.origin}/newsletter`;
    const subject = encodeURIComponent(issueName);
    const body = encodeURIComponent(
      `Team,\n\nThe latest issue of the Orion Insider is out. Read it here:\n${link}\n\n${joke}\n\n— Orion Wholesale`
    );
    window.location.href = `mailto:?bcc=${recipients}&subject=${subject}&body=${body}`;
  }

  // Copy an email-safe version of the newsletter to the clipboard as rich HTML
  // so it can be pasted straight into a Gmail/Outlook compose window. We write
  // both an HTML and a plain-text flavor; clients that ignore HTML get the text.
  async function copyForEmail() {
    const html = buildNewsletterEmailHTML({
      issueName,
      joke,
      updates,
      reviews,
      newHires,
      birthdays,
      anniversaries,
      shoutouts,
      departments: NEW_HIRE_DEPARTMENTS,
    });
    const text = buildNewsletterEmailText({
      issueName,
      joke,
      link: `${window.location.origin}/newsletter`,
    });
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      setStatus("Newsletter copied — paste into a Gmail/Outlook compose window.");
    } catch (err) {
      // Older browsers (or insecure origins) lack ClipboardItem; fall back to
      // copying the plain text so the action still does something useful.
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Copied as plain text — rich formatting needs Chrome/Edge/Safari.");
      } catch {
        setStatus("Couldn't access the clipboard. Try again or use Export PDF.");
      }
    }
  }

  return (
    <Layout title="Newsletter">
      {/* Toolbar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 border-b bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Newsletter Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Forms → Preview → Export / Send
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draftStatus && (
              <span
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  draftStatus.startsWith("Save failed")
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600"
                }`}
                title="Your in-progress issue is saved to the shared database and follows you across computers."
              >
                {draftStatus}
              </span>
            )}
            {status && (
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {status}
              </span>
            )}
            <button
              onClick={generateIssue}
              disabled={generating}
              className={btnPrimary}
            >
              {generating ? "Generating…" : "Generate"}
            </button>
            <button onClick={exportPDF} className={btnGhost}>
              Export PDF
            </button>
            <button onClick={copyForEmail} className={btnGhost}>
              Copy for Email
            </button>
            <button onClick={emailNewsletter} className={btnGhost}>
              Email to Employees
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[420px_1fr]">
        {/* ---------- Left: data forms ---------- */}
        <div className="no-print space-y-4">
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  activeSection === s.key
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            {/* Issue setup */}
            {activeSection === "setup" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Issue Setup</h2>
                <div>
                  <label className={labelCls}>Issue Name</label>
                  <input
                    className={inputCls}
                    value={issueName}
                    onChange={(e) => setIssueName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Issue Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Opening Joke</label>
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={joke}
                    onChange={(e) => setJoke(e.target.value)}
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={shuffleJoke}
                      className="text-sm font-semibold text-amber-600 hover:underline"
                    >
                      🎲 Shuffle joke
                    </button>
                    {currentJoke && (
                      <span className="text-xs text-slate-400">
                        {currentJoke.category} · used {currentJoke.used_count}×
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Add review */}
            {activeSection === "review" && (
              <form onSubmit={addReview} className="space-y-4">
                <h2 className="text-lg font-bold">Add Review</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Source</label>
                    <select
                      className={inputCls}
                      value={reviewForm.source}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, source: e.target.value })
                      }
                    >
                      {REVIEW_SOURCES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Rating</label>
                    <select
                      className={inputCls}
                      value={reviewForm.rating}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, rating: e.target.value })
                      }
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} ★
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Reviewer Name</label>
                  <input
                    className={inputCls}
                    value={reviewForm.reviewer_name}
                    onChange={(e) =>
                      setReviewForm({
                        ...reviewForm,
                        reviewer_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Review Text *</label>
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={reviewForm.review_text}
                    onChange={(e) =>
                      setReviewForm({
                        ...reviewForm,
                        review_text: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Leadership Response{" "}
                    <span className="font-normal text-slate-400">
                      (optional — great for critical reviews)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    className={inputCls}
                    placeholder="How we're addressing this feedback…"
                    value={reviewForm.response}
                    onChange={(e) =>
                      setReviewForm({
                        ...reviewForm,
                        response: e.target.value,
                      })
                    }
                  />
                </div>
                <button className={btnPrimary}>Add Review</button>
              </form>
            )}

            {/* Add shout-out */}
            {activeSection === "shoutout" && (
              <form onSubmit={addShoutout} className="space-y-4">
                <h2 className="text-lg font-bold">Add Shout-Out</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Employee Name *</label>
                    <input
                      className={inputCls}
                      value={shoutForm.employee_name}
                      onChange={(e) =>
                        setShoutForm({
                          ...shoutForm,
                          employee_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <select
                      className={inputCls}
                      value={shoutForm.department}
                      onChange={(e) =>
                        setShoutForm({
                          ...shoutForm,
                          department: e.target.value,
                        })
                      }
                    >
                      {NEW_HIRE_DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Submitted By</label>
                  <input
                    className={inputCls}
                    value={shoutForm.submitted_by}
                    onChange={(e) =>
                      setShoutForm({
                        ...shoutForm,
                        submitted_by: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Shout-Out Text *</label>
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={shoutForm.shoutout_text}
                    onChange={(e) =>
                      setShoutForm({
                        ...shoutForm,
                        shoutout_text: e.target.value,
                      })
                    }
                  />
                </div>
                <button className={btnPrimary}>Add Shout-Out</button>
              </form>
            )}

            {/* Add / edit company updates */}
            {activeSection === "update" && (
              <div className="space-y-4">
              <form onSubmit={addUpdate} className="space-y-4">
                <h2 className="text-lg font-bold">
                  {editingUpdateId ? "Edit Company Update" : "Add Company Update"}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Category</label>
                    <input
                      className={inputCls}
                      value={updateForm.category}
                      onChange={(e) =>
                        setUpdateForm({
                          ...updateForm,
                          category: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={updateForm.update_date}
                      onChange={(e) =>
                        setUpdateForm({
                          ...updateForm,
                          update_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Title *</label>
                  <input
                    className={inputCls}
                    value={updateForm.title}
                    onChange={(e) =>
                      setUpdateForm({ ...updateForm, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Description *</label>
                  <textarea
                    rows={3}
                    className={inputCls}
                    value={updateForm.description}
                    onChange={(e) =>
                      setUpdateForm({
                        ...updateForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className={btnPrimary}>
                    {editingUpdateId ? "Save Changes" : "Add Update"}
                  </button>
                  {editingUpdateId && (
                    <button
                      type="button"
                      onClick={cancelEditUpdate}
                      className={btnGhost}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {/* Existing updates — edit a typo or remove one entirely. */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700">
                  Updates in this issue ({updates.length})
                </h3>
                {updates.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No updates yet. Add one above and it appears here and in the
                    preview.
                  </p>
                ) : (
                  updates.map((u) => (
                    <div
                      key={u.id}
                      className={`rounded-lg border px-3 py-2 ${
                        editingUpdateId === u.id
                          ? "border-amber-400 bg-amber-50"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {u.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.category} · {u.update_date}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {u.description}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => editUpdate(u)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUpdate(u.id)}
                            className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              </div>
            )}

            {/* New hires */}
            {activeSection === "hires" && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">New Hires</h2>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Name *</label>
                    <input
                      className={inputCls}
                      value={hireForm.name}
                      onChange={(e) =>
                        setHireForm({ ...hireForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <select
                      className={inputCls}
                      value={hireForm.department}
                      onChange={(e) =>
                        setHireForm({ ...hireForm, department: e.target.value })
                      }
                    >
                      {NEW_HIRE_DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Start Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={hireForm.start_date}
                      onChange={(e) =>
                        setHireForm({ ...hireForm, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Title / Role</label>
                    <input
                      className={inputCls}
                      value={hireForm.title}
                      onChange={(e) =>
                        setHireForm({ ...hireForm, title: e.target.value })
                      }
                    />
                  </div>
                </div>
                <button type="button" onClick={addHire} className={btnPrimary}>
                  Add Hire
                </button>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-600">
                    Quick-add from roster
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentRoster.map((emp) => (
                      <button
                        key={emp.code}
                        type="button"
                        onClick={() => quickAddFromRoster(emp)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        + {getEmployeeFullName(emp)}
                      </button>
                    ))}
                  </div>
                </div>

                {newHires.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-600">
                      Selected this issue ({newHires.length})
                    </p>
                    {newHires.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span>
                          {h.name}{" "}
                          <span className="text-slate-400">· {h.department}</span>
                        </span>
                        <button
                          onClick={() => removeHire(h.id)}
                          className="text-rose-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Celebrations — birthdays & anniversaries */}
            {activeSection === "celebrations" && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold">Celebrations</h2>

                {/* Birthdays */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-700">
                    🎂 Birthdays
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Name *</label>
                      <input
                        className={inputCls}
                        value={birthdayForm.name}
                        onChange={(e) =>
                          setBirthdayForm({
                            ...birthdayForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Department</label>
                      <select
                        className={inputCls}
                        value={birthdayForm.department}
                        onChange={(e) =>
                          setBirthdayForm({
                            ...birthdayForm,
                            department: e.target.value,
                          })
                        }
                      >
                        {NEW_HIRE_DEPARTMENTS.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={birthdayForm.date}
                        onChange={(e) =>
                          setBirthdayForm({
                            ...birthdayForm,
                            date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addBirthday}
                    className={btnPrimary}
                  >
                    Add Birthday
                  </button>

                  {birthdays.length > 0 && (
                    <div className="space-y-2">
                      {birthdays.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span>
                            {b.name}{" "}
                            <span className="text-slate-400">
                              · {b.department}
                            </span>
                          </span>
                          <button
                            onClick={() => removeBirthday(b.id)}
                            className="text-rose-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Work anniversaries */}
                <div className="space-y-3 border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-700">
                    🎉 Work Anniversaries
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Name *</label>
                      <input
                        className={inputCls}
                        value={anniversaryForm.name}
                        onChange={(e) =>
                          setAnniversaryForm({
                            ...anniversaryForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Years</label>
                      <input
                        type="number"
                        min={1}
                        className={inputCls}
                        value={anniversaryForm.years}
                        onChange={(e) =>
                          setAnniversaryForm({
                            ...anniversaryForm,
                            years: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Department</label>
                      <select
                        className={inputCls}
                        value={anniversaryForm.department}
                        onChange={(e) =>
                          setAnniversaryForm({
                            ...anniversaryForm,
                            department: e.target.value,
                          })
                        }
                      >
                        {NEW_HIRE_DEPARTMENTS.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Start Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={anniversaryForm.start_date}
                        onChange={(e) =>
                          setAnniversaryForm({
                            ...anniversaryForm,
                            start_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addAnniversary}
                    className={btnPrimary}
                  >
                    Add Anniversary
                  </button>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-600">
                      This month&rsquo;s roster milestones
                    </p>
                    {anniversaryCandidates.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {anniversaryCandidates.map((emp) => (
                          <button
                            key={emp.code}
                            type="button"
                            onClick={() => quickAddAnniversary(emp)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            + {getEmployeeFullName(emp)} (
                            {Number(issueDate.slice(0, 4)) -
                              Number(emp.hireDate.slice(0, 4))}
                            y)
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        No roster hire-date anniversaries in this issue&rsquo;s
                        month.
                      </p>
                    )}
                  </div>

                  {anniversaries.length > 0 && (
                    <div className="space-y-2">
                      {anniversaries.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span>
                            {a.name}{" "}
                            <span className="text-slate-400">
                              · {a.years}y · {a.department}
                            </span>
                          </span>
                          <button
                            onClick={() => removeAnniversary(a.id)}
                            className="text-rose-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Reviews, shout-outs and updates save to Supabase instantly and
            appear in the preview. Click <strong>Generate</strong> to publish
            the current set (joke + new hires + everything in this preview) to{" "}
            <code>/newsletter</code>. Published items are tied to that issue, so
            the next time you open this page you start fresh with only the new
            content for the next cycle.
          </p>
        </div>

        {/* ---------- Right: live preview ---------- */}
        <div id="newsletter-print">
          <NewsletterContent
            issueName={issueName}
            joke={joke}
            updates={updates}
            reviews={reviews}
            newHires={newHires}
            birthdays={birthdays}
            anniversaries={anniversaries}
            shoutouts={shoutouts}
            session={session}
          />
        </div>
      </div>
    </Layout>
  );
}
