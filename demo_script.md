# 10-Minute Executive Demo Script
**Sales Simulator Orion — Pitch to Orion Leadership**  
**Audience:** CFO, CEO, National Sales Director, 2 Sales Managers  
**Date:** 2026-04-27

---

## Before You Walk In

**Setup checklist (do this 30 minutes before the meeting):**
- [ ] Demo deployed to Vercel (not running locally)
- [ ] 3+ simulator sessions already completed and saved (seed the data)
- [ ] RingCentral sample CSV imported in Admin Import
- [ ] App open in browser, full-screen, on `/dashboard`
- [ ] Audio on — the AI customer speaks out loud
- [ ] Backup plan ready: if voice fails, use text mode

**Framing sentence to open with:**  
> "I want to show you something that your reps can use the day they're hired — and that you can actually measure."

---

## The Script

### MINUTE 0:30 — Dashboard (Set the Stage)

**Navigate to:** `/dashboard`

**What to say:**
> "This is what a sales rep sees when they log in. This is their personal coaching dashboard — their KPI status, their comp trajectory, their training level, and their next account to work. It gives every rep a clear answer to 'what should I focus on today?'"

**Point to:**
- The KPI cards (revenue, captures, customers sold)
- The level tracker (L1 Associate AE → L5 Strategic Growth Leader)
- The Accounts section

**CEO/CFO hook:** "Every rep knows exactly where they stand against their number — before they pick up the phone."

---

### MINUTE 2:00 — Accounts → Launch Simulator (The "Wow" Moment)

**Navigate to:** `/accounts`

**What to say:**
> "Every dealer account gets a plan — what category we're expanding, what the barrier is, how we're going to get there. And here's where it gets interesting."

**Click** on any account → click **"Practice This Call"** button.

> "Watch what happens. The rep clicks this button before their real call, and the AI takes on the role of that exact buyer — using their actual dealer name, their actual category gap, their actual barriers to buying."

**Navigate to:** `/sales-simulator` (which should load with the account context)

**Point to the Account Context panel:**
> "The AI customer already knows the situation. This isn't a generic roleplay — it's a rehearsal of the actual call the rep is about to make."

**CEO/CFO hook:** "This is the equivalent of a flight simulator. Your pilot doesn't learn to land in bad weather during the actual flight."

---

### MINUTE 3:30 — Run a Live Simulation (The Core Demo)

**Make sure:** Customer type is set to "Skeptical Store Owner," difficulty "Medium"

**Click "Start Session"**

> "The AI customer just opened the call. Let me show you what a rep experiences."

**Type as the rep:** `"Hi, I wanted to talk about some opportunities we have in your handgun category — we've got some strong movers right now."`

*[Wait for AI customer response — it will push back]*

> "Notice — the AI doesn't make it easy. It asks why. It challenges the rep on price, on margin, on whether this makes sense for their store. Just like a real buyer."

**Type a better response:** `"Before I make a recommendation, can you tell me what's been moving best for you lately and where you're running low?"`

*[AI becomes more cooperative — responds with a buying signal]*

> "Now watch — when the rep asks a real discovery question, the AI opens up. It mirrors how real buyers behave. Your reps learn this pattern through repetition, not through losing real deals."

**Add a product to the order** using the inventory table.

**Click "End Session"**

> "The call is scored in real time."

*[Wait ~5 seconds for scoring to appear]*

**Point to the ScorePanel:**
> "The AI scores every dimension — discovery, objection handling, order quality, closing. And it gives a coaching note with specific phrases the rep should have used. This is targeted feedback that a manager simply doesn't have time to give after every call."

**CEO/CFO hook:** "This feedback loop is what cuts ramp time. Instead of waiting 90 days to see if a rep figured it out, we know after session three."

---

### MINUTE 6:00 — Manager View (The Decision-Maker Screen)

**Navigate to:** `/manager-view`

**What to say:**
> "This is your view. This is what a Sales Manager and a National Sales Director see."

**Point to the KPI grid at the top:**
> "At a glance: who's in their ramp buffer, who hit their KPIs, what the average training score is, how many simulator sessions the team has completed."

**Scroll to the Rep Comparison table:**
> "This is every rep side by side — their revenue, their comp status, their training average, their level. You can see in one row who's accelerating and who needs a coaching conversation."

**Point to the Coaching Alerts table:**
> "These alerts are generated automatically. If a rep is practicing in the simulator but hasn't made real calls — that's an execution gap. If they're making calls but have no simulator sessions — that's a training gap. The system surfaces it before the manager has to hunt for it."

**Point to the Real Calls vs. Simulator section:**
> "We also pull in RingCentral call data. So you can see, side by side, how a rep's simulator score correlates with their actual call activity. If someone is scoring 80 in the simulator but connecting on 20% of their real calls — that's a different problem than someone who just isn't practicing."

**Sales Manager hook:** "You've always known which reps needed coaching. This just tells you exactly *what* to coach on and whether the coaching is working."

---

### MINUTE 8:30 — Close the Demo

**Navigate back to:** `/dashboard`

**What to say:**
> "Here's the summary of what you just saw: a rep can practice a specific dealer call before they make it, get scored by AI with coaching feedback, and their manager can see all of it in one view alongside their real call activity."
>
> "The reps who currently take 3 to 6 months to ramp — they're not slow because they don't want to succeed. They're slow because the feedback loop is too long. This tightens that loop down to days, not months."
>
> "At 39 reps today and 80 in two years, every rep who ramps 30 days faster is a real call that got made, a real order that got placed. That's the business case, and I'll walk you through the numbers in a moment."

---

## Backup Plan (If AI Fails)

If the `/api/customer-reply` or `/api/score-call` endpoint fails during the demo:

1. **Stay calm.** Say: *"The AI service has a brief delay — let me show you the scoring output from an earlier session."*
2. Navigate to `/manager-view` and show the Simulator Activity table with the pre-seeded sessions.
3. Use the pre-saved score data to talk through the coaching feedback.
4. If necessary, explain the feature verbally and show the transcript panel as a UI mock.

**The Manager View does not depend on live AI calls — it always shows historical data.**

---

## What Each Executive Cares About

| Executive | Their question | Where to point in the demo |
|-----------|---------------|----------------------------|
| **CEO** | "Will this help us scale from 39 to 80 reps without doubling training cost?" | Dashboard levels + Manager View rep comparison |
| **CFO** | "What's the cost, and what's the ROI?" | Point to ROI model — ramp time reduction × revenue per rep |
| **National Sales Director** | "Does this actually reflect how our reps sell?" | Account-based simulation — show the dealer name and barrier pulling through |
| **Sales Managers** | "Will this create more work for me or less?" | Coaching alerts + rep comparison table — "it tells you who to coach and what to coach on" |

---

## Power Lines for Q&A

**"Why would reps actually use this?"**  
> "Because it's tied to their comp. The more sessions they complete, the higher their level, the stronger their readiness score. We've built the incentive into the tool."

**"How is this different from just watching a training video?"**  
> "A video shows you a perfect call. This makes you have the hard conversation and then shows you exactly where you fell short. One is passive. This is active."

**"What if the AI gives bad advice?"**  
> "The AI is playing the customer — it's not coaching. The rubric is based on your actual sales process. The scoring logic is transparent and editable. You control what good looks like."

**"How long does a session take?"**  
> "About 7 to 10 minutes for a full simulated call. Short enough to do before a rep's morning call block."

---

*See `roi_model.xlsx` for the financial model and `exec_pitch_deck.pptx` for the slide deck.*
