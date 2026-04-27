# Gap Analysis — Sales Simulator Orion
**Date:** 2026-04-27  
**Purpose:** Compare what's built against an executive-ready sales training demo  
**Context:** Pitch to Orion CFO, CEO, National Sales Director, 2 Sales Managers

---

## What's Built (Inventory of Working Features)

| Feature | Status | Demo-Ready? |
|---------|--------|-------------|
| AI text-mode customer simulation (8 personas × 4 difficulties) | ✅ Complete | Yes |
| TTS voice for AI customer replies | ✅ Complete | Yes |
| WebRTC live voice mode (full two-way conversation) | ⚠️ Built, endpoint uncertain | Test before demo |
| AI call scoring (5 dimensions: discovery, order building, objection handling, closing, overall) | ✅ Complete | Yes |
| Coaching note + better phrases in score results | ✅ Complete | Yes |
| Account-based simulation (launch sim from an actual dealer account) | ✅ Complete | Yes |
| Order builder (add products during call) | ✅ Complete | Yes |
| Objection tracker (log objections as they occur) | ✅ Complete | Yes |
| Rep progression levels (L1 Associate AE → L5 Strategic Growth Leader) | ✅ Complete | Yes |
| Training module with rubric scoring | ✅ Complete | Yes |
| Manager view: rep comp comparison table | ✅ Complete | Yes |
| Manager view: coaching alerts (auto-generated) | ✅ Complete | Yes |
| Manager view: rep performance leaderboard | ✅ Complete | Yes |
| RingCentral call log import + comparison | ✅ Complete | Yes |
| Dealer account management (accounts with plan editor) | ✅ Complete | Yes |
| Admin import (employees, contacts, products, RC calls via CSV/JSON) | ✅ Complete | Yes |
| Dashboard with KPI cards and comp summary | ✅ Complete | Yes |
| Demo data seeded (3 mock AE profiles in Manager View) | ✅ Complete | Yes |
| Responsive layout for mobile | ❌ Not built | Desktop only (fine for laptop pitch) |
| User authentication / login | ❌ Not built | Acceptable for demo |
| Persistent backend database | ❌ Not built | Uses localStorage (fine for demo) |

---

## Gap Analysis: Executive Demo Standard

### Tier 1 — Critical Gaps (Fix Before the Meeting)

#### 1. Branding: App Says "GeniusSeeker Training Lab"
- **Location:** `src/pages/SalesSimulator.jsx:381`
- **Impact:** If an exec sees the wrong company name on the main feature screen, it signals the demo isn't production-ready.
- **Fix:** Change "GeniusSeeker Training Lab" to "Orion Sales Training Lab" (or whatever the product name should be).
- **Time:** 2 minutes.

#### 2. No Pre-Loaded Demo Data for the Live Pitch
- **Impact:** When an exec opens the Manager View and sees "No data available," the demo dies.
- **What's missing:** The Manager View has seeded *comparison* rep profiles (New Ramp AE, Mid-Ramp AE, High Performer AE), but the Simulator Activity and RingCentral tables will be empty.
- **Fix:** Pre-run 2-3 simulator sessions before the meeting and save those results. Import a sample RingCentral CSV so the Manager View shows real data.
- **Time:** 15 minutes of pre-work.

#### 3. "Run the Demo Yourself First" — Test the Full Flow
- **Impact:** The `/api/*` routes only work via `vercel dev` or Vercel deployment — not `npm run dev`.
- **Fix:** Deploy to Vercel with `OPENAI_API_KEY` in environment variables, and click through the full demo flow at least twice before the meeting.
- **Time:** 30 minutes.

---

### Tier 2 — High-Impact Gaps (Add for Stronger Pitch)

#### 4. No Progress Over Time Chart
- **What's missing:** A simple line chart showing a rep's simulator score improving across sessions.
- **Why it matters:** The "ramp time reduction" story is much more compelling when you can *show* a rep going from 45 → 72 → 88 over 6 sessions. Execs respond to trend lines.
- **Effort:** Medium — 2-3 hours with a charting library (recharts).
- **Workaround for now:** Manually note in the demo script that historical trend tracking is on the roadmap.

#### 5. No Onboarding Flow for a New Rep
- **What's missing:** A guided first-session experience (e.g., "Complete your first practice call" prompt on the dashboard).
- **Why it matters:** The CFO will ask "how does a new rep actually use this?" — a clear onboarding path answers that question visually.
- **Effort:** Medium — could be a modal or guided callout on the Dashboard.
- **Workaround:** The demo script covers this verbally.

#### 6. Score History / Session Log for Reps
- **What's missing:** A page showing a rep's own history of simulator scores over time.
- **Why it matters:** Shows the rep self-coaching loop, which is a key selling point.
- **Effort:** Low — data already exists in `simulatorResultsStore`; just need a filtered view on the Rep Metrics page.

---

### Tier 3 — Nice-to-Have (Post-Pilot Roadmap)

| Gap | Why It Matters | Effort |
|-----|---------------|--------|
| Manager can assign specific scenarios to reps | Makes the product feel like a real training system | High |
| Email/Slack notifications when rep scores below threshold | Closes the coaching loop automatically | Medium |
| Progress reports exportable as PDF | Manager can share with VP/C-suite without logging in | Medium |
| Leaderboard visible to all reps (competitive motivation) | Drives organic engagement | Low |
| Custom scenario builder (manager writes the script) | Makes the product sticky for specific products/accounts | High |
| Mobile app / responsive layout | Field reps practicing in the car | High |
| SSO / Active Directory login | Enterprise IT requirement for any company > 200 seats | High |
| LMS integration (Workday, SAP SuccessFactors) | Required by larger customers | Very High |
| A/B scenario testing (compare two approaches on same account) | Power feature for advanced users | High |
| Whisper real-time coaching (AI coach listening on live calls) | Next-level product; extends to actual calls, not just practice | Very High |

---

## Prioritized Fix List: What to Do Before the Pitch

| Priority | Action | Time | Owner |
|----------|--------|------|-------|
| 1 | Fix branding: "GeniusSeeker" → "Orion" in SalesSimulator.jsx | 2 min | You |
| 2 | Deploy to Vercel + set OPENAI_API_KEY env var | 30 min | You |
| 3 | Pre-run 3 simulator sessions to seed demo data | 15 min | You |
| 4 | Import a sample RingCentral CSV to populate Manager View | 10 min | You |
| 5 | Run the full demo flow twice end-to-end | 20 min | You |
| 6 | Update page title in `index.html` from "sales_simulator_orion" | 2 min | You |
| 7 | Update README with actual setup instructions | 15 min | You (done in audit) |

**Total pre-pitch prep time: ~90 minutes**

---

## Demo-Readiness Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Core feature completeness | 8/10 | AI sim, scoring, manager view all work |
| Data/content for demo | 5/10 | Needs pre-seeding before pitch |
| Visual polish | 7/10 | Dark theme is clean; minor branding issue |
| Reliability | 7/10 | Dependent on OpenAI API uptime; have a fallback |
| Business story told by UI | 6/10 | Manager view is strong; rep journey could be clearer |
| **Overall** | **6.6/10** | **Passable with 90 min of prep; strong with trend chart** |

---

*See `demo_script.md` for the recommended 10-minute walkthrough sequence.*
