# Hard Truths
**Prepared:** 2026-04-27 | Section 8

## What I'd Want to Know If I Were Investing

---

### The Single Biggest Risk to Commercial Success

**There is no backend, and without one this product cannot be sold as a team tool.**

Every rep's training history lives in their own browser in localStorage. There is no shared database. A manager cannot see their team's progress. A rep who switches computers loses their history. If you pitch this to Orion leadership as a training tool for 40 reps and the CFO asks "how do you pull a report on everyone's progress?" — the honest answer today is "you can't." That is a deal-killer.

The core AI loop does work — the simulator conversation and scoring both use the OpenAI Responses API correctly. But "the AI works" and "this is a product you can buy" are very different claims. Right now it's the former, not the latter. A single rep practicing on their own laptop gets value. A company buying this for 40 reps gets a broken team experience.

**Before you pitch to anyone outside Orion: run every feature as a real user on a different browser, different machine, different login. Document what breaks. That's your build list.**

The secondary risk is that you have no external validation. You believe the product solves a real problem because you've seen the problem as a recruiter. That's a good starting hypothesis. It's not a sales conversation until someone who has managed a firearms distribution sales team has looked at it and said "yes, this is what my reps need."

---

### The Single Most Important Thing to Build Next

**A real database.** Not more features. Not the ATF compliance module. Not the RingCentral integration.

Without persistence, you don't have a product — you have a demo. With persistence, you can:
- Show a manager the actual training history of their entire team
- Accumulate data that becomes a selling point ("after 3 months of use, here's what your rep distribution looks like")
- Build any of the other features on top of a foundation that doesn't disappear on cache clear

Supabase (PostgreSQL + auth) would cost $25/month and take 2–3 weeks to integrate. That single investment changes the product from a demo to a tool.

The ATF/FFL compliance module is what would create a moat, but you can't credibly build that alone without a subject-matter expert. That comes after the infrastructure is real and after you have one customer validating that you're building the right thing.

---

### Is This a Product, a Feature, or a Services Business in Disguise?

**Right now, it's a demo. In 6 months with the right build, it could be a product. Without a moat, it risks becoming a services business.**

Here's the distinction: a product generates recurring revenue from customers using software autonomously. A services business generates revenue from your time spent configuring, customizing, and supporting each customer. A feature is something that should live inside a larger platform and doesn't justify standalone pricing.

The current state is closer to a feature. The AI roleplay and scoring loop that powers this product is available from Second Nature, Hyperbound, and Quantified — all of which are better-funded, better-staffed, and have more customers validating their product. If a firearms distributor VP hears this pitch and Googles "AI sales training," they will find those products. Without something specific to this industry that those products can't provide, the comparison doesn't go your way.

The path to product: build the firearms-specific compliance and regulatory module. That is genuinely not built anywhere in this market. If you can make a sales rep at a firearms distributor confident about ATF conversations, FFL dealer situations, and state-restriction navigation — that is worth paying for and it cannot be replicated by a generic platform.

The risk of services: every customer you get before that module exists will want you to customize scenarios for them. That's good early revenue but it's not scalable. You will find yourself building custom content libraries for each customer and billing by the hour. That's a consulting business, not a SaaS business.

**The question to ask yourself at each decision:** "Does building this make the next customer easier to close, or does it make this one customer happier?" The former is product. The latter is services.

---

### Realistic 12-Month Revenue Ceiling

**$0–$72,000 ARR** is the honest range given current state.

**Best case ($72,000 ARR):**
- Fix the API calls (week 1)
- Build a real database (weeks 2–5)
- Feed the Orion product catalog and the real objection data into the AI (weeks 6–8)
- Pilot with Orion at $0 for 60 days, collect evidence of rep improvement
- Convert Orion to a paying customer at $30/seat/month × 40 reps = $1,440/month ($17,280 ARR)
- Sign one additional distributor at the same rate = $17,280 more
- Reach out to 2–3 spirits distributor or medical device contacts using the licensing pitch = 1 signing at $5,000/month platform fee
- Total at 12 months: ~$72k ARR

**More likely case ($0–$17,000 ARR):**
- Orion pilot succeeds but converting to paid takes longer than expected (internal procurement, budget cycle)
- No second customer signed within 12 months because you're still building
- $17,280 ARR from Orion alone — if you get there

**The scenario that leads to $0:**
- Demo fails in front of the exec team
- Orion decides this is a "nice to have" and never prioritizes payment
- You spend the year customizing content for Orion without a contract
- No external customers reached

**What would change the ceiling:**
- One licensing deal with a 500+ rep company (spirits, medical devices, automotive parts) at $20/seat/month = $120,000 ARR from a single contract
- That deal requires the product to work reliably, a real backend, and a credible case study (Orion as reference)
- The ceiling at 24 months, if that path works: $500k–$1M ARR is achievable; $2M+ requires more capital and a dedicated sales effort

---

### The Thing Nobody Is Saying to You

You are a recruiter who built a software product to solve a problem you observed. That is a legitimate origin story and some great companies started exactly that way. But there are two things to be clear-eyed about:

**First:** You are not a sales executive, a sales trainer, or a firearms industry compliance expert. The product's differentiated value — the content that would make this genuinely better than a generic AI roleplay tool — requires that expertise. You need a co-founder or a tight advisory relationship with someone who has spent years in firearms distribution sales. Not to validate the concept (the concept is fine) — to build the scenarios, rubrics, and compliance content that make this unbeatable in this niche.

**Second:** The product is built on a foundation that needs to be rebuilt before it scales. No backend, no real auth, no tested API calls, no mobile support, no data export. None of that is disqualifying — it's normal for a prototype. But the work to get from prototype to product is 3–4 months of serious engineering effort, not 2 weeks of feature additions. If you're building this yourself, set that expectation honestly. If you're hiring a developer, budget $20,000–$50,000 for the infrastructure work before you're ready to charge anyone $30/month and mean it.

The core insight — that firearms distribution reps need specialized, compliance-aware training that doesn't exist anywhere — is correct. The market timing (industry growing, distributor headcounts expanding, AI making this affordable to build) is real. The product concept is valid. What's in this repo is a prototype that proves you can build the UI. The actual product is still ahead of you.
