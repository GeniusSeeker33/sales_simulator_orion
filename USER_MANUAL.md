# Orion Sales Performance OS — User Manual

**Powered by GeniusSeeker**

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Sales Executive (Rep) Guide](#2-sales-executive-rep-guide)
3. [Manager Guide](#3-manager-guide)
4. [Admin Guide](#4-admin-guide)
5. [Connecting Integrations](#5-connecting-integrations)
6. [Importing Your Customer List from Excel](#6-importing-your-customer-list-from-excel)

---

## 1. Getting Started

### How to Log In

Go to the app URL and enter your email and password on the login screen.

**Sales Executives (Reps)**
Your email is listed in the company directory. Your default password is your rep code followed by `@Orion`.
Example: If your rep code is `JMF`, your password is `JMF@Orion`.

**Managers and Admins**
You have a unique password provided by your administrator.

### Where You Land After Login

| Role | Default Page |
|------|-------------|
| Sales Executive | Dashboard |
| Manager | Manager View |
| Admin | Admin View |

### Navigation

The sidebar on the left gives you access to all your pages. The links you see depend on your role — reps see rep pages, managers see everything reps see plus manager tools, and admins see everything.

---

## 2. Sales Executive (Rep) Guide

### Rep Role Types

Orion supports two rep role types. The Dashboard, KPIs, missions, and compensation panel adapt automatically to whichever role you are.

| Role | Who It's For | Comp Model |
|------|-------------|------------|
| **Account Executive (AE)** | In-office reps managing dealer books | Base salary + revenue commission + capture/customer-sold bonuses, gated by monthly KPI minimums |
| **Remote Sales Associate (RSA)** | Nationwide, work-from-home outbound reps | Pay per completed call, multiplied by AI call score, plus engagement/capture bonuses and revenue participation |

You'll see a colored pill next to your name on the Dashboard ("Account Executive" or "Remote Rep") confirming which role you're logged in as.

The rest of this section covers the AE experience by default. RSA-specific differences are called out under [Remote Sales Associate (RSA) Role](#remote-sales-associate-rsa-role) below.

---

### Dashboard

Your home base. At a glance you can see:

- **Your KPI status** — whether you're in your ramp period (first 28 days), hitting your targets, or at risk of missing them
- **Compensation snapshot** — your estimated earnings for the month based on current performance
- **Daily Missions** — quick-hit actions to focus your day
- **Training snapshot** — how many sessions you've completed and your average score
- **Level progress** — how close you are to your next advancement tier
- **Leaderboard preview** — where you stand versus your teammates
- **GeniusDollars balance** — your earned currency and options to redeem rewards
- **Refer & Earn** — submit a candidate referral and track your bonus payouts

*If you're logged in as a Remote Sales Associate, the KPI cards, missions, and compensation panel switch to the remote model — see the section below for details.*

---

### AI Sales Simulator

**Path: AI Sales Simulator in the sidebar**

This is where you practice sales calls with an AI customer before making real ones.

**How to run a session:**
1. Select a dealer from your account list (or use a generic customer)
2. Choose a customer type — options include a skeptical store owner, a rushed buyer, a friendly repeat buyer, a price shopper, and more
3. Choose a difficulty level: Easy, Medium, or Hard
4. Click **Start Call** — the AI customer will greet you
5. Type your responses as you would speak them on a real call
6. The simulator tracks your discovery questions, objections you handle, and any orders you build
7. Click **End Call** when you're done

**After the call:**
You'll receive a score (0–100) broken down by:
- Discovery
- Order Building
- Objection Handling
- Closing

You'll also see your strengths, missed opportunities, a coaching note, and suggested better phrases.

**Tips:**
- Hard mode doubles your GeniusDollars earnings if you score well
- Sessions are saved and visible to your manager for coaching conversations

#### Cold Call Mode (from FFL Prospect Hub)

You can launch the simulator preloaded with a real FFL dealer from the national database. This is **cold call practice** — the AI customer has never heard of Orion and behaves like a real, busy dealer being called by a stranger.

**How to start a cold call session:**
1. Go to **FFL Prospect Hub** in the sidebar
2. Filter to the state and license type you want to practice against
3. Find a dealer in the results table
4. Click **🎯 Practice Cold Call**
5. The simulator opens with a red "Cold FFL Prospect" panel showing the dealer's business name, licensee, location, and phone
6. Click **Start Call** as usual

**What's different in cold call mode:**
- The AI customer does **not** know who you are or who Orion is
- They are busy, slightly guarded, and may push back with things like "Who is this?", "What's this about?", or "I already have a wholesaler"
- You have to earn their attention before pitching anything
- Discovery questions and tone matter more than product pitches in the first 60 seconds
- The AI will not agree to a follow-up unless you clearly earn it

This is the same cold-call dynamic Remote Sales Associates face every day. Use it before live dial blocks to warm up.

---

### FFL Prospect Hub

**Path: FFL Prospect Hub in the sidebar**

This is your live connection to the national federal firearms license (FFL) database — every active FFL holder in the country, searchable from one screen. Use it to find new dealer prospects, plan territory expansion, and feed your outbound calling list.

**What you can do:**

- **Filter the national database** by state, license type, business name, and city
- **See total FFL counts by state** at the top of the page (Indiana, Michigan, Ohio, and other growth states)
- **Convert any FFL to an Account** — adds the dealer to your Accounts page with one click, optionally pre-assigned to a specific rep
- **Launch a Cold Call Practice session** — opens the AI Sales Simulator preloaded with that FFL as the customer (see the Cold Call section below)

**Filter options:**

| Filter | What It Does |
|--------|-------------|
| State | Restricts results to a single state (e.g., IN, MI, TX) |
| License Type | Limits to dealers (01), pawnbrokers (02), manufacturers (07), etc. Type 01 is Orion's primary prospect target. |
| Business / Licensee Name | Fuzzy text search across both fields |
| City | City-level filter on the dealer's premises |
| Assign to… | Optional rep selector. When set, "Convert to Account" auto-assigns the dealer to that rep. |

**The two action buttons on each row:**

- **🎯 Practice Cold Call** — opens the AI Sales Simulator with this FFL preloaded as a true cold prospect. The AI customer doesn't know who you are.
- **+ Convert to Account** — copies the FFL into your Accounts list. Button flips to "✓ In Accounts" once added so you can't accidentally add the same dealer twice.

**Tips:**

- The "Assign to…" dropdown applies to **Convert to Account** only — not to Practice Cold Call. Pick a rep before clicking convert if you want the new account routed to a specific RSA or AE.
- Pagination is 25 results per page. Use filters to narrow the list before browsing — there are ~77,000 FFLs in the active database.
- The "Territory Overview" card at the bottom of the page shows FFL counts across Orion's growth states for territory planning.

---

### Training

**Path: Training in the sidebar**

Written scenario exercises that build core skills. Three scenarios are available:

| Scenario | What It Trains |
|----------|---------------|
| Growth Mission | Opening a dealer conversation and expanding the relationship |
| Objection Handling | Responding to pushback and price resistance |
| New Product Launch | Introducing a new product to an existing account |

**How to complete a training session:**
1. Select a scenario
2. Read the situation setup
3. Fill in the four response fields: Opening, Discovery, Value Story, and Close
4. Add any coach notes if you want (optional)
5. Click **Submit** — you'll receive a score and written feedback immediately

Training scores count toward your level progression and daily leaderboard ranking.

---

### Accounts

**Path: Accounts in the sidebar**

Your dealer account list. This is where you manage your book of business and build growth plans.

**What you can do:**
- **Browse your accounts** — see each dealer's name, assigned rep, location, current target, and last month's sales
- **Filter accounts** by rep (useful if you manage multiple territories)
- **Click any dealer** to open their full detail view

**Inside a dealer's detail:**
- Contact info, phone, email, territory
- Revenue target, last month's sales, and growth gap
- Progress bar showing how close they are to target
- Growth plan fields you can edit: category to expand, SKU focus, barrier, required AE action, and strategy
- Launch a practice call directly against this account from the Simulator

**To update a growth plan:**
1. Click the dealer in the list
2. Click **Edit Plan**
3. Fill in or update the fields
4. Click **Save Plan**

---

### Activity

**Path: Activity in the sidebar**

A running log of your actions — training completions, account plan saves, and rep profile updates. Useful to review before a 1:1 with your manager.

---

### Leaderboard

**Path: Leaderboard in the sidebar**

How you stack up against your teammates. The composite score is built from five factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Skill | 40% | Your average training score |
| Discipline | 20% | Number of training sessions completed |
| Growth | 15% | Your current level |
| Performance | 15% | Your comp status (accelerated tier earns more points) |
| Execution | 10% | How many accounts have active growth plans |

By default the board shows the top 4 reps plus your own position. Click **Show All Reps** to see the full roster.

**Team Shoutouts** appear at the bottom of this page. You can post a message (up to 160 characters) to congratulate a teammate, light a fire under them, or just talk a little trash. React to posts with 🔥 👏 💪.

---

### Prize Leaderboard

**Path: Prize Leaderboard in the sidebar**

For reps hired within the last 6 months, each day's top 3 AI Simulator scores earn prizes:

| Place | Cash | GeniusDollars |
|-------|------|--------------|
| 1st | $10 | 100 GD |
| 2nd | $6 | 65 GD |
| 3rd | $3 | 30 GD |

This page shows today's standings, past winners, and your all-time earnings.

---

### Level Progress

**Path: Level Progress in the sidebar**

There are 5 advancement tiers:

| Level | Title | Requirements |
|-------|-------|-------------|
| 1 | Associate AE | Starting point |
| 2 | Account Executive I | 3+ sessions, 60+ avg score |
| 3 | Account Executive II | 6+ sessions, 70+ avg score |
| 4 | Senior Account Executive | 10+ sessions, 80+ avg score |
| 5 | Strategic Growth Leader | 15+ sessions, 90+ avg score |

Your progress bar shows exactly how far you are on both the session count and score requirements. You need to meet **both** to advance.

---

### Rep Metrics

**Path: Rep Metrics in the sidebar**

This is where you enter your monthly KPI data so the app can calculate your compensation status.

**Fields to fill in:**
- Start date (your hire date)
- Monthly revenue
- Captures (new accounts opened)
- Customers sold

**What it calculates:**
- Whether you're in your ramp period (first 28 days — no KPI measurement)
- Whether you've hit all three KPIs for the month
- Your estimated monthly compensation including base, commission, and bonuses
- Exactly which KPIs you're missing if you're short

---

### GeniusDollars

**Located at the bottom of your Dashboard**

GeniusDollars (GD) are earned by completing training and placing in the daily prize leaderboard. You can redeem them for real experiences.

**Redeeming on your own:**
Scroll to the GeniusDollars section on your Dashboard. Click any reward you can afford. If you don't have enough GD, the card shows how many more you need.

| Reward | Cost |
|--------|------|
| Team Pizza Party (up to 10 people) | 2,500 GD |
| Studio Session — 2 Hours (Earthtone Analog) | 5,000 GD |
| Studio Session — Half Day | 9,000 GD |
| Private Event — Target Practice Demo | 12,000 GD |
| Private Event — Cookout (up to 20 guests) | 15,000 GD |
| Private Event — Live Music Night (up to 30 guests) | 20,000 GD |

**Pooling with your team:**
You can combine GeniusDollars with teammates toward a shared reward.

- Click **+ Start a Pool** to create a new pool — pick a reward, enter your opening pledge, and add an optional note for your teammates
- Active pools show a progress bar, each contributor's pledge, and how far you are from the goal
- Click **Add My Pledge** on any open pool to contribute your GD
- You can update or remove your pledge at any time before the pool is funded
- When the pool reaches 100%, any team member can click **Redeem for Team** to submit the request

---

### Refer & Earn

**Located on your Dashboard and on the Employees page**

Know someone who would be a great fit at Orion? Submit a referral and earn cash bonuses when they join and stick around.

**Bonus structure:**
- **$100** when the candidate is hired and starts their first day
- **$150** additional after they complete 90 days
- **$250 total** per successful hire

**How to submit a referral:**
1. Click **Refer Someone** on your Dashboard (or **+ Refer a Candidate** on the Employees page)
2. Enter the candidate's name, email, phone, your relationship to them, and the position they're interested in
3. Click **Submit Referral**

Your Dashboard will show the status of each referral you've submitted (Submitted → Employee Started → 90-Day Complete) and your total earned bonuses.

---

### Remote Sales Associate (RSA) Role

If your role in the directory is set to **Remote Sales Associate (RSA)**, your Dashboard and Employees profile use the remote compensation model instead of the standard AE plan.

**Who this is for**

RSAs are high-volume outbound reps working from anywhere in the country. The role rewards activity, AI-graded call quality, dealer relationship-building, captures, and long-term revenue participation — not just hours worked.

**Login**

Same as any other rep. Your email is in the company directory; your default password is `{RepCode}@Orion` (e.g., `MRR@Orion`).

---

#### Your Dashboard KPIs

| Card | What It Tracks |
|------|---------------|
| Calls Completed | Connected outbound calls this month, with an average per-working-day rate |
| Average AI Score | The AI's rolling average of your call quality (0–100) plus your tier label and multiplier |
| Qualified Engagements | Conversations where the dealer asked for pricing, requested follow-up, discussed inventory, etc. |
| New Dealer Captures | New accounts won this month |

---

#### How Your Comp Is Calculated

Your monthly pay is the sum of four pillars:

| Pillar | Formula |
|--------|---------|
| **Call Pay** | `Calls × Base per-call rate × Score Multiplier` |
| **Engagement Bonus** | `Qualified conversations × $6` |
| **Capture Bonus** | `New dealer accounts × $30` |
| **Revenue Participation** | `Paid invoiced revenue × 0.15%` |

The base per-call rate is **$0.75**. Your AI-graded call score determines a multiplier on top of that:

| Score | Tier | Multiplier | Effective Per-Call Rate |
|-------|------|------------|------------------------|
| 50–59 | Weak | 0.8x | $0.60 |
| 60–69 | Developing | 1.0x | $0.75 |
| 70–79 | Good | 1.2x | $0.90 |
| 80–89 | Strong | 1.5x | $1.13 |
| 90–100 | Elite | 2.0x | $1.50 |

*Translation:* lifting your average AI score by ten points can effectively double the value of every single call you complete.

---

#### Daily and Monthly Targets

| Metric | Target |
|--------|--------|
| Daily calls | 90 |
| Monthly calls | 1,980 (~22 working days) |
| Average AI score | 80+ (Strong tier) |
| Qualified engagements | 75/month |
| New dealer captures | 12/month |

Hitting these isn't required to earn — every call pays — but they unlock leaderboard recognition, advancement, and the larger comp tiers.

---

#### Compensation Status Panel

The Compensation Status card on your Dashboard shows:

- **Employment Month** — how long you've been at Orion
- **Calls Completed** and **Average AI Score**
- **Score Tier** and the **Effective Per-Call Rate** that tier earns you
- **Qualified Engagements** and **New Captures**
- **Total Estimated Comp** for the current month
- **+10 Score Upside** — exactly how much additional pay you'd earn by raising your average AI score by ten points

The status pill (Elite / Strong / Good / Developing / Weak) reflects which multiplier tier you're currently earning.

---

#### Example Monthly Earnings

| Profile | Calls | Avg Score | Engagements | Captures | Revenue | Total |
|---------|-------|-----------|-------------|----------|---------|-------|
| Entry-Level | 1,800 | 72 | 42 | 7 | $120K | ~$2,250/mo |
| Strong Rep | 2,100 | 88 | 108 | 17 | $565K | ~$4,362/mo |
| Elite National Rep | 2,200 | 95 | 200 | 34 | $1.67M | ~$8,000/mo |

The single biggest lever is your AI call score — practice in the simulator before live dials.

---

#### How to Improve Your Tier

1. **Run AI Simulator sessions before your dial blocks.** This is the fastest path to a higher AI score, which immediately raises your per-call rate.
2. **Convert connected calls into qualified conversations.** Pricing asks, follow-up commitments, inventory discussions — each one is worth $6.
3. **Push for new dealer captures.** Each capture is worth $30 immediately, plus long-tail revenue participation.
4. **Build a book.** The 0.15% revenue participation rewards reps who nurture dealers into repeat customers.

---

## 3. Manager Guide

Managers have access to everything in the Sales Executive guide above, plus the pages below.

---

### Manager View

**Path: Manager View in the sidebar**

Your coaching command center. This page is divided into several sections.

---

#### Sales Executive Comparison

A table showing every rep side by side with:
- Employment month and KPI measurement status
- Comp status (Ramp Buffer / Accelerated / Base Tier / Not Qualified)
- Training sessions completed and average score
- Current level
- Missed upside (estimated commission they're leaving on the table)

Use this to quickly spot who needs a check-in before month end.

---

#### Coaching Alerts

Auto-generated signals ranked by severity (High / Medium / Low). Each alert shows:
- The rep's name
- The issue (skill gap, low activity, training gap, execution gap)
- A recommended action

These update automatically as rep data changes.

---

#### Real Calls vs. Simulator Practice

A side-by-side comparison of each rep's RingCentral call activity (imported) against their AI Simulator practice sessions. Helps you see who is practicing and whether practice is translating to real call volume.

---

#### Rep Performance Leaderboard

A combined score ranking based on:
- Simulator skill score (50%)
- Call activity volume (20%)
- Connection rate (30%)

---

#### Simulator Activity

A filterable table of every simulator session across the team. You can filter by:
- Rep name
- Dealer name
- Score range (or use the sort to surface lowest scores first)

Each row shows the session score, customer type, difficulty, key coaching notes, and a severity pill (Strong / Watch / Coach / Review).

---

#### RingCentral Call Activity

Imported call logs showing direction (inbound/outbound), result (connected, voicemail, missed), duration, and notes. Import new call data via Admin → Import → RingCentral Calls tab.

---

#### New Hire Prize Leaderboard

Same prize standings view as reps see, but with one extra button: **Record Today's Winners**. Click it to capture the day's top 3 simulator scores and credit their prizes. This should be done once at the end of each business day.

---

### Employees

**Path: Employees in the sidebar**

The full company roster with search and sort.

**To find someone:**
- Type their name in the search box
- Sort by hire date, name, or location using the dropdown

**Click any employee** to see their full profile: name, rep code, phone, email, location, hire date, and tenure.

The **+ Refer a Candidate** button at the top of this page opens the referral form — convenient when you're looking at the roster and thinking about who else would fit the team.

---

### Newsletter (Orion Insider)

**Path: Newsletter in the sidebar**

The Orion Insider is the company's bi-weekly employee newsletter. This dashboard is where managers and admins build each issue, preview it live, and publish it. The published newsletter is readable by anyone at the public `/newsletter` link — handy for emailing to the whole team.

The page is laid out with **content forms on the left and a live preview on the right**. Anything you add appears in the preview instantly so you can see the finished issue as you build it.

---

#### The Bi-Weekly Workflow

1. Open **Newsletter** from the sidebar.
2. Work through the five tabs (below), filling in what you want in this issue.
3. Watch the live preview update on the right.
4. Click **Generate** to publish the issue to `/newsletter`.
5. Use **Export PDF** and/or **Email to Employees** to distribute it.

Each issue is self-contained: when you open the dashboard, you only see content added **since the last issue you published**, so every cycle starts with a clean slate. After you click Generate, the working set clears automatically and the next cycle begins.

---

#### The Five Tabs

| Tab | What It Does |
|-----|-------------|
| **Issue Setup** | Name the issue, set the issue date, and pick the opening joke |
| **Add Review** | Add a customer or employer review (positive **or** critical) |
| **Add Shout-Out** | Recognize an employee |
| **Add Company Update** | Post an announcement, milestone, or news item |
| **New Hires** | Add new team members, or quick-add them from the roster |

---

#### Opening Joke

On the Issue Setup tab, the **Opening Joke** is pulled from the company joke library and pre-filled with one that hasn't been used recently. You can:

- Edit the text directly in the box for this issue
- Click **🎲 Shuffle joke** to rotate to a different one (the small tag shows its category and how many times it has run)

When you Generate the issue, the selected joke is marked as used so future issues favor fresh jokes.

---

#### Adding Reviews (including critical ones)

Orion shares **both glowing and critical reviews** for transparency. To add one:

1. Go to the **Add Review** tab
2. Pick the **Source** (Google, Glassdoor, Indeed, Facebook, etc.)
3. Set the **Rating** (1–5 stars)
4. Enter the **Reviewer Name** and **Review Text**
5. *(Optional but recommended for critical reviews)* Fill in the **Leadership Response** — a short note on how leadership is addressing the feedback
6. Click **Add Review**

In the newsletter, positive reviews show with a gold accent and critical reviews (3 stars or fewer) show with a muted gray accent, so honest feedback reads as honest feedback rather than a celebration. If you added a Leadership Response, it appears in an "Our response" box directly under the review.

---

#### Adding Shout-Outs

On the **Add Shout-Out** tab, enter the **Employee Name**, their **Department**, who it's **Submitted By** (auto-filled with your name), and the **Shout-Out Text**. Click **Add Shout-Out**. It saves immediately and appears in the Recognition section of the preview.

---

#### Adding Company Updates

On the **Add Company Update** tab, enter a **Category**, **Date**, **Title**, and **Description**, then click **Add Update**. Updates appear in the "Company Updates" section.

---

#### Adding New Hires

On the **New Hires** tab you can either:

- Type a new hire in manually (Name, Department, Title, Start Date) and click **Add Hire**, or
- Click any name under **Quick-add from roster** to pull a recent hire straight from the employee directory

Selected hires are listed below and can be removed before you publish. New hires are grouped by department in the newsletter's "New Team Members" section.

---

#### Publishing and Distributing

The top toolbar has three buttons:

| Button | What It Does |
|--------|-------------|
| **Generate** | Publishes the current issue (joke + new hires + everything in the preview) to the public `/newsletter` page and starts the next cycle |
| **Export PDF** | Opens your browser's print dialog to save the newsletter as a PDF |
| **Email to Employees** | Opens a pre-filled email to the whole roster (bcc'd) with a link to the live newsletter |

> **Tip:** Reviews, shout-outs, and updates save to the database the moment you click their "Add" button. The joke and new-hire list are only saved when you click **Generate**. So always click Generate to lock in the full issue before exporting or emailing.

---

## 4. Admin Guide

Admins have access to everything Managers see, plus the pages below.

---

### Admin View

**Path: This is your default landing page after login**

A financial and operational overview of the whole company.

---

#### Financial Summary

Monthly financial snapshot:
- Total revenue
- Cost of goods sold (COGS)
- Gross profit
- Total commission liability (estimated pay across all reps)
- Net contribution after commissions

*This data comes from your Microsoft Business Central integration. If BC is not connected, demo figures are shown. See [Section 5](#5-connecting-integrations) for setup instructions.*

---

#### Integration Status

Shows whether your three data integrations are active:

| Integration | Purpose |
|-------------|---------|
| Microsoft Business Central | Revenue, COGS, open orders, invoices |
| FedEx | Shipment tracking (pending, in-transit, delivered, exceptions) |
| RingCentral | Auto-sync call logs |

See [Section 5](#5-connecting-integrations) for step-by-step setup instructions for Business Central and RingCentral.

---

#### Rep Revenue & Commission Summary

A full table of all reps ranked by monthly revenue showing:
- Revenue contribution
- Commission rate tier
- Estimated monthly payout

---

#### Prize Program Cost

Tracks the daily cash prizes paid out through the new hire leaderboard program so you can monitor budget.

---

#### Employee Referral Program

A table of every candidate referral submitted by your team showing:
- Candidate name and contact info
- Who referred them and when
- Current status (Submitted / Employee Started / 90-Day Complete)
- Bonus owed to the referring rep

**To advance a referral's status:**
1. Find the referral in the table
2. Click **Mark Started** when the candidate's first day arrives (triggers the $100 bonus)
3. Click **Mark 90-Day** when they complete 90 days (triggers the $150 bonus)

The total bonuses paid to date are shown in the section header.

---

### Admin Import

**Path: Click the Import Data button on the Admin View page**

Use this to load data into the app. There are four tabs. See [Section 6](#6-importing-your-customer-list-from-excel) for a detailed guide on importing your customer list from Excel.

---

#### Employees Tab

Paste a JSON array of employee records to add new hires to the roster.

Each record needs:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@orionwholesaleonline.com",
  "code": "JDO",
  "location": "IN",
  "phone": "812-555-0100",
  "hireDate": "2026-05-01"
}
```

*Note: The core employee roster is built into the app. Use this tab when adding new hires after launch.*

---

#### Contacts Tab

Paste your dealer and prospect data. These records populate the Accounts page for every rep.

Each record needs:

```json
{
  "accountName": "ABC Firearms",
  "contactName": "John Smith",
  "phone": "8125551234",
  "email": "john@abc.com",
  "assignedRep": "CJF",
  "territory": "IN",
  "status": "Prospect"
}
```

See [Section 6](#6-importing-your-customer-list-from-excel) for how to export this from Excel.

---

#### Products Tab

Paste your SKU catalog. This gives the AI Simulator product context when reps build orders during practice calls.

Each record needs:

```json
{
  "sku": "AMMO-9MM-115",
  "name": "9mm 115gr FMJ Ammo",
  "category": "Ammunition",
  "brand": "Orion Select",
  "dealerPrice": 12.99,
  "retailPrice": 17.99,
  "inventory": 500
}
```

---

#### RingCentral Calls Tab

Paste exported call log data from RingCentral. Each record needs:

```json
{
  "sessionId": "rc-001",
  "repCode": "CJF",
  "repName": "Chase Farmer",
  "direction": "Outbound",
  "result": "Connected",
  "durationSeconds": 245,
  "dealerName": "ABC Firearms",
  "contactName": "John Smith",
  "startedAt": "2026-04-27T10:15:00Z",
  "notes": "Discussed hunting inventory and next order."
}
```

---

#### Load Demo Data

Click **Load Demo Data** on any tab to populate the app with sample records. Use this to preview how each section looks before loading real data.

---

## 5. Connecting Integrations

Both integrations below require someone with access to your company's cloud accounts (Azure for Business Central, RingCentral for call logs). Once the credentials are obtained, they get added to the Vercel project as environment variables — your GeniusSeeker contact can do this in about 5 minutes.

---

### Connecting Microsoft Business Central

Business Central uses **OAuth 2.0** to authenticate. You'll need access to the Azure portal and Business Central admin.

**Step 1 — Register an app in Azure**

1. Go to [portal.azure.com](https://portal.azure.com) and sign in with your Microsoft 365 admin account
2. Search for **App registrations** and click **New registration**
3. Name it something like `Orion GeniusSeeker Integration`
4. Leave redirect URI blank and click **Register**
5. On the app overview page, copy the **Application (client) ID** — this is your `BC_CLIENT_ID`
6. Copy the **Directory (tenant) ID** — this is your `BC_TENANT_ID`

**Step 2 — Create a client secret**

1. In the app registration, go to **Certificates & secrets → New client secret**
2. Give it a description and set an expiration (12 or 24 months recommended)
3. Click **Add** and immediately copy the **Value** — this is your `BC_CLIENT_SECRET`
   *(You cannot retrieve it again after leaving this screen)*

**Step 3 — Grant Business Central API permissions**

1. Still in the app registration, go to **API permissions → Add a permission**
2. Choose **Dynamics 365 Business Central**
3. Select **Delegated permissions** and check **Financials.ReadWrite.All** (or **API.ReadWrite.All**)
4. Click **Grant admin consent** so the permission takes effect immediately

**Step 4 — Find your BC environment and company details**

1. Open Business Central and go to **Settings → About Business Central**
2. Note your **Environment name** (usually `production`) — this is `BC_ENVIRONMENT`
3. Go to **Settings → Company Information**
4. In the URL bar, copy the GUID after `/companies/` — this is `BC_COMPANY_ID`

**Step 5 — Add the credentials to Vercel**

Provide these five values to your GeniusSeeker contact to add to the Vercel project:

| Variable | Where to find it |
|----------|-----------------|
| `BC_TENANT_ID` | Azure → App registration overview |
| `BC_CLIENT_ID` | Azure → App registration overview |
| `BC_CLIENT_SECRET` | Azure → Certificates & secrets |
| `BC_ENVIRONMENT` | Business Central → About page |
| `BC_COMPANY_ID` | Business Central URL (GUID after `/companies/`) |

Once added, the Admin View financial section will show live data instead of demo figures. The integration status indicator will turn green.

---

### Connecting RingCentral

RingCentral uses **JWT authentication** for server-to-server calls — no user login required after setup.

**Step 1 — Create a RingCentral app**

1. Go to [developers.ringcentral.com](https://developers.ringcentral.com) and sign in with your RingCentral admin account
2. Click **Create App**
3. Select **Server/Bot** as the app type and **No User Interface**
4. Name it `Orion GeniusSeeker Integration`
5. Under **OAuth Scopes**, add the following:
   - `ReadCallLog`
   - `Analytics`
   - `ReadAccounts`
6. Click **Create**

**Step 2 — Get your app credentials**

1. On the app dashboard, copy the **Client ID** — this is `RINGCENTRAL_CLIENT_ID`
2. Copy the **Client Secret** — this is `RINGCENTRAL_CLIENT_SECRET`

**Step 3 — Generate a JWT credential**

1. Go to **App Settings → Credentials**
2. Click **Create JWT**
3. Select your admin account as the associated user
4. Copy the JWT string — this is `RINGCENTRAL_JWT_TOKEN`

**Step 4 — Find your account ID**

For most accounts this is simply `~` (a tilde), which tells RingCentral to use the main account. Only change this if you have a multi-account setup.

**Step 5 — Add the credentials to Vercel**

Provide these four values to your GeniusSeeker contact:

| Variable | Where to find it |
|----------|-----------------|
| `RINGCENTRAL_CLIENT_ID` | RingCentral app dashboard |
| `RINGCENTRAL_CLIENT_SECRET` | RingCentral app dashboard |
| `RINGCENTRAL_JWT_TOKEN` | App Settings → Credentials → Create JWT |
| `RINGCENTRAL_ACCOUNT_ID` | Use `~` unless instructed otherwise |

Once added, the Manager View will auto-sync call logs from RingCentral instead of relying on manual imports. The integration status indicator will update accordingly.

**In the meantime — manual import:**
You can export call logs from RingCentral as a CSV and convert them to JSON for manual import via the RingCentral Calls tab in Admin Import. See your RingCentral admin portal under **Analytics → Call Log → Export**.

---

## 6. Importing Your Customer List from Excel

The Accounts page is populated from your customer/dealer contact list. Here is how to get your existing Excel data into the app.

---

### Step 1 — Prepare your Excel file

Make sure your spreadsheet has these column headers. The names must match exactly (they are not case-sensitive):

| Column | Description | Example |
|--------|-------------|---------|
| `accountName` | Dealer or store name | ABC Firearms |
| `contactName` | Primary buyer's name | John Smith |
| `phone` | Contact phone number | 8125551234 |
| `email` | Contact email | john@abc.com |
| `assignedRep` | Rep's code (3 letters) | CJF |
| `territory` | State abbreviation | IN |
| `status` | Account status | Active or Prospect |

**Optional columns** (include if you have them — they will appear in the account detail view):

| Column | Description | Example |
|--------|-------------|---------|
| `lastMonthSales` | Last month's revenue from this account | 18500 |
| `currentMonthTarget` | This month's revenue target | 22000 |
| `location` | City or region | Evansville |
| `notes` | Any free-form notes | Strong repeat buyer |

---

### Step 2 — Convert your Excel file to JSON

The import tab accepts JSON format. The easiest way to convert:

**Option A — Google Sheets (recommended)**
1. Open your Excel file in Google Sheets
2. Click **Extensions → Apps Script**
3. Paste this script and click Run:

```javascript
function exportToJson() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function(h, j) { row[h] = data[i][j]; });
    rows.push(row);
  }
  Logger.log(JSON.stringify({ contacts: rows }, null, 2));
}
```

4. Open **View → Logs** — your JSON will be there. Copy it.

**Option B — Free online converter**
Search for "CSV to JSON converter" and use any reputable free tool. Upload your file, download the JSON, then wrap the result in `{ "contacts": [ ... ] }`.

**Option C — Save as CSV and convert manually**
1. In Excel: **File → Save As → CSV**
2. Use a tool like Notepad++ or VS Code to view the CSV
3. Format it manually if your list is small (under 20 accounts)

---

### Step 3 — Paste into the Import Hub

Your JSON should look like this:

```json
{
  "contacts": [
    {
      "accountName": "ABC Firearms",
      "contactName": "John Smith",
      "phone": "8125551234",
      "email": "john@abc.com",
      "assignedRep": "CJF",
      "territory": "IN",
      "status": "Active",
      "lastMonthSales": 18500,
      "currentMonthTarget": 22000
    },
    {
      "accountName": "XYZ Guns",
      "contactName": "Mike Johnson",
      "phone": "5025550192",
      "email": "mike@xyzguns.com",
      "assignedRep": "JMF",
      "territory": "IN",
      "status": "Active",
      "lastMonthSales": 12000,
      "currentMonthTarget": 15000
    }
  ]
}
```

1. Go to **Admin View → Import Data → Contacts tab**
2. Paste your JSON into the text area
3. Click **Import contacts**
4. The app will confirm how many records were imported
5. Go to the **Accounts** page — your dealers will now appear in the list

---

### Tips

- **Rep codes must match exactly.** If a rep code in your spreadsheet doesn't match a code in the system (e.g., `CJF` vs `cjf`), the account will still import but won't filter correctly by rep. Check your codes in the Employees page.
- **Importing again replaces existing records.** If you import a second time, the new records are merged with the existing ones — duplicates may appear. Contact your GeniusSeeker admin if you need to reset the account list.
- **Phone numbers don't need formatting.** Plain digits work fine: `8125551234` or `(812) 555-1234` both import correctly.
- **Large lists import fine.** There is no row limit — if you have 500 accounts, paste the full JSON and import it all at once.

---

## Quick Reference: Login Credentials

| Role | Email Format | Password Format |
|------|-------------|----------------|
| Account Executive (AE) | Listed in company directory | `{RepCode}@Orion` (e.g., `JMF@Orion`) |
| Remote Sales Associate (RSA) | Listed in company directory | `{RepCode}@Orion` (e.g., `MRR@Orion`) |
| Manager | Your work email | Provided by admin |
| Admin | Your work email | Provided by admin |

---

## Quick Reference: What Lives Where

| I want to… | Go to… |
|-----------|--------|
| Understand how my role's comp model works | Dashboard → Compensation Status (or [RSA section](#remote-sales-associate-rsa-role) for remote reps) |
| See my compensation status | Dashboard or Rep Metrics |
| Search the national FFL database | FFL Prospect Hub |
| Add a new dealer prospect to my Accounts | FFL Prospect Hub → Convert to Account |
| Practice a cold call against a real FFL | FFL Prospect Hub → 🎯 Practice Cold Call |
| Practice a sales call | AI Sales Simulator |
| Complete a written training | Training |
| Update a dealer's growth plan | Accounts |
| See where I rank on the team | Leaderboard |
| Post a shoutout to teammates | Leaderboard → Team Shoutouts |
| Check my prize earnings | Prize Leaderboard |
| View my level and what's next | Level Progress |
| Redeem or pool GeniusDollars | Dashboard → GeniusDollars section |
| Refer a candidate | Dashboard → Refer & Earn, or Employees page |
| Track my referral bonuses | Dashboard → Refer & Earn card |
| See my team's coaching alerts | Manager View |
| Review a rep's simulator sessions | Manager View → Simulator Activity |
| Build or publish the company newsletter | Newsletter |
| Add a customer or employer review (incl. critical) | Newsletter → Add Review |
| Recognize an employee in the newsletter | Newsletter → Add Shout-Out |
| Email the newsletter to the whole team | Newsletter → Email to Employees |
| Record today's prize winners | Prize Leaderboard or Manager View |
| Advance a referral status | Admin View → Referral Program |
| See company financials | Admin View |
| Import customer data | Admin View → Import Data → Contacts |
| Connect Business Central | Section 5 of this manual |
| Connect RingCentral | Section 5 of this manual |

---

*For technical support or to report an issue, contact your GeniusSeeker administrator.*
