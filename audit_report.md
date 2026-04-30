# Technical Audit Report — Sales Simulator Orion
**Date:** 2026-04-27  
**Auditor:** Claude Code (Senior Technical Review)  
**Purpose:** Executive pitch readiness — $30/user/month deal

---

## File & Folder Map

```
sales_simulator_orion/
├── .env                          ← OpenAI API key (gitignored; keep off version control)
├── README.md                     ← ISSUE: Default Vite template — no project docs
├── package.json                  ← React 19, Vite 8, React Router 7, openai SDK v6
├── vite.config.js                ← Minimal Vite config; no local dev API proxy
├── vercel.json                   ← SPA rewrite rules (FIXED: was blocking /api/* routes)
├── index.html                    ← App entry point
│
├── src/
│   ├── main.jsx                  ← React root, mounts AppStateProvider
│   ├── App.jsx                   ← Router — 12 routes (FIXED: duplicate /admin/import removed)
│   ├── roots.jsx                 ← DEAD CODE: unused alternate router (3 routes), never imported
│   │
│   ├── context/
│   │   └── AppState.jsx          ← Global localStorage state (accounts, user, training)
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx         ← KPI cards, comp summary, account spotlight, level tracker
│   │   ├── SalesSimulator.jsx    ← AI text simulator — customer personas, scoring, TTS
│   │   ├── Training.jsx          ← Scenario-based training with rubric scoring
│   │   ├── Accounts.jsx          ← Dealer account list with plan editing and sim launch
│   │   ├── Activity.jsx          ← Feed of training results, account updates, comp inputs
│   │   ├── Leaderboard.jsx       ← Rep ranking by readiness score
│   │   ├── Levels.jsx            ← Rep progression from Associate AE → Strategic Growth Leader
│   │   ├── RepMetrics.jsx        ← KPI input (revenue, captures, customers sold)
│   │   ├── ManagerView.jsx       ← Manager dashboard: comp comparison, RingCentral, coaching alerts
│   │   ├── Employees.jsx         ← Employee roster with search/filter
│   │   └── AdminImport.jsx       ← Bulk CSV/JSON import (employees, contacts, products, RC calls)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.jsx        ← Sidebar + content shell
│   │   │   ├── Sidebar.jsx       ← Navigation sidebar
│   │   │   └── Topbar.jsx        ← Top header bar
│   │   └── simulator/
│   │       ├── ControlPanel.jsx  ← Start/end session, persona picker, difficulty selector
│   │       ├── TranscriptPanel.jsx ← Chat transcript + rep message input
│   │       ├── OrderBuilder.jsx  ← Product order builder + objection tracker
│   │       ├── ScorePanel.jsx    ← AI scorecard display (5 dimensions)
│   │       └── RealtimeVoicePanel.jsx ← WebRTC live voice mode via OpenAI Realtime API
│   │
│   ├── lib/
│   │   ├── accountStore.js       ← Load/save dealer accounts to localStorage
│   │   ├── trainingStore.js      ← Load/save training session results
│   │   ├── repProfileStore.js    ← Load/save rep KPI metrics
│   │   ├── compEngine.js         ← Compensation calculation logic
│   │   ├── productStore.js       ← Load/save imported inventory
│   │   ├── simulatorResultsStore.js ← Load/save AI simulator sessions
│   │   └── ringCentralStore.js   ← Load/save RingCentral call logs
│   │
│   ├── data/
│   │   ├── accounts.js           ← Seed: 3 demo dealer accounts
│   │   ├── employees.js          ← Seed: employee roster
│   │   ├── compPlan.js           ← KPI targets, compensation formulas
│   │   ├── customerScenarios.js  ← 8 AI customer personas + 4 difficulty levels
│   │   ├── dashboard.js          ← Dashboard UI config data
│   │   ├── training.js           ← Training scenario definitions
│   │   ├── levels.js             ← Level progression data
│   │   ├── scoringRubrics.js     ← Training score rubric definitions
│   │   ├── uiCopy.js             ← All UI text/labels
│   │   └── leaderboard.js        ← EMPTY FILE — 0 bytes, no imports; safe to delete
│   │
│   └── styles/
│       ├── app.css               ← Dark theme, layout grid, cards, buttons, forms
│       ├── simulator.css         ← Simulator-specific layout
│       └── index.css             ← Base reset/typography
│
└── api/                          ← Vercel serverless functions (Node.js, openai SDK v6)
    ├── customer-reply.js         ← POST: GPT-4.1-mini generates AI customer response
    ├── score-call.js             ← POST: GPT-4.1-mini scores conversation on 5 dimensions
    ├── speak-customer.js         ← POST: gpt-4o-mini-tts generates customer voice audio
    ├── realtime-session.js       ← POST: creates OpenAI Realtime session token for WebRTC
    ├── employees/import.js       ← POST: bulk import employee roster
    ├── employees/list.js         ← GET: list employees by clientId
    ├── contacts/import.js        ← POST: bulk import contacts with phone normalization
    ├── contacts/list.js          ← GET: list contacts by clientId
    ├── clients/create.js         ← POST: create client record
    └── _lib/
        ├── auth.js               ← Extracts clientId from request header
        └── db.js                 ← In-memory global db (volatile — resets on server restart)
```

---

## Findings by Severity

### CRITICAL — Fixed Before This Report

| # | File | Issue | Fix Applied |
|---|------|-------|-------------|
| C1 | `vercel.json` | Catch-all rewrite `"/(.*)"→"/"` intercepted all `/api/*` routes, breaking every AI feature in Vercel deployment | Changed to `/((?!api/).*)` — API routes now take priority |
| C2 | `src/App.jsx:32` | `/admin/import` route defined twice — second definition shadowed the first | Removed duplicate |

### HIGH — Action Required Before Demo

| # | File | Issue | Recommendation |
|---|------|-------|----------------|
| H1 | `vite.config.js` | No proxy for `/api/*` — running `npm run dev` results in 404 for all AI calls | **Use `vercel dev` instead of `npm run dev` for the pitch demo**, or add a proxy block |
| H2 | `README.md` | Default Vite template — zero project-specific setup instructions | See below for a replacement README |
| H3 | `api/_lib/db.js` | In-memory `global.db` loses all data on server restart | Fine for demo; not for production |
| H4 | `api/score-call.js:21` | `customerType`, `difficulty`, `scenario`, `account`, `products` are all sent by the frontend but ignored by the scoring function — only `transcript`, `orderItems`, `objections` are used | Scoring works but is less context-aware than possible |
| H5 | `api/realtime-session.js:56` | Calls non-standard endpoint `/v1/realtime/client_secrets`; correct Realtime API uses `/v1/realtime/sessions` | Test live voice before demo; fallback to text mode if it fails |

### MEDIUM — Polish Items

| # | File | Issue |
|---|------|-------|
| M1 | `src/roots.jsx` | Dead file — exports `AppRoutes` that is never imported anywhere; causes confusion |
| M2 | `src/data/leaderboard.js` | Empty file — 0 bytes, never imported; safe to delete |
| M3 | `src/pages/SalesSimulator.jsx:273-289` | `useEffect` idle-timer depends on `repLastMessageTime` which changes every message — interval recreates constantly; functionally harmless but inefficient |
| M4 | `src/pages/SalesSimulator.jsx:381` | Page title says "GeniusSeeker Training Lab" — should be Orion branding for the exec pitch |
| M5 | All `.jsx` | No `aria-label` attributes on interactive elements — fails basic accessibility audit |
| M6 | `src/styles/` | No responsive breakpoints — app is desktop-only; fine for laptop demo |
| M7 | All API routes | No request body size limits — could accept arbitrarily large payloads |

### LOW — Post-Demo Cleanup

| # | Issue |
|---|-------|
| L1 | No `.env.example` file — new developers have no reference for required env vars |
| L2 | No PropTypes or TypeScript — type errors only surface at runtime |
| L3 | `src/App.css` and `src/styles/app.css` — two CSS files with similar names; `App.css` appears to be an empty Vite default |
| L4 | Scoring model hardcodes weights (training 45%, consistency 20%, level 15%, comp 20%) with no way to tune without a code change |

---

## Security Assessment

| Issue | Severity | Status |
|-------|----------|--------|
| `.env` contains live OpenAI API key | MEDIUM | Key is gitignored (`.env` in `.gitignore`) — safe from commits, but file exists on disk. Rotate key before sharing repo access. |
| No authentication on `/api/*` routes | MEDIUM | Demo-appropriate; any caller can invoke the AI endpoints. Add auth middleware before production. |
| `global.db` stores imported data in process memory | LOW | Volatile — resets on restart. Contacts/employees survive only within the same process lifecycle. |
| No CORS policy on Vercel functions | LOW | Vercel adds default CORS; acceptable for demo. Lock to known domains before production. |

---

## Local Dev Blockers (Running `npm run dev`)

The Vite dev server **starts successfully** and the React UI loads. However:

1. **AI features fail with 404** — `/api/customer-reply`, `/api/score-call`, `/api/speak-customer`, `/api/realtime-session` are Vercel serverless functions and are not served by Vite.
2. **Fix for the pitch**: Run `vercel dev` (requires `npm i -g vercel` and `vercel link`) — this serves both the Vite frontend and the `/api` functions together.
3. **Alternative**: Deploy to Vercel with `OPENAI_API_KEY` set in the Vercel dashboard environment variables. This is the most reliable option for an executive demo.

### Recommended setup for the pitch day:

```bash
# Option A — Vercel deployment (recommended for exec demo)
vercel deploy --prod
# Set OPENAI_API_KEY in Vercel dashboard → Settings → Environment Variables

# Option B — Local with Vercel CLI
npm install -g vercel
vercel link
vercel dev   # serves frontend + API functions together at localhost:3000
```

---

## README Replacement

The current README is the default Vite template and contains zero project-relevant information. Replace `README.md` with:

```markdown
# GeniusSeeker Sales Simulator — Orion Edition

AI-powered sales training simulator for Orion Sales Executives.

## Setup

### 1. Install dependencies
npm install

### 2. Configure environment
Create a `.env` file:
OPENAI_API_KEY=your-openai-api-key-here

### 3. Run locally (with API functions)
npm install -g vercel
vercel link
vercel dev

### 4. Deploy to Vercel
vercel deploy --prod
# Add OPENAI_API_KEY in Vercel Dashboard → Settings → Environment Variables

## Features
- AI customer simulation (text + voice) using GPT-4.1-mini
- 8 customer personas × 4 difficulty levels
- AI-powered call scoring on 5 dimensions
- Manager view with RingCentral integration
- Rep progression levels (L1–L5)
- Bulk import: employees, contacts, products, call logs
```

---

## Verification Checklist

- [x] `npm install` — clean install, no errors
- [x] `npm run dev` — Vite dev server starts on port 5173
- [x] React app loads in browser — routing works
- [x] All 11 routes render without import errors
- [x] OpenAI SDK v6 — `client.responses.create()` and `output_text` are valid (confirmed in SDK types)
- [x] `gpt-4o-mini-tts` — valid TTS model (confirmed in SDK `SpeechModel` type)
- [x] `vercel.json` — FIXED, API routes no longer intercepted
- [x] `App.jsx` — FIXED, duplicate route removed
- [ ] AI customer reply — requires `vercel dev` or Vercel deployment to test
- [ ] AI scoring — requires `vercel dev` or Vercel deployment to test
- [ ] TTS voice — requires `vercel dev` or Vercel deployment to test
- [ ] Realtime WebRTC voice — endpoint may need verification; test before demo

---

*Report generated 2026-04-27. Two critical code fixes applied. See `gap_analysis.md` for feature completeness.*
