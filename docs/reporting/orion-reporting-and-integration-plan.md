# Orion Reporting & Business Central Integration Plan

> Migrated from `GeniusSeeker33/geniusseeker-talent-success-platform/docs/orion-reporting-and-integration-plan.md` during repository consolidation. References below are being updated as canonical documents are migrated into this repository.

## 1. Executive Summary

Start with five weekly pilot measures of development and support. Add activity, financial and employment-outcome metrics only after their source-quality and governance gates pass. Business Central (BC) owns financial facts; Genius Seeker connects verified learning evidence and publishes minimal, traceable reporting.

This design synthesizes the executive dashboard definitions, BC data contract, and core model. Those documents retain detailed definitions and field rules; this plan introduces no competing metrics or integration behavior.

**Documentation only:** no repository re-audit, operational API calls, code, schema, migration, credential or UI changes. Design completion does not mean production readiness or policy activation.

## 2. MVP Executive Dashboard

Publish cohort aggregates weekly, with numerator/denominator where applicable, definition version, period, source-through time and coverage status.

| Initial metric | Leadership meaning / display | Responsible owner |
|---|---|---|
| Training participation | Learners with a qualifying submitted/completed attempt / learners scheduled for development; approved opportunity/leave exclusions explicit | Training lead |
| Competency target coverage | Human-confirmed learner/competency targets / agreed targets, by competency; distinguish observed gaps, missing opportunity and unavailable evidence | Training lead / calibrated coaches |
| Approved L1–L5 distribution / advancement | Current human-approved levels, “no approved level yet,” and distinct approved advancements; initial confirmation separate | Progression owner / manager |
| Coaching coverage | Learners receiving attributable completed coaching / learners scheduled; follow-up gaps shown as support context | Training lead |
| Open development support needs | Distinct learners with human-confirmed blockers, with reason/age and support owner; no employee risk score | Training lead / manager |

These measures require a verified roster, person/employment episode attribution, complete governed records and approved reviewers. Secure approved manual records may support the pilot. Participation is not proficiency; proficiency is not automatic advancement. Executive aggregates require approved recipients and small-cohort privacy rules; named follow-up stays with authorized managers/coaches.

## 3. Future Metrics

| Metric | Gate before publication / cadence |
|---|---|
| Call activity | Complete, deduplicated RingCentral outbound attempts and dated extension attribution; daily source validation, weekly snapshot |
| Connected calls | Approved disposition mapping and the same outbound population; connection does not establish human contact; daily validation, weekly snapshot |
| Successful communications | Human-verified useful two-way outcomes, complete interaction grouping and channel-appropriate populations; weekly after review |
| Sales outcomes | Finance-approved posted invoice count/net-sales scope, complete BC extracts, currency/credit treatment and reconciliation; monthly, or explicitly approved reconciled weekly scope |
| Time to productivity | Prospective human-approved milestone, HR start dates and adequate follow-up; report non-achievers/observation limits; 30/60/90 checkpoints |
| 30/60/90 retention | Verified hire/exit history and mature cohorts including early leavers; rehires remain separate; monthly/checkpoints |
| Training ROI | Complete program costs, Finance-validated benefit basis and defensible evaluation assumptions; monthly input review, result only after approved evaluation horizon |

A **call attempt** is a dialing occurrence; a **connected call** is a provider connection; a **successful communication** is a human-verified useful interaction; a **sale** is a separate source-verified commercial event at a stated stage. None automatically implies the next. Communication-to-sale references can be many-to-many without proving causation or duplicating sales totals.

## 4. Source-of-Truth Matrix

| Metric/Data Domain | Authoritative System | Genius Seeker Role |
|---|---|---|
| Assignments, attempts, coaching occurrence, evidence and approved level history | Governed learning records, with identified accountable owners | Maintain attributable records and summarize accepted facts |
| Employment dates, status and rehire history | Designated HR/employment source | Preserve verified episode links; derive only approved cohort measures |
| Call events/dispositions | RingCentral | Read/reference, deduplicate and map dated aliases; no inferred communication success |
| Posted financial facts, credits, currencies | Microsoft Business Central / Finance | Retain minimum read-only projections and reconcile before reporting |
| Competency conclusions, communication verification, progression approval | Authorized human verification/review recorded in governed sources | Preserve evidence, reviewer, version, rationale and corrections; AI cannot decide |

The governed learning source is the recommended durable record system, not proof that current browser-local data is reliable. Unknown identity remains unresolved; a current account owner is not a historical learner mapping.

## 5. Business Central Boundary

The integration is **read-only for governed financial reporting purposes**. BC retains financial authority; Genius Seeker does not become the system of record for posted accounting facts. No compensation or commission calculations are defined by this reporting plan.

Preserve tenant, environment, company, entity/table, source record ID, document number, posting/status, currency, available source timestamps and extract provenance. Keep quotes, orders, shipments, posted invoices and credits/returns/adjustments distinct. Preserve correction lineage and approved currency/amount basis; do not copy full financial or customer records.

Executive financial values require complete pagination/scope and reconciliation to an approved BC control for the same company, period, currency and definition. Finance signs off exceptions/tolerance; incomplete totals are unavailable. Verified effective-dated salesperson mappings are required for pilot attribution. A reconciled company total may remain valid while learner attribution is unavailable, but must never be labeled pilot sales.

**Missing data is not zero.** Exact field mappings, permissions, freshness and extraction strategy remain Finance/IT decisions in the canonical Business Central data contract.

## 6. Reporting Guardrails

- No synthetic/demo/test or unattributed records presented as real KPIs.
- No AI employee rankings, average-score promotions or automatic risk labels.
- No private coaching text, customer details or recordings on the executive dashboard.
- No incomplete financial totals, mixed-currency sums or unreconciled projections.
- No causal training/ROI claims without defensible evidence and complete cost inputs.
- Missing, stale, disputed or incomplete data means unavailable with a reason; zero requires a complete verified population. Zero-denominator rates are unavailable.
- Missing opportunity and technical failure are support needs, not low proficiency. Only an authorized human review changes an approved level.
- Retain source references, definition versions and correction history with restricted access; small cohorts require disclosure controls.

## 7. Pilot Reporting Workflow

**Source validation → learning/coaching review → metric calculation → exception/unavailable review → leadership snapshot**

1. **Source owners validate** roster/identity, source-through dates, completeness, duplicate handling and permitted access.
2. **Coaches/reviewers confirm** completed work, target evidence, coaching delivery, blockers and effective progression decisions; disputed findings remain excluded from decision use.
3. **Reporting owner calculates** the five metrics using approved populations and versions, preserving traceable inputs.
4. **Training lead and relevant HR/Finance owners review exceptions:** mark affected values unavailable, assign resolution owners and confirm privacy. Future financial measures additionally require Finance reconciliation.
5. **Leadership receives the weekly snapshot:** aggregate results, coverage/as-of status and minimal support actions. Later corrections publish a labeled revised snapshot; old values are not silently relabeled current.

Weekly publication does not override monthly Finance reconciliation or source freshness gates.

## 8. Open Leadership / Finance / IT Decisions

| Decision | Owner |
|---|---|
| Pilot cohort, schedules/targets, reviewer authority, recipients and small-cell disclosure | Leadership / training lead / HR |
| Authoritative employment history, rehire/leave definitions and productivity milestone | HR / operational leadership |
| Source namespaces, identity/alias history and shared-sale attribution basis | IT / HR / sales operations / Finance |
| Call dispositions, interaction grouping and human-verification coverage | Sales operations / IT |
| BC company/entity/field allowlist, least-privilege reads, consistent extraction and correction coverage | IT / BC administrator |
| Net-sales/status/credit/tax/freight/currency basis, control reports, tolerances and sign-off | Finance |
| Freshness thresholds, refresh ownership, manual-extract option, retention/access and necessary linkage keys | IT / Finance / privacy |
| Full pilot cost inputs, evaluation horizon, baseline/comparison and defensible benefit assumptions | CFO / pilot owner |

These are adoption/implementation approvals, not authorization to start integration or dashboard development.

## 9. Consolidation Note

The original design acceptance criteria were satisfied at documentation/design level in the Talent Success repository. Production readiness and implementation approvals remain explicitly open. During consolidation, the active implementation in `sales_simulator_orion` remains the operational truth and must be reconciled against this governance plan rather than silently rewritten.
