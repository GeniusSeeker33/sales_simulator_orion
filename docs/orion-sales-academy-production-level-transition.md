# Orion Sales Academy production-level transition architecture audit

**Status:** architecture/data-contract audit only; no implementation, migration, hosted Supabase change, deployment, or reinterpretation of existing records is authorized by this document.
**Business reference:** `GeniusSeeker33/geniusseeker-talent-success-platform#27`.
**Repository snapshot audited:** the current branch of `GeniusSeeker33/sales_simulator_orion` on 2026-09-08.

## Executive conclusion

Orion currently has **two different training-derived uses of “level”**:

1. a browser/demo level calculated automatically from completed training-session count and average AI score; and
2. a durable, private, append-only `learner_progression` model in which a human progression review can advance an episode from L1 through L5 only after referencing human B1–B5 reviews across C01–C15 and explicitly confirming the pinned framework requirements.

Neither is a trustworthy trailing-90-day production level. Re-labeling either implementation in place would silently change the meaning of old L1–L5 values. That is unsafe.

The safe target keeps independently governed facts separate:

* **sales stage/status** — `orion_sales_academy`, `ramp_certified_establishing_baseline`, and the later eligibility for an official production level;
* **sales production performance** — L1–L5, based on trailing-90-day **average monthly production** at a closed, governed evaluation point;
* **individual competency proficiency** — a separate B1–B5/defer decision for each C01–C15 competency; and
* **overall Behavioral Level** — a new human-reviewed B1–B5/defer summary used with L1–L3 in a combined designation such as L3B2.

Keep all existing records immutable. Freeze the existing durable L-history as the historical meaning encoded by framework `orion-sales/0.1-draft`; do not present it as the new performance level. Introduce separate future production-performance and overall-behavioral ledgers whose records carry explicit framework/policy versions and exact source references. Sales stage must also be separate: Ramp Certified and Establishing Baseline precede the first official L-level and are never aliases for L1. Individual C-bands must never be silently promoted into the new overall Behavioral Level.

---

## 1. Current-state architecture

### 1.1 Verified identity and episode boundary

`public.learner_bindings` is the identity projection linking the authenticated user to `person_id`, `employment_episode_id`, organization/role scope, and source provenance. A binding is immutable; correction is revoke-and-replace through `supersedes_id`. One active binding is allowed per authenticated user. Training attempts and simulation sessions repeat the binding/person/episode tuple and can be read only by the active bound learner. (`supabase/migrations/20260905170811_durable_learner_records.sql`: 2–25, 28–79, 82–109.)

Manager/coach access is an explicit `learner_review.scopes` grant to one learner binding. Its read RPC returns only the granted episode, and a retired binding requires its own historical scope. (`supabase/migrations/20260905175922_scoped_reviewer_history.sql`: 1–30, 47–101.) The common authorization helper subsequently used by coaching, competency, band, and progression publication requires an active binding for writes, an authorized separate reviewer, and a valid approved/unexpired/unrevoked scope. (`supabase/migrations/20260905181617_attributable_coaching_sessions.sql`: 62–93.)

This episode boundary is the correct anchor for future stage, production observation, and production-performance records. A shared `person_id` is not permission to inherit state from an earlier employment episode.

### 1.2 Durable training and coaching

Verified training attempts and simulation sessions preserve source/system/environment/project metadata, status, timestamps, content/criteria references, and revisions. `finish_learner_attempt` permits explicit terminal states, including `technical_failure`; AI scoring is data on a practice attempt rather than an employment or level action. (`supabase/migrations/20260905170811_durable_learner_records.sql`: 28–79, 113–172.)

`learner_coaching.sessions` is attributable to the learner episode, coach, exact reviewer scope, competency model version, C01–C15 targets, source evidence, observed behavior, development action, and follow-up status. Sessions and learner acknowledgments/comments are append-only. Corrections create a new revision with `supersedes_id` and a reason; only the original coach can correct the latest version. (`supabase/migrations/20260905181617_attributable_coaching_sessions.sql`: 6–59, 93–187.)

### 1.3 Competency evidence and B1–B5

`learner_competency.evidence` records one human finding about one competency (`C01`–`C15`) under `orion-sales/0.1-draft`. Allowed sources are AI practice, human coaching, and (reserved) real-world work; allowed findings are `supports`, `does_not_yet_support`, `insufficient_opportunity`, `technical_failure`, and `disputed`. Technical/abandoned practice cannot support a scored finding, and the current RPC deliberately disables publication from an ungoverned real-world source. Evidence is private, append-only, episode-scoped, exact-revision referenced, and corrected by supersession. (`supabase/migrations/20260905191217_human_reviewed_competency_evidence.sql`: 2–31, 33–124.)

`learner_band.reviews` is one human decision for one C-code and version. The reviewer explicitly selects B1–B5 or `defer`, provides a rationale, and references current human-reviewed competency evidence. A substantive band requires at least one `supports` or `does_not_yet_support` finding; the database does not calculate or recommend a band. Band records are append-only and use same-reviewer correction lineage. (`supabase/migrations/20260905192514_human_approved_competency_band_review.sql`: 2–31, 33–106.)

### 1.4 Durable human progression and official history

`learner_progression.reviews` stores a reviewer’s explicit remain, adjacent advance, or defer decision. It stores both framework and competency version, the current-level snapshot, source/observed history heads, snapshots of exact band and supporting-evidence references, rationale, development plan, explicit framework confirmation, reviewer/time, and correction lineage. `learner_progression.level_history` stores immutable L1–L5 events and their predecessor chain. (`supabase/migrations/20260905194609_human_approved_progression.sql`: 1–55.)

There is no implicit initial level. A private administrator-only function can initialize only L1, once per binding, from a separately documented human approval. (`supabase/migrations/20260905194609_human_approved_progression.sql`: 56–73.) Publication:

* locks an episode and rechecks authorization;
* requires the exact currently observed history head;
* allows remain/defer or a single adjacent advancement;
* validates current, same-episode, same-version band/evidence references;
* requires all 15 non-deferred human band decisions and explicit framework confirmation for advancement; and
* atomically appends an advancement/correction history event when required.

It does **not** average bands or automatically choose an outcome. (`supabase/migrations/20260905194609_human_approved_progression.sql`: 75–147.) Read access derives “current level” from the latest event in that episode and exposes review/history lineage through a bounded RPC. (`supabase/migrations/20260905194609_human_approved_progression.sql`: 149–178.)

### 1.5 Separate legacy/demo browser level

The runnable application also contains a materially different, non-authoritative level system:

* `Levels.jsx` reads local browser training results and automatically selects one of five titles using session-count/average-score thresholds: 0/0, 3/60, 6/70, 10/80, and 15/90. It describes this as live advancement and training results “contributing to progression.” (`src/pages/Levels.jsx`: 3–82, 84–100, 102–215, 304–351.)
* The same five thresholds/titles and automatic calculation are duplicated in `Dashboard.jsx`, `Leaderboard.jsx`, and `ManagerView.jsx`; leaderboard/manager composite readiness also assigns a 15% level contribution. (`src/pages/Dashboard.jsx`: 42–80, 1039–1054; `src/pages/Leaderboard.jsx`: 17–23, 516–532; `src/pages/ManagerView.jsx`: 26–32, 1351–1365.)
* `src/context/AppState.jsx` and `src/data/dashboard.js` contain still another static app/demo “level” representation. (`src/context/AppState.jsx`: 6–10, 183–227; `src/data/dashboard.js`: 49–58.)

These browser values are neither bound to a verified learner episode nor backed by `learner_progression.level_history`. They must not be migrated as trusted competency or production levels.

## 2. Current L1–L5 semantics

### 2.1 Durable semantics: competency-gated human progression

The durable framework version is hard-pinned to `orion-sales/0.1-draft`. Every episode begins unavailable, may receive a private human-approved initial L1, and thereafter progresses only one adjacent level. Advancement requires one current non-deferred B-review for every C01–C15 plus explicit human confirmation of all framework requirements. (`supabase/migrations/20260905194609_human_approved_progression.sql`: 8–22, 27–42, 56–73, 115–137.)

Thus, while human—not AI—approval makes the decision, competency coverage is a database-enforced gate to L-advancement. The current data lineage is:

```text
verified attempt/simulation or attributable coaching session
  -> human competency evidence for one C01-C15
  -> human B1-B5/defer review for that C-code
  -> human progression review referencing up to one current band per C-code
  -> append-only L1-L5 history event (only on advancement/correction)
```

The source evidence is snapshotted by exact ID/revision. Later source supersession is surfaced, but it does not silently rewrite the band, progression decision, or L-history. Remain/defer ordinarily creates a progression review without a history event. (`supabase/migrations/20260905194609_human_approved_progression.sql`: 119–147, 157–170.)

### 2.2 Browser semantics: AI-practice gamification/readiness

The browser implementation calls L1–L5 titles ranging from “Associate AE” to “Strategic Growth Leader” and derives them from training quantity and average score. The leaderboard presents them as career/readiness progression and uses them within a composite ranking. (`src/pages/Levels.jsx`: 5–82, 317–329; `src/pages/Leaderboard.jsx`: 17–23, 286–300, 516–532.) This is neither the durable competency-gated history nor the approved production meaning.

### 2.3 Why both historical meanings matter

The word “level” is already overloaded. Durable `L2` means a human-approved event under a named draft framework after competency prerequisites; a browser `L2` can mean three practice sessions and an average AI score of 60. Neither states a measurement period, currency, production amount, source transaction set, approval state, or production-policy version. Any in-place rename to “production L2” would make the same token assert a fact its evidence never established.

## 3. New approved business semantics

The target vocabulary is deliberately orthogonal:

| Concept | Values | Meaning / authority |
|---|---|---|
| Sales stage/status | Orion Sales Academy; Ramp Certified — Establishing Baseline | Readiness/onboarding lifecycle. No L-level exists during Academy or before sufficient governed 90-day history. |
| Sales production performance | L1 Foundation; L2 Developing; L3 Growth; L4 Advanced; L5 Elite | Human-confirmed classification of trailing-90-day **average monthly sales production** at a closed official evaluation point. |
| Individual competency proficiency | C01–C15, each independently B1–B5 or defer | Human-reviewed behavioral evidence for one named skill. Example: C01 = B3, C02 = B2. |
| Overall Behavioral Level | B1–B5 or defer | A new human-reviewed, episode-specific behavioral summary based on current approved competency evidence/bands. It is not an average and does not yet exist in the repository. |
| Combined designation | L1B1–L1B5, L2B1–L2B5, L3B1–L3B5 | Display composition of two independently approved facts. L3B2 means production L3 and overall behavior B2. L4 and L5 omit the suffix by default. |

Approved production thresholds apply to **average monthly production within the trailing 90-day window**, not to the window total: L1 `[0, $200,000)`, L2 `[$200,000, $300,000)`, L3 `[$300,000, $400,000)`, L4 `[$400,000, $500,000)`, and L5 `[$500,000, +infinity)`. For example, governed monthly-normalized values of approximately $360K, $425K, and $465K yield about $417K average monthly production and therefore an L4 proposal. Summing them to $1.25M and applying the thresholds would be incorrect.

The approved measurement abstraction is a trailing 90-day window evaluated on a defined official cadence, preferably monthly after the evaluation period closes. The exact normalization method is still a governed-policy decision because the current repository has no period-normalized production observations. A later implementation must persist the window boundaries, constituent normalized observations, normalization method, completeness, evaluation date, and computed average; it must not assume that `90_day_total / 3` is always correct for variable month lengths, partial periods, leave, or missing data.

The performance level identifies the business objective: build the book, build consistency, grow the book, maximize the book, or sustain excellence. Competency and overall behavioral data explain what to develop; neither proves sales volume. Conversely, production volume proves neither a C-band nor an overall B-level. L and B are independently sourced facts even when composed for display.

The four Academy weeks are Foundation (“learn before you sell”), Guided Execution (“learn by doing”), Business Development (“build your book”), and Ramp Certification (“ready to own your business”). The approved lifecycle is **Sales Academy → Ramp Certified → Establishing Baseline → official L1–L5 after sufficient production history**. These are stage/status milestones, not extra L-values.

Development assignment is a policy consumer, not part of either assessment ledger: L5 is dismissed from routine Tuesday development; L4 receives a short targeted account-expansion/share-of-wallet lesson and one measurable action, then is dismissed; L1–L3 attend Sales Lab using improv, role play, randomly drawn dealer/customer personalities and scenarios, game-based practice, and potentially Genius Dollar incentives. Overall B-level and detailed C-bands may tailor the emphasis within L1–L3. L1 additionally receives a biweekly Desiree 1:1; L1/L2 and L3/L4 have different Nick Mershon cohorts. No existence of a training program should impose routine remediation on L5.

## 4. Semantic conflicts and gaps

1. **Wrong durable determinant.** Current durable advancement is gated by C01–C15/B1–B5 coverage. New L1–L5 must be determined by governed production, so that gate cannot remain on the production-level path.
2. **Wrong browser determinant.** Current demo L-values are calculated from AI-practice count/score, directly violating the rule that no AI score promotes or demotes.
3. **L1 currently substitutes for initialization.** The durable system can initialize only L1 after a human “learning enrollment” confirmation. The approved lifecycle instead requires Ramp Certified — Establishing Baseline and sufficient governed trailing-90-day history before any L assignment. Low, partial, or missing baseline data is not L1.
4. **No stage ledger.** There is no durable Academy/Ramp Certified model, week/milestone contract, approval event, or stage history.
5. **No production contract.** Existing reports and generated data may display sales/revenue, but nothing in `learner_progression` consumes episode-bound, verified, correction-aware, period-normalized observations for a trailing-90-day average.
6. **The window is approved but normalization is not.** The trailing 90 days and average-monthly meaning are decided; constituent periods, day/month normalization, partial months, time zone, close/reopen behavior, completeness, and evaluation date still require policy.
7. **No semantic discriminator in UI.** “Official level” does not say “legacy competency progression” or “sales performance”; generic `/levels`, leaderboard, dashboard, manager, and topbar labels further conflate them.
8. **No cross-axis state rules.** The approved pre-level state is Ramp Certified — Establishing Baseline, but its entry/exit and sufficient-history rules need governance. A verified low result after sufficient history may be L1; incomplete history may not.
9. **C12 naming hazard.** The competency catalog includes C12 “Sales Outcomes.” It remains behavioral proficiency under the competency version; it must not be treated as the production amount or a shortcut to an L-value. (`src/data/coachingTargets.js`: 1–2.)
10. **No overall Behavioral Level exists.** Existing B1–B5 rows each assess one C-code. They are not an episode-level behavioral summary and cannot be silently reused, averaged, or displayed as LxBx.
11. **Training assignment rules are not governed contracts.** Tuesday dismissal/cohort/1:1 routing, effective dates, exception authority, and whether routing uses current or last confirmed performance level remain to be specified.

## 5. Existing components affected

“Affected” means requiring preservation, retirement, relabeling, adaptation, or an explicit integration decision in a later implementation—not authorization to change it now.

### 5.1 Database objects, migrations, and RPCs

| Artifact | Current coupling | Later treatment |
|---|---|---|
| `public.learner_bindings`, training attempts/simulations; durable-record RPCs (`20260905170811...`) | Identity/episode anchor and AI-practice provenance | Preserve unchanged; reuse binding/episode identity pattern. Never derive performance level from AI fields. |
| `learner_review.scopes`, `read_history` (`20260905175922...`) | Reviewer access to exact episode | Preserve authorization boundary; separately approve who can read/confirm production. Do not widen existing scopes by assumption. |
| `learner_coaching.sessions/responses`, coaching RPCs (`20260905181617...`) | C-targeted development, exact sources, acknowledgment, correction | Preserve. Future assignment references may link without changing coaching semantics or old rows. |
| `learner_competency.evidence`, evidence RPCs (`20260905191217...`) | C01–C15 human evidence; AI only supporting; real-world source currently disabled | Preserve. “Sales production” must not be inserted as fabricated competency evidence; governed real-world behavioral evidence remains a separate future decision. |
| `learner_band.reviews`, band RPCs (`20260905192514...`) | B1–B5/defer proficiency by C-code | Preserve unchanged as proficiency. Remove only its role as a prerequisite of the **new** performance ledger; do not erase its historical role in old progression reviews. |
| `learner_progression.reviews`, `level_history`; `initialize`, `publish`, `read_reviews`; public progression wrappers (`20260905194609...`) | Entire durable legacy L semantics: validation, initialization, adjacency, advancement, correction, read projection | Retain immutable records and RPC behavior for historical interpretation/read access. Do not mutate constraints/version or reuse tables for production. Disable/freeze new legacy writes only through a separately approved rollout plan after cutover readiness. |
| RLS/grants/triggers on every private schema | Privacy, append-only behavior, access boundaries | Preserve. A future schema needs equivalent deny-by-default, RLS, immutable history, controlled RPC, retry, and concurrency design; it does not inherit authorization automatically. |

There are no migrations or database tables in this repository that currently represent Academy stage, Ramp Certified, governed monthly sales observations, production-policy versions, or production-level history.

### 5.2 Runtime helpers, constants, pages, and components

| Files | Impact |
|---|---|
| `src/lib/progressionReviews.js` | Hard-pins the old framework and validates remain/adjacent/defer outcomes. Retain for legacy history while a new production contract gets distinct names/types. |
| `src/components/ProgressionPanel.jsx` | Collects B-review/evidence refs and writes old progression decisions; must become legacy read-only history or a clearly separated competency-development review. It must not determine production L-level. |
| `src/components/CompetencyEvidencePanel.jsx`, `CompetencyBandPanel.jsx`, `review/EvidencePicker.jsx`, `CoachingPanel.jsx`, `LearnerHistory.jsx` | Preserve evidence/band/coaching flows and explicit “not a level” safeguards. Later copy should say “competency proficiency” consistently and link to development without implying performance. |
| `src/pages/MyCoaching.jsx`, `ReviewerHistory.jsx` | Their “Official level / Human-approved history only” summary and embedded progression panel are ambiguous. Show three separately labelled axes; scope each unavailable state independently. |
| `src/pages/Levels.jsx` | Automatic localStorage training-score level is directly conflicting. Retire or rename it as non-authoritative practice milestones; a future Sales Performance view must read governed production, never this calculator. |
| `src/pages/Dashboard.jsx`, `Leaderboard.jsx`, `ManagerView.jsx` | Duplicate thresholds/titles, auto-inference, ranking/composite use, and generic level display all conflict. Production L must never be synthesized from training data, and proficiency must not be reduced to leaderboard rank. |
| `src/components/layout/Sidebar.jsx`, `Layout.jsx`, `Topbar.jsx`; `src/App.jsx` | Route/navigation/tagline/pill say generic level and even hard-code “Level 2 AE”; terminology must identify Sales Performance, Academy/Ramp stage, or competency development. |
| `src/context/AppState.jsx`, `src/data/dashboard.js` | Static/demo level state needs quarantine/removal from authoritative displays. |

### 5.3 Tests and fixtures

Directly affected suites/fixtures are `tests/progression-reviews.test.mjs`, `tests/reviewer-ui/mock-client.js`, `tests/reviewer-ui/workspace.spec.mjs`, plus the embedded progression sentinels in coaching, evidence, and band suites. The progression suite is also the most complete executable specification of old initialization, adjacency, coverage, concurrency expectations, corrections, rehire isolation, privacy, pagination, and append-only history. (`tests/progression-reviews.test.mjs`: 11–187.)

No standalone fixtures directory exists. The SQL seeded inside test files and the reviewer UI mock are the fixtures. `public.progression_levels`, `employment_actions`, and `compensation_instructions` in several tests are sentinel tables proving that competency/coaching publications do not alter unrelated aggregate/HR/pay state; they are not application production tables. (`tests/coaching-sessions.test.mjs`: 35–45, 153–161; `tests/competency-evidence.test.mjs`: 33–43, 134–142; `tests/competency-band-reviews.test.mjs`: 33–43, 132–139.)

### 5.4 Documents and generated collateral

The current meaning is documented in `docs/progression-review-deployment.md` and the progression portions of `docs/orion-mvp-staging-pilot-readiness.md`; both must remain as historical operational documentation and later receive a superseded/frozen notice rather than rewritten claims. Competency separation safeguards appear in `docs/competency-band-review-deployment.md`, `docs/competency-evidence-deployment.md`, and `docs/attributable-coaching-sessions.md` and should remain true.

Generic or stale level claims also occur in `README.md`, `USER_MANUAL.md`, `demo_script.md`, `gap_analysis.md`, `product_reality_check.md`, `generate_deliverables.py`, and `audit_report.md`. Some are historical assessments or generators rather than runtime contracts; later work should label archival statements rather than silently editing history. `src/data/levels.js` uses “level” in ordinary conversational wording and `api/business-central/inventory.js` uses a Business Central API “level” query parameter; neither is an L1–L5 model and must not be mechanically renamed.

## 6. Historical-data risks

Every existing durable `learner_progression.reviews` and `level_history` row would become ambiguous if the meaning changed in place:

* `framework_version='orion-sales/0.1-draft'` describes the old competency progression, not production policy.
* An `initial_confirmation` L1 establishes a human-approved learning baseline, not evidence of `$0–$199,999` in any period.
* An `advancement` event proves an old explicit human decision with all-C competency-band coverage; it stores no sales amount or measurement period.
* A `correction` corrects the old reviewer decision and history head; it is not a corrected invoice/credit memo or production restatement.
* `remain_*` and `defer_insufficient_evidence` outcomes concern the old progression evidence packet, not unchanged production.
* `band_refs`, `supporting_refs`, `framework_requirements_confirmed`, and development plans document why the historical competency progression decision was made. Removing or reinterpreting them would destroy provenance.
* Old read projections expose only `level` and framework values unless consumers deliberately interpret the version. A generic “current L3” display could therefore show legacy L3 as if it were production L3.

Browser/demo levels have even weaker provenance: localStorage can be cleared or edited, is not episode-bound, and uses AI practice. Do not backfill any trusted ledger from it.

Required protection: preserve all old rows, IDs, timestamps, reviewer/scope attribution, exact source snapshots, sequence order, and supersession/predecessor lineage. Never update their framework version. Never infer a production amount, stage, or performance level from them. Export/reporting must include an axis and framework discriminator so two L3 values cannot collapse into one column.

## 7. Recommended versioning strategy

### 7.1 Separate namespaces and ledgers

Use concepts equivalent to these (final identifiers require schema review):

* **Legacy durable axis:** `competency_progression`, framework `orion-sales/0.1-draft`. Existing tables remain the authoritative history for exactly that meaning.
* **Individual competency axis:** `competency_proficiency`, competency model version `orion-sales/0.1-draft` (or later separately approved versions). Existing evidence and per-C B-review tables remain authoritative.
* **Overall behavioral axis:** `behavioral_summary`, with its own approved framework version, immutable human assessment/history, and exact input snapshots. It is not the existing `learner_band.reviews`.
* **Stage axis:** `sales_stage`, with its own stage-framework version and immutable transition history.
* **Performance axis:** `sales_performance`, with a performance-framework version (thresholds/labels) and a distinct measurement-policy version (period/source/calculation rules).

Do not overload `framework_version` to mean both threshold taxonomy and measurement policy. The first answers “which bands/names?”; the second answers “which transactions, period, currency, cut-off, and aggregation?” A level assignment must persist both versions, not merely whatever configuration is current when read.

### 7.2 Cutover behavior

1. Inventory actual deployed legacy rows and consumers outside this repository before choosing a cutover date.
2. Preserve existing RPCs initially for historical reads. Make UI/reporting label their output **Legacy competency progression (framework 0.1 draft)**.
3. Do not dual-write a new production level from an old progression review.
4. Establish stage and governed production observations independently.
5. Only after policy approval and data reconciliation, begin new production-level assignments at a declared effective period. “No new-framework record yet” remains unavailable—not copied legacy L and not implicit L1.
6. Freeze legacy progression creation after an announced boundary only if owners approve the operational effect; preserve its reads/corrections or define a governed historical correction route. Freezing must not break competency evidence, bands, coaching, or acknowledgments.

### 7.3 Read-model rule

Never expose an unqualified `current_level` or `band`. Use explicit projections such as `current_sales_stage`, `current_sales_performance_level`, `current_overall_behavioral_level`, `competency_band_by_code`, and `legacy_competency_progression_level`. APIs/events/exports should include `axis`, `framework_version`, `measurement_policy_version` where applicable, episode, effective period, and record ID. A consumer must not compare or merge levels across framework versions without an approved mapping; no such mapping presently exists.

## 8. Sales Academy / Ramp Certified representation

Represent stage as a separate append-only lifecycle, not as `L0`, `pre_L1`, an L1 initialization kind, or a competency band.

A future stage event minimally needs: immutable ID/sequence; learner binding, person, and employment episode; stage-framework version; from-stage and to-stage; event kind (initial/transition/correction or supersession); effective time; recorded time; actor/approver and authority/scope; approval/source reference; rationale; source environment/project; and predecessor/correction lineage.

Recommended state behavior:

* A newly governed episode can enter `orion_sales_academy`; Academy week/milestone progress belongs to a related versioned program-enrollment/milestone record, not the stage enum.
* Week 4 “Ramp Certification” is the certification activity/milestone. `ramp_certified` becomes effective only upon an explicit authorized human approval that the Academy is complete and the learner is ready to operate.
* Ramp Certified transitions to the status **Establishing Baseline**; it does not create L1. Until sufficient complete trailing-90-day history is closed and confirmed, sales performance is unavailable, not L1.
* Stage and performance can be displayed together as **Ramp Certified — Establishing Baseline** without forcing the status into the L ladder. Academy learners receive no L-level.
* Stage corrections append a new event and retain the original. Revocation/expiry policy for a certification is a leadership decision; do not model it as performance demotion.

## 9. Proposed future sales-production data contract

This is a contract recommendation, not a Business Central integration design. Separate **observations** (trusted amount for a governed period) from **level assignments** (interpretation under a threshold framework).

### 9.1 Minimum production observation

| Field group | Minimum contract |
|---|---|
| Identity | Immutable observation ID; `learner_binding_id`; authoritative `person_id`; `employment_episode_id`; organization/role scope. All must be server-derived/reconciled, not accepted from a display name or email. |
| Measurement | Official `evaluation_date`; trailing `window_start` and exclusive `window_end`; business timezone; constituent period-normalized observation IDs/revisions and amounts; normalization method/version; completeness status; closed/as-of timestamp. Dates alone are insufficient. |
| Amount | Exact decimal constituent production and computed `average_monthly_production`; optional `window_total` must be separately named and never thresholded; ISO currency; unit/scale. Define whether tax, freight, returns, credits, cancellations, intercompany, house accounts, split credit, and late postings are included. Never use binary float. |
| Source | Source system and tenant/company; source entity/dataset; stable source record, batch, query/export, or reconciliation reference; source extraction/as-of time; non-sensitive digest/count/control total sufficient to reproduce the aggregation. Avoid copying invoice detail unnecessarily. |
| Trust state | Import/recorded timestamp and importer identity; verification timestamp and verifier/authority; source/approval status such as provisional, verified/approved, rejected, or superseded; validation/reconciliation result. “Imported” must not imply “approved.” |
| Version/correction | Schema/contract version; measurement-policy version; revision; `supersedes_id` or prior-observation ID; correction reason; corrected-at/by; original remains immutable. Only the latest valid approved head is eligible for a new assignment. |
| Provenance/security | Source environment/project, organization boundary, classification/retention metadata, request/idempotency key, and audit actor. |

The amount may be zero, but a missing feed is not zero. Negative amounts and reversals require an explicit policy. A single observation must not span employment episodes silently. When source ownership changes mid-period, the approved allocation policy and source detail must make the assigned amount reproducible.

### 9.2 Measurement-policy contract

A separately governed immutable policy version should state: effective dates; eligible roles/stages; the approved trailing-90-day window; the exact conversion from governed constituent production into average monthly production; timezone; open/closed-period rule; source company/entities; transaction status/date used; net/gross and currency conversion rule; returns/credits/cancellations; split/territory/account ownership; partial-employment/proration; rehire handling; missing/late data; corrections/restatements; rounding and boundary inclusivity; minimum completeness; approval roles; the official monthly-after-close evaluation cadence/date; and when an assignment becomes effective. Live sales indicators may refresh more frequently but are provisional analytics and must never overwrite or masquerade as the official closed evaluation.

Thresholds apply to the computed **average monthly production**, never `window_total`, and are half-open intervals in dollars: L1 `[0, 200000)`, L2 `[200000, 300000)`, L3 `[300000, 400000)`, L4 `[400000, 500000)`, and L5 `[500000, +infinity)`. Store decimal thresholds in versioned configuration, validate non-overlap/coverage, and record the exact version used. Do not hard-code `window_total / 3` until the normalization, constituent-period, partial-period, and completeness rules are approved.

## 10. Proposed level-assignment/confirmation architecture

### 10.1 Deterministic proposal, human-controlled publication

1. A trusted ingestion/reconciliation process produces immutable, period-normalized constituent observations for one episode and a closed 90-day evaluation window.
2. Only a complete set of approved/verified observation heads is eligible. A deterministic rules service computes average monthly production under the recorded normalization policy and evaluates that decimal value under an explicit performance-framework and measurement-policy version and creates a **proposal** containing observation ID/revision, computed level, threshold interval, calculation version, and explanation.
3. An authorized human reviews the learner/episode match, source status, period, amount, corrections, policy version, threshold result, and any exception. The human confirms, rejects, or defers. The system must not offer an arbitrary level inconsistent with the approved amount unless a separately governed exception type/authority exists.
4. Confirmation atomically appends an immutable performance-level event linked to the exact observation and proposal, the prior performance head, confirmer/scope, decision timestamp, effective period, and rationale/exception. Retry is idempotent; stale heads reject; episode-level locking prevents conflicting confirmations.
5. The official workflow runs on the governed cadence—preferably monthly after close—not continuously during the day. Live indicators remain visibly provisional and cannot publish an official event.
6. Read models calculate current performance only within the requested framework/policy and episode. Historical reports are effective-period aware; “latest recorded” and “level for period” are distinct queries.

Human oversight validates authoritative input and governed application of policy; it does not turn competency judgment into production. No AI output is an eligible observation, proposal override, approver, promotion, or demotion source. No individual or overall B-review writes performance history. No production event writes an individual competency band or overall Behavioral Level.

### 10.2 Adjacency and downward movement

Production thresholds naturally permit jumps and declines (for example L2 to L4, or L5 to L3) between governed periods. The current adjacent-only progression logic must not be copied without a business rule. Use neutral terms such as **assignment**, **confirmation**, and **period result**, not automatic “promotion/demotion,” until HR/business consequences are defined. Threshold classification and employment actions are separate contracts.

### 10.3 Current versus highest achieved production level

A future read model should distinguish **Current Production Level** (the latest effective, non-superseded confirmed evaluation under the requested framework/policy) from **Highest Achieved Production Level** (the maximum confirmed production level reached in the same employment episode under a compatible framework/policy). Example: `Current Performance: L3`; `Highest Achieved: L4`. Highest achieved is recognition/history metadata, not the current development-routing input and not protection from a later threshold result.

The existing append-only `learner_progression.level_history` structurally demonstrates that an ordered immutable event ledger can support both latest-head and maximum-ever projections. It cannot support these **production** projections because its events have legacy competency-gated semantics and no period/amount. A separate future production event ledger can support them cleanly if it retains framework/policy version, episode, effective period, restatement lineage, and a defined policy for comparing versions and corrected events. Whether highest-achieved badges persist across framework changes or employment episodes is unresolved.

## 11. Individual competency bands and overall Behavioral Level

### 11.1 Critical semantic distinction

The existing `learner_band.reviews` record is an **individual competency band**: one human outcome for one `competency_code` and competency version. A profile can therefore contain C01 = B3, C02 = B2, C03 = B4, and deferred competencies at the same time. The migration has no overall behavioral field, aggregate row, derivation rule, or LxBx designation. (`supabase/migrations/20260905192514_human_approved_competency_band_review.sql`: 6–25, 33–106.)

The newly approved **overall Behavioral Level** is a different fact: one human-reviewed B1–B5 outcome (or defer) summarizing behavioral development for one exact employment episode under its own framework version. It may be displayed with an independently current L1–L3, but it is not any one C-band and must not be fabricated from existing history. “B2 — Behavioral Development” must be qualified as overall; “C04 — B3” must be qualified as individual competency proficiency.

### 11.2 Governed overall behavioral assessment

Recommended conceptual lineage:

```text
practice / simulation / coaching / governed real-world observation
  -> human-reviewed evidence for one C01-C15
  -> human B1-B5/defer review for each individual competency
  -> human-reviewed overall behavioral assessment
  -> append-only overall B1-B5/defer history
  -> display composition with an independently confirmed L1-L3
```

A future overall assessment should preserve immutable ID/sequence; learner binding/person/employment episode; behavioral-framework and competency versions; exact current C-band IDs/revisions and optional exact evidence references; observed input/head; explicit B1–B5 or defer outcome; rationale and development priorities; reviewer, authority/scope, reviewed/recorded time; status; and correction/supersession lineage. Publication should validate same-episode/current/versioned inputs, reject stale heads, be idempotent and append-only, and permit defer for insufficient evidence. No AI score can directly propose or publish the overall B-level.

There is no approved weighting or aggregation model in this repository. Do **not** arithmetic-average B1–B5 labels, convert them to numbers, take an unapproved minimum/maximum/majority, treat missing/defer as zero, or infer an overall result from competency coverage. Leadership must approve whether critical competencies, minimum bands, weighting, holistic anchors, or another human framework governs the decision. Until then overall behavior is unavailable/deferred.

### 11.3 Combined designation and development meaning

For L1–L3, the combined designation is a presentation of two separately sourced current records: `LxBx`. L3B2 means production performance L3 and overall behavioral development B2. B never determines L, L never determines B, and changing either record does not mutate the other. If either side is unavailable, do not manufacture a compact designation; show the known fact and the other as pending/deferred. L4 and L5 display as L4/L5 by default, although leadership must decide whether their overall B-level remains visible as secondary detail.

Development interpretations are prompts for human inquiry, never automated personnel judgments:

* **L3B2:** strong production with lower assessed behavioral maturity may indicate meaningful development upside; inspect the underlying C-bands/evidence before selecting practice.
* **L3B5:** strong behavior without L4 production suggests investigating account opportunity, book composition, pipeline, territory/account potential, share of wallet, and activity instead of assuming a skill deficit.
* **L1B4:** lower production with stronger demonstrated behavior suggests investigating opportunity, ramp conditions, account access, activity, pipeline, product exposure, and role context.

The overall B-level should help answer which skills may limit performance and which coaching, simulations, and Tuesday exercises deserve attention, but the detailed C-bands remain necessary to choose a specific intervention. L2B1 and L2B5 share the same production objective but should not automatically receive identical coaching emphasis. Humans review context and assign development; neither label authorizes discipline, compensation, promotion, or employment action.

### 11.4 Genius Seeker closed loop

```text
trailing-90-day average monthly production
  -> closed, human-confirmed official L-level
  -> individual C01-C15 human-reviewed evidence
  -> individual C01-C15 B1-B5/defer competency bands
  -> human-reviewed overall Behavioral Level B1-B5/defer
  -> combined LxBx designation for L1-L3
  -> targeted coaching / Tuesday training / simulation
  -> real-world performance
  -> next governed production evaluation and behavioral review
```

Performance and proficiency inform the same development loop but remain independent records. Corrections and new reviews on one side never silently change the other.

## Anthony AE Checklist Alignment and Human-Facing Terminology

The supplied Account Executive Level Advancement Checklists are already partially represented as demo advancement content in `src/data/levels.js`, but the repository version differs from the supplied current document in several items. Neither source is a governed competency definition today. The current supplied checklist was therefore evaluated item by item against the actual `orion-sales/0.1-draft` names in `src/data/coachingTargets.js`; the complete mapping and classifications are in [`anthony-ae-checklist-competency-map.md`](./anthony-ae-checklist-competency-map.md).

### Candidate behavioral-stage translation

Anthony’s labels should be removed from the production L-axis and evaluated as the foundation for overall behavioral maturity:

| Anthony concept | Candidate overall Behavior Level | Plain-English meaning |
|---|---|---|
| Foundation AE | B1 | Foundation |
| Account-Aware AE | B2 | Account Aware |
| Growth-Driven AE | B3 | Growth Driven |
| Strategic Account AE | B4 | Strategic |
| Key Account / Partner AE | B5 | Partner |

This mapping is directionally strong, not ready for automatic or final qualification. The checklist supplies useful operational anchors for product/order execution, discovery, account knowledge, planning, commitments, expansion, strategic customer leadership, and team contribution. It also mixes observable behavior, required work products, activity rules, sales/customer outcomes, and subjective trust statements. Before approval, framework owners must rewrite the stages as observable B1–B5 anchors, eliminate duplicate voting, separate outcomes, fill material competency gaps, and approve sufficiency/defer/correction rules.

### Coverage, gaps, and behavior/outcome boundary

Strong mappings exist to Product Knowledge, Discovery / Questioning, Closing / Next-Step Behavior, CRM / Process Discipline, Professional Judgment, Relationship Building, and Successful Communication. Anthony adds useful specificity not clearly named by the current catalog: account segmentation and planning, stakeholder/buying-pattern analysis, category gaps and cross-selling, forecasting, retention/expansion strategy, QBRs, manufacturer alignment, mentoring, and reusable playbooks.

Objection Handling, Active Listening, Coachability / Learning Agility, Customer Experience, and the intermediate maturity of Confidence and Call Control are weakly or indirectly represented. They require additional anchors or an explicit scope decision; a nearby checklist item is not automatically evidence of the missing skill. Repeated themes—such as account insight, plan documentation, dealer trust, and expansion—must not be counted as independent votes toward overall B.

Checklist results such as multiple orders per day, selling products outside the morning list, sustained month-over-month growth, dealer requests, or leadership trust may provide context, but they cannot qualify behavior merely because the result occurred. In particular, sustained account growth belongs in governed production/outcome analysis. The human assessment must evaluate the demonstrated conduct behind a result and consider opportunity/context, preventing the same revenue result from determining both L and B.

### Governed summary, not checklist math

Anthony’s five stages can be the operational foundation for overall B1–B5 only after versioned framework approval. A human reviewer should consider exact current C01–C15 evidence/bands and checklist-aligned observations, explicitly select B1–B5 or defer, and document rationale and priorities. There is no arithmetic average, checklist completion percentage, majority vote, implicit minimum, or AI assignment. Leadership must decide which skills are foundational, critical/must-have, developmental, advanced, or specialty/partner behaviors and whether any critical contrary evidence prevents a given overall outcome.

Recommended groupings for that governance discussion—not weights—are:

* **foundational:** Product Knowledge, CRM / Process Discipline, Activity Consistency, Professional Judgment, and Customer Experience;
* **critical safeguards:** Professional Judgment, Customer Experience, accurate execution, and compliance with approved commercial/allocation policy;
* **developmental:** Confidence, Discovery, Active Listening, Objection Handling, Call Control, Successful Communication, Closing, Relationship Building, and Coachability;
* **advanced account capabilities:** segmentation, planning, forecasting, category-gap/cross-sell analysis, retention/expansion strategy, QBRs, and ecosystem alignment; and
* **specialty/partner candidates:** mentoring, reusable playbooks/tools, and stewardship of high-value relationships.

### Plain-English experience by audience

The ordinary learner/manager view should read:

```text
Performance
L3 — Growth

Behavior
B2 — Account Aware

Development priorities
Account Planning
Discovery
Cross-Selling
```

A compact `L3B2` badge remains permissible on a card or manager dashboard only with a nearby translation such as **Growth Performance · Account-Aware Behavior**. Do not make `L3B2 / C04B2 / C09B3 / C12B4` the default experience.

Learners see plain-language skills, observations, strengths, and priorities. Managers/trainers see those plus evidence themes, gaps, opportunity/defer context, and actionable plans. Executives see plain-language governed cohort summaries that keep performance separate from behavior. Reviewers and auditors additionally need exact C-code, internal B-band, model version, episode, evidence ID/revision, source, and correction lineage under **Skill details**, **Technical details**, or **Audit history**.

Using B1–B5 for both individual competency bands and overall Behavior Level remains a UX risk. Prefer **B1–B5** for the human-facing overall Behavior Level and show individual skill proficiency primarily as a skill name plus an approved word such as Developing, Capable, Proficient, Advanced, or Expert. Those words are candidate terminology only: they must be validated against the existing B1–B5 anchors before use. Storage and audit views retain the stable `Cxx` and B-band unchanged. Every displayed value must be qualified—for example, **Overall Behavior: B2 — Account Aware** versus **Discovery: Proficient (internal C03/B3)**—and an old individual band must never be presented as an overall Behavior Level.

## 12. Rehire behavior

Follow the repository’s strongest existing rule: a new employment episode gets a new binding and isolated records. Existing progression tests explicitly prove that the same person’s new episode has no inherited level or reviews until separately initialized. (`tests/progression-reviews.test.mjs`: 156–178.)

For the target model:

* Preserve prior Academy/stage, production observations, performance events, coaching, evidence, B-reviews, and legacy progression as read-only history under the old episode and separately authorized historical scope.
* Create no current stage, Ramp Certified status, production observation, performance level, overall Behavioral Level, competency band, or development assignment by matching `person_id` alone.
* Leadership must decide whether a prior Ramp Certification can be recognized. If allowed, record a new-episode stage event referencing an authorized prior certification and a revalidation approval; do not move the old event.
* Production attribution must use transactions governed for the new episode. Define how a measurement window crossing termination/rehire is split; safest default is separate episode observations, never one silently blended amount.
* The new episode must establish its own governed stage, production history, and overall behavioral assessment. Prior competency evidence may inform a coach only through an explicitly authorized historical view. Reuse as formal current-episode evidence requires a future governed equivalence/revalidation rule, not copied IDs.

## 13. Correction and audit behavior

### 13.1 Production corrections

Never update an approved monthly amount or its resulting level in place.

1. Append a corrected production observation with a new revision/ID, `supersedes_id`, reason, actor, and source correction reference.
2. Preserve the original observation and assignment. Mark lineage/read-model status, not physical rows, as superseded.
3. Re-evaluate the corrected observation under the **same policy/framework version originally applicable** unless an explicitly approved policy restatement says otherwise.
4. Require authorized confirmation of the correction proposal. Append a performance `correction`/`restatement` event linked to the prior performance head, prior assignment, and corrected observation—even if the threshold result remains the same.
5. Show both “originally reported/confirmed” and “restated” histories, with effective period and recorded time. Downstream development routing may change prospectively according to an explicit effective-time rule; never rewrite proof of what was assigned or delivered earlier.
6. If later periods depend on averages/windows, identify and explicitly restate every affected proposal/assignment. Do not let a query over mutable source rows silently change history.

Corrections to competency evidence, individual bands, or overall Behavioral Level remain in their own lineage and do not trigger performance correction. Corrections to production do not trigger individual or overall B-review changes. An authorized person may separately reconsider any axis through its own governed evidence, authority, and audit reason.

### 13.2 Required audit invariants

* append-only tables and predecessor/supersession links;
* immutable framework and policy versions per decision;
* exact observation IDs/revisions and source provenance;
* learner binding/person/episode agreement enforced server-side;
* attributable actor, authority/scope, timestamps, environment/project;
* no direct authenticated table writes; least-privilege RPCs/read projections;
* idempotent request IDs, stale-head rejection, deterministic lock ordering, and atomic observation-to-assignment confirmation;
* separate effective time, source-as-of time, approval time, and recorded time;
* durable reason for rejection, defer, exception, correction, and policy restatement.

## 14. UI terminology recommendations

### 14.1 Explicit display vocabulary

Use explicit labels everywhere:

* **Stage/status:** Ramp Certified — Establishing Baseline
* **Production:** L3 — Growth (closed evaluation date, window, average monthly amount, and status shown)
* **Overall behavior:** B2 — Behavioral Development
* **Combined designation:** L3B2 (or expanded `L3 · B2`)
* **Detailed competency:** C04 — B3; C08 — B2; never label either one as the overall B-level

For L1–L3, use a primary production badge with a smaller overall-behavior designation (`L1 · B2`, `L2 · B4`, `L3 · B2`) or compact `L1B2`, `L2B4`, `L3B2`. L4 and L5 show `L4` and `L5` by default. This is display composition, not a stored causal code. On every performance badge show at least the governed period/as-of status, currency amount, and confirmed/provisional/restated state. A generic “Official level” is insufficient. Never render absent data as L1 or `$0`.

### 14.2 Current progression-review UI

The existing `ProgressionPanel` must stop being presented as the path that determines the new L1–L5. Recommended transition:

1. At cutover, preserve it as **Legacy competency progression history** with framework version and a clear “does not represent sales-production performance” notice.
2. Do not repurpose its form by merely swapping labels. Its request requires bands, adjacent outcomes, and old history IDs; that contract is wrong for production.
3. After legacy-write policy is approved, remove/disable the create/correct controls for new legacy decisions while retaining authorized historical reads. If historical correction remains legally/operationally necessary, expose it only in an explicitly legacy workflow.
4. Keep evidence and B-review panels as **Competency evidence** and **Competency proficiency reviews**. Use their output for coaching/development planning, not level assignment.
5. Build a separate future **Sales performance confirmation** view around the trusted observation, period/policy, amount, proposed threshold, source/verification state, corrections, and confirmation audit.

Rename or retire automatic browser “Level Progress,” hard-coded topbar “Level 2 AE,” leaderboard L columns, and composite level weighting. If the practice gamification remains, call it **practice milestone** and use non-L identifiers/titles so it cannot be confused with stage, proficiency, or performance.

### 14.3 Development UI

Show Tuesday/cohort/1:1 assignments as an operational view derived from, but not overwriting, stage, production, overall behavior, and individual competency records. Explain why an assignment applies: performance event/business objective plus selected competency gaps. L4 should show the short targeted account-expansion/share-of-wallet lesson, one measurable action, then dismissal; L1–L3 should show Sales Lab with improv, role play, randomly drawn dealer/customer personalities/scenarios, game-based practice, and optional governed Genius Dollar incentives; L5 routine dismissal/autonomy with optional contribution. Exceptions and attendance do not alter performance or B-bands.

## 15. Test impact

### 15.1 Tests that should remain unchanged as legacy/governance regression

Keep the learner-record, reviewer-history, coaching-session, competency-evidence, and competency-band suites unchanged in their substantive guarantees: episode isolation; RLS/RPC authorization; exact source/version references; append-only correction lineage; learner acknowledgment; AI supporting-only; technical/disputed/insufficient states; and “does not change level/HR/pay” sentinels. Their sentinel label may later need qualification, but the no-side-effect assertion remains essential.

Keep `tests/progression-reviews.test.mjs` runnable against the historical migration as a legacy-contract regression. Its old all-C gating and adjacency assertions should not be deleted or rewritten to claim production semantics; they prove how historical rows were created. If legacy publishing is later frozen, split write-contract archival tests from the deployed read-only/correction policy tests.

### 15.2 Tests requiring later adaptation

* Reviewer UI tests/mocks asserting generic L1 and the B-reference progression form must assert the legacy label/read behavior, then separately cover the new production confirmation UI.
* Levels, dashboard, leaderboard, manager-view, navigation, static state, and any snapshots/manual tests must stop expecting training-score-derived L-values or L-weighted rankings.
* Documentation assertions/manual staging runbooks must qualify old framework semantics and include independent axis states.
* Any fixture called `progression_levels` should be renamed only if needed for clarity while retaining the sentinel purpose; it must never masquerade as the future production ledger.

### 15.3 New tests eventually required

1. **Contract validation:** trailing-90-day boundaries and constituent normalization, average monthly value versus window total, decimal/currency, exact thresholds (199999.99/200000, etc.), non-overlapping threshold versions, period start/end/timezone, zero versus missing, negative/credit policy, source status, and schema/policy versions.
2. **Identity/authorization:** same binding/person/episode enforcement; no name/email matching; learner/outside/revoked/expired denial; distinct import/verifier/confirmer roles; no privilege inherited from current competency scopes without approval.
3. **Independence:** AI completion/score cannot write stage/performance/overall behavior; individual B-review cannot become overall B or write performance; production cannot write evidence/bands/overall behavior; stage cannot synthesize L1; all cross-axis sentinel tables remain unchanged.
4. **Confirmation:** only approved observation heads; deterministic threshold proposal; exact reference/revision; human confirm/reject/defer; idempotency; stale-head rejection; atomic event; no arbitrary override; explicitly tested exception authority if approved.
5. **History/correction:** immutable original; supersession/restatement lineage; same-level restatement still audited; corrected amount crossing up/down thresholds; later periods and rolling windows explicitly restated; recorded-time versus effective-period queries.
6. **Concurrency:** two confirmations from one head; confirmation versus observation correction/revocation; policy cutover boundary; serialization rollback/retry.
7. **Stage:** Academy milestones do not imply Ramp Certified; human certification; Ramp Certified — Establishing Baseline does not imply L1; full-history/completeness gate; stage correction/history.
8. **Behavior and rehire:** governed human overall B/defer, no arithmetic averaging, exact C-band snapshots/corrections, LxBx composition only for L1–L3, and no inherited stage/performance/overall behavior/proficiency; cross-episode source rejection; governed certification revalidation; period split across episodes.
9. **UI/accessibility:** unambiguous stage, production, overall-behavior, and individual-competency facts; evaluation/window/average/status visible; live versus official distinguished, unavailable not L1/zero, legacy warning, auth/episode switch clears stale data/drafts, mobile/keyboard behavior.
10. **Development routing:** L1–L3/L4/L5 Tuesday rules, L1 1:1, cohort segmentation, competency-tailored content, effective-time behavior after correction, no reverse writes.

## 16. Safe implementation sequence

Each phase requires its own review/approval; this audit authorizes none of them.

1. **Approve vocabulary and ownership.** Name accountable owners for stage, production source, measurement policy, threshold framework, competency model, confirmation, corrections, and development routing.
2. **Inventory deployed reality.** Verify which migrations/RPCs/UI versions are actually deployed, count framework versions and old history, identify external consumers/exports, and reconcile the repository against production without changing it.
3. **Decide open business policy.** Resolve every item in section 17 and document effective dates, roles, exception/correction rules, and retention.
4. **Publish versioned contracts/design.** Review stage-event, normalized production-observation, 90-day evaluation, proposal, assignment, overall-behavioral assessment, and read-model contracts with data, security, HR/legal, training, and Business Central owners. Threat-model RLS/RPCs and source reconciliation.
5. **Add contract tests first.** Preserve legacy tests; add independence, boundary, correction, rehire, concurrency, and authorization tests against synthetic data.
6. **Build isolated stage, production, and overall-behavior storage in staging.** New schema/tables/RPCs only after approval; do not alter old tables or reuse old `current_level`. Deny direct access and preserve exact episode provenance.
7. **Build ingestion/reconciliation without assignment.** Shadow-import trusted observations, validate normalization, average-versus-total, completeness, identity, and period policy, and obtain data-owner sign-off. Missing data stays unavailable.
8. **Build deterministic proposals and human confirmation.** Keep assignment off until reconciled; test corrections, stale heads, concurrency, and audit export.
9. **Build separate read models/UI.** Display explicit stage, production, overall behavior, detailed competency, and legacy qualifiers. Remove training-derived L-values from operational surfaces before showing new L-values. Do not dual-write.
10. **Pilot in isolated staging.** Use synthetic then approved non-production samples; compare manually calculated boundaries and corrections; run Security Advisor and accessibility/end-to-end checks.
11. **Approve cutover.** Declare first governed effective period, handling of already Ramp Certified staff, legacy write/fix policy, external consumer migration, rollback/access-disable plan, and support ownership.
12. **Production rollout only under a separate deployment authorization.** Monitor reconciliation, unavailable states, confirmation latency, corrections, and cross-axis invariants. Preserve old history indefinitely per retention policy.
13. **Add development routing last.** Consume confirmed performance plus overall behavior and detailed competency gaps only after both are trustworthy; measure outcomes without feeding attendance/practice scores back into level assignment.

## 17. Explicit business decisions still required

The trailing-90-day average-monthly policy is approved; these implementation/governance details remain open:

1. Exact governed normalization: constituent calendar months, day-normalized values, another period basis, or an approved equivalent; calculation precision/rounding; and why it faithfully expresses average monthly production over trailing 90 days.
2. Official monthly evaluation date/cadence, business timezone, close/reopen rule, evaluation window endpoints, and separation of live provisional indicators from official assignments.
3. Minimum completeness before the first/each official L assignment; treatment of partial months, insufficient history, missing feeds, leave/inactive periods, and verified zero.
4. Exact Ramp Certified → Establishing Baseline → first L transition, including who declares sufficient history and whether existing staff need stage revalidation.
5. Gross invoiced, net invoiced, booked, shipped, paid, gross-profit-adjusted, or another amount; source company/entity and posting date/status.
6. Returns, cancellations, credits, freight/tax, deposits, backorders, intercompany/house accounts, split credit, late postings, negative results, and currency conversion.
7. Sales attribution and territory/account transfer rules, including ownership changes mid-window, shared/team accounts, role transfers, termination, and rehire.
8. Authority and separation of duties for import, verification, official production-level confirmation, rejection/defer, exception, correction/restatement, and amount visibility.
9. Whether direct threshold classification permits multi-level increases/decreases, and which confirmed event controls operational development routing.
10. Overall Behavioral Level approval authority, cadence, freshness, evidence sufficiency, appeals/corrections, and whether it is assessed for L4/L5 even when omitted from their primary designation.
11. The overall B1–B5 framework: required minimum/critical competencies, weighting, holistic behavioral anchors, or another approved human method. No method or arithmetic average is approved today.
12. Behavior when an L1–L3 production level exists but overall B is deferred/unavailable, or when an overall B exists before the first official L; compact designation must not fabricate the missing half.
13. Whether B4/B5 remains visible as secondary detail after L4/L5 and whether historical combined designations are rendered as-of each evaluation or composed only from current heads.
14. Correction/restatement policy for constituent observations, affected overlapping 90-day windows, production assignments, overall B assessments, and downstream routing effective dates.
15. Current versus Highest Achieved Production Level recognition/badge policy, including corrected events, framework changes, rehires, expiration, and whether highest achieved has any consequence beyond recognition.
16. Tuesday/cohort/1:1 effective-time rules, attendance exceptions, holidays/leave, L5 mentoring, and Genius Dollar authority/accounting.
17. Academy curriculum/milestone source, Ramp Certification approvers, expiry/revocation/re-entry, and prior-certification behavior on rehire.
18. Legacy cutoff/correction/retention policy, external consumer migration, production/behavioral privacy classification, audit recipients, and required HR/legal review.
19. Which Anthony checklist revision is authoritative; the final B1–B5 behavioral anchors and outcome exclusions; treatment of weakly represented competencies and partner specialties; and whether candidate plain-English individual-proficiency words faithfully match the existing internal band anchors.

## 18. Risks and open questions

| Risk | Consequence | Mitigation / open question |
|---|---|---|
| Silent semantic reuse of `L1`–`L5` | False historical claims and misleading employee decisions | Separate ledger/version/axis; qualify every read/export; no backfill from old rows. |
| Browser demo levels remain visible | AI practice appears to promote people and conflicts with “official” performance | Remove/rename before cutover; use non-L practice milestones. |
| 90-day total thresholded or divided blindly by three | Materially wrong production level | Persist constituent normalization and average monthly result; approve partial-period/month-length rules; test average versus total. |
| Live indicator treated as official | Intraday changes silently move training/status | Only a closed, attributable evaluation event can create official L-history; label live data provisional. |
| Missing/partial baseline treated as zero | New hire incorrectly assigned L1 | Ramp Certified — Establishing Baseline until sufficient complete history; only governed complete zero is zero. |
| Current report data assumed authoritative | Amounts lack episode/source/correction governance | Reconcile through the future observation contract; do not scrape UI/generated modules. |
| Existing scope reused automatically | Excess production/pay visibility or unauthorized confirmation | Separate privilege review and least-privilege roles; no implicit grant inheritance. |
| Competency destroyed during separation | Loss of valuable coaching/evidence history | Preserve all competency schemas/RPCs and use them only for development. |
| Production or individual C-band reused as overall behavior | L implies B, or C04 B3 is misrepresented as overall B3 | Separate overall framework/ledger and human review; exact C inputs; no silent averaging or inference. |
| Corrections mutate prior period | Audit and downstream routing become inexplicable | Append observation and performance restatements; retain original/effective/recorded views. |
| Rolling windows amplify corrections | One correction silently changes many historical levels | Materialize/version observations and explicitly regenerate/reconfirm affected assignments. |
| Rehire matched by person | Old level/stage/skills leak into new employment | Episode-scoped records; separately authorized revalidation only. |
| Generic “promotion/demotion” terminology | Performance classification mistaken for HR action | Use assignment/confirmation; define downstream employment policy separately. |
| Policy changes without effective dating | Same amount maps differently without explanation | Version thresholds and measurement policy; store both per event. |
| C12 “Sales Outcomes” confused with sales dollars | Behavioral judgment becomes a production proxy | Keep C12 under competency version and label it proficiency; never use it as amount input. |
| L5 autonomy routing applied to stale/provisional data | Wrong attendance expectations | Define which confirmed period/event drives routing and how corrections apply prospectively. |

### Final architecture guardrail

The durable relationship must be **collaboration without equivalence**:

```text
PERFORMANCE: “How much business is this Sales Executive producing?”
  closed trailing-90-day normalized observations -> average monthly production -> human-confirmed L1-L5 event

PROFICIENCY: “What skills are strong, and what should we develop next?”
  observed behavior -> human C01-C15 evidence -> individual human B1-B5/defer reviews
  -> separate human overall Behavioral Level B1-B5/defer

STAGE: “Where is this person in Academy/readiness?”
  Academy milestones -> human Ramp Certification -> Establishing Baseline
```

For L1–L3, current production and overall behavior may be composed as LxBx for display. All facts may meet in a development plan and outcome analysis. They must never write one another’s facts, infer missing records, or silently reinterpret history.
