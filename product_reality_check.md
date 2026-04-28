# Product Reality Check
**Prepared:** 2026-04-27 | **Reviewer:** Claude (technical + product + investor lens)
**Subject:** SalesSimulator Orion — Pre-pitch due diligence

---

## Section 1 — What the Code Actually Proves This Product Does

### Plain-English Description

This is a browser-only training tool for sales reps. The centerpiece is a chat interface where a rep types messages, and an AI pretends to be a customer. When the conversation ends, a second AI call grades the rep's performance on five dimensions. Supporting that core loop are a compensation calculator, a rep leaderboard, a gamification system (levels, daily cash prizes, a branded currency called "GeniusDollars"), and role-specific dashboards for reps, managers, and admins.

Everything runs in the browser. There is no server database. User data lives in localStorage — it disappears when someone clears their browser cache. All "integrations" with Microsoft Business Central, FedEx, and RingCentral are present as API file skeletons with hardcoded demo data fallbacks; none of them have been connected to real credentials and none of the webhook handlers do anything when called.

The product is deployed on Vercel as a static SPA with serverless functions. The AI calls go through those serverless functions to avoid exposing the OpenAI key in the browser.

### Real, Working Features (verified in code)

| Feature | Status | Notes |
|---|---|---|
| Login with role-based access | ✅ Working | Hardcoded credentials; no external auth provider |
| 8 AI customer personas × 4 difficulty levels | ✅ Working | Uses OpenAI Responses API (`client.responses.create()`) — valid in SDK v6 |
| AI call scoring (5 dimensions) | ✅ Working | Same — correct API usage |
| Text-to-speech (customer voice) | ✅ Working | Uses valid `client.audio.speech.create()` call |
| Rep progression levels (L1–L5) | ✅ Working | Calculated from training session count + average score |
| Compensation calculator | ✅ Working | Real Orion comp plan logic embedded |
| Leaderboard (all 35 reps, seeded scores) | ✅ Working | Scores are deterministically generated from rep code hash, not real |
| Prize/earnings tracker | ✅ Working | Daily cash + GeniusDollars; 7 days of seeded demo history |
| Manager view | ✅ Working | Seeded demo data only; no live RingCentral data |
| Admin import (employees, products, contacts) | ✅ Working | Imports to in-memory object that resets on server restart |
| Role-based nav (rep/manager/admin) | ✅ Working | |
| Dealer account management | ✅ Working | Data persists in localStorage |

### Stubs, Placeholders, and Known Broken Code

| Item | Status |
|---|---|
| `customer-reply.js` API call | **WORKING** — uses OpenAI Responses API (`client.responses.create()` with `input[]`, returns `output_text`). This is the correct newer API, not a mistake. |
| `score-call.js` API call | **WORKING** — same; parses `output_text` as JSON for the scorecard |
| `realtime-session.js` | **UNCERTAIN** — uses non-standard endpoint `/v1/realtime/client_secrets`; official API uses `/v1/realtime/sessions`. Voice mode may not work. |
| Business Central integration | **STUB** — OAuth flow is built; all data endpoints return hardcoded demo data; webhook handler accepts POST and does nothing |
| FedEx integration | **STUB** — same pattern |
| RingCentral integration | **STUB** — same pattern |
| `api/_lib/db.js` (in-memory database) | **VOLATILE** — `global.db` resets on every server cold start; any imported data is gone |
| `src/data/leaderboard.js` | **EMPTY FILE** — 0 bytes, safe to delete |
| `src/roots.jsx` | **DEAD CODE** — alternate router, never imported anywhere |

### API Status Correction

The sub-agent that reviewed this code flagged `client.responses.create()` as a broken method. That was wrong. OpenAI released its Responses API in 2025 and `client.responses.create()` with `input[]` messages and `output_text` response is the correct, current API. The core AI loop is using a more modern API than Chat Completions, not a broken one.

**The remaining uncertainty is voice mode.** `realtime-session.js` uses endpoint `/v1/realtime/client_secrets` which is non-standard. Official Realtime API uses `/v1/realtime/sessions`. Test voice mode before any live demo — but have a fallback plan since text mode works fine.

### Tech Stack

- **Frontend:** React 19, Vite 8, React Router 7. Standard libraries, nothing proprietary.
- **Backend:** Vercel serverless functions (Node.js). Standard.
- **AI:** OpenAI `gpt-4.1-mini` (prompting only — no fine-tuning, no embeddings, no proprietary model). OpenAI `gpt-4o-mini-tts` for voice.
- **Auth:** Hardcoded credentials in source code. No external provider (Auth0, Clerk, Supabase, etc.).
- **Database:** None. localStorage in the browser; volatile `global.db` in serverless functions.
- **Integrations:** OAuth flow stubs for BC, FedEx, RingCentral. None connected.
- **Styling:** Custom CSS, no component library.
- **Deployment:** Vercel (free tier capable, though API call volume would eventually cost real money at per-token rates).

There is no proprietary technology anywhere in this stack. Every piece is a standard open-source library or a third-party API that any developer could wire up independently.

---

## Section 2 — Honest Product Overview

### What a Customer Actually Gets Today

A buyer who purchased this today would get a web app where their sales reps can log in, pick a customer type and difficulty level, and have a text conversation with a GPT-4.1-mini persona. After ending the session, they receive an AI-generated scorecard with five dimension scores and a coaching note. The system tracks session history, shows a leaderboard of the team ranked by training scores, and lets managers see a dashboard comparing rep performance. Compensation targets from the buyer's own comp plan are embedded, so reps can see how their KPIs map to earnings. There are gamified elements: rep levels (L1–L5), daily cash prize competitions for new hires, and a branded rewards currency. Data does not persist if the user clears their browser or if the Vercel instance restarts.

### Core Job-to-Be-Done

The product addresses a genuine problem: sales reps ramp slowly, and managers don't have time to personally coach 40 people. The value proposition is "practice difficult conversations before they're real." That is a real, validated pain point. The job-to-be-done is *deliberate practice at scale without requiring manager time.*

### Depth of the AI/Simulation

The AI is GPT-4.1-mini with a well-written system prompt describing a customer persona, difficulty rules, and the product catalog. The customer personas are thoughtfully constructed — eight distinct archetypes with realistic resistance patterns. The scoring rubric has genuine logic. This is better-than-average prompt engineering, not AI product development.

To be precise about what this is: it is a scripted-by-prompt conversation, not a sophisticated simulation. The "AI" does not remember what you said three turns ago any better than a general LLM. It has no internal state beyond the conversation history in the context window. There is no specialized model, no fine-tuning, no unique training data, and no proprietary scoring algorithm. A skilled developer could replicate the entire AI layer in 48 hours using the same OpenAI API.

The scoring is equally honest to describe: GPT-4.1-mini reads the transcript and outputs a JSON object with numbers. There is no validated rubric developed by sales training professionals, no calibration against real expert ratings, and no benchmark data showing those scores predict real-world performance.

### Where the Product Feels Thin

1. **No persistence.** Every session lives in one browser. A rep switches computers and their history is gone. A manager can only see data from reps who last logged in on that specific browser.

2. **The product catalog is generic.** The demo data in the BC integration fallback references solar panels and EV chargers. Orion sells firearms. The AI personas have no actual Orion product knowledge. The "top objections" data that was fed in is good, but it's not visible in the API calls and may not be surfacing correctly.

3. **Firearms specificity is zero.** Nothing in this product addresses ATF compliance, FFL dealer relationships, state-level restrictions, NFA item regulations, background check discussions, MAP pricing enforcement, or any other domain-specific dynamic that makes firearms distribution sales different from selling office supplies. The product is a generic sales training tool with "Orion" in the title.

4. **The integrations don't integrate.** The BC/FedEx/RingCentral endpoints exist as architecture diagrams, not working software.

5. **The leaderboard is fiction.** Scores are generated by hashing each employee's code against the current date. No rep has actually done a training session. The leaderboard looks real but is seeded data.

6. **No admin controls a real customer needs.** A VP of Sales buying this needs: centralized user management, the ability to create custom scenarios, export of rep performance data, and SSO. None of these exist.

---

## Section 3 — Differentiation

### Feature-by-Feature Classification

| Feature | Classification | Reasoning |
|---|---|---|
| AI customer roleplay (text) | **Table stakes** | Hyperbound, Second Nature, Quantified, Replicate all do this |
| Voice roleplay (TTS/WebRTC) | **Competitive parity** | Hyperbound, Second Nature have native voice; Orion's may not work |
| AI call scoring | **Table stakes** | Every AI coaching tool in 2026 does this |
| 8 customer personas | **Competitive parity** | Most tools have 10-20+ templates |
| 4 difficulty levels | **Competitive parity** | Common feature |
| Rep level progression (L1–L5) | **Competitive parity** | Common gamification |
| Daily prize competition | **Competitive parity** | Gamification is table stakes; GeniusDollars is just branding |
| Comp plan calculator | **Potential differentiator** | Rare in standalone training tools; meaningful if accurate to buyer's actual plan |
| Leaderboard tied to training scores | **Competitive parity** | |
| Role-based dashboards (rep/mgr/admin) | **Competitive parity** | |
| BC/FedEx/RC integration | **Potential differentiator** | Not built, so not currently differentiating |
| Firearms industry scenarios | **Potential differentiator** | Not built — the current product has no firearms-specific content |
| ATF/FFL compliance training | **Genuine differentiator** | Does not exist; no competitor has built this; would be defensible |

### The Honest Assessment of Moat

There is no moat today. The product is a well-executed prototype of a category that already exists. "AI-powered" and "gamified" describe 40 tools in this space. Orion branding is not a moat.

There are two paths to a defensible position, and neither is built:

**Path 1 — Firearms-specific compliance and product knowledge**
If you built a genuine ATF/FFL compliance training module (what reps can legally say, state-specific restrictions, dealer program rules, NFA handling), you would be the only product in the category serving that need. Incumbents (Mindtickle, Allego, Brainshark) do not have this. It requires deep subject-matter expertise to build, which creates a real barrier. This is where the real IP opportunity lives.

**Path 2 — Proprietary training data and scoring calibration**
If you collected thousands of real Orion sales call transcripts, built a validated scoring model calibrated against "what actually closes deals in firearms distribution," and fine-tuned or RAG-embedded that data — the product becomes hard to replicate because the data is yours. No one else has Orion's call data. The challenge: collecting this data requires infrastructure (call recording integration, data consent, annotation pipeline) that doesn't exist yet.

**What would need to be built to create a moat:**
1. A firearms regulatory knowledge base (ATF regs, state laws, FFL compliance scenarios) embedded in the AI
2. An actual product catalog from a real distributor fed as retrieval context
3. Validated scoring: calibration against expert sales trainers or closed-deal outcomes
4. Persistent backend so training history accumulates and becomes an asset
5. Integration with actual call data (RingCentral) so the training loop closes on real-world performance

Without at least items 1 and 3, this product is a feature of Mindtickle's roadmap, not a standalone business.
