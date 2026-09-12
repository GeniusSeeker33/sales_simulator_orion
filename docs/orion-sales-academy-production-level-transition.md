# Orion Sales Academy to Production-Level Transition

**Status:** supporting operational analysis; not a canonical framework or an implementation claim.  
**Authority:** the [training and progression record model](training/training-progression-record-model.md), [Orion sales competencies](training/orion-sales-competencies.md), and [Orion L1–L5 framework](training/orion-l1-l5.md) govern where this analysis differs.  
**Scope:** documentation only. This document does not authorize a schema, workflow, scoring, compensation, or deployment change.

## Purpose

The Sales Academy needs a practical handoff from structured learning into production without turning completion, commercial results, or a single score into a judgment about a person. This analysis names the decisions that an operator may need at that handoff while preserving the canonical record and approval boundaries.

The platform architecture treats Talent Development, Sales Simulation, Talent Progression, and Performance Intelligence as related but separate capability layers. This transition must preserve those boundaries rather than use one layer's measure as a substitute for another. See [platform architecture](platform/architecture.md).

## Four Separate Views of Development

| View | Question answered | Typical evidence | Decision boundary |
|---|---|---|---|
| **Sales Academy / ramp status** | Where is the learner in assigned onboarding, practice, and supported ramp work? | assignments, attempts, attendance, required reviews, support provided, and completion decisions | Operational workflow status. Completion means required work was completed; it is not proficiency, production level, or behavioral level. |
| **Production performance level (L1–L5)** | What role progression level has an authorized reviewer approved under the versioned L1–L5 framework? | a frozen packet of admissible evidence evaluated against the target level's published requirements | Only an authorized human progression review can change effective L-level history. |
| **Individual competency proficiency and evidence** | What has been observed for a particular versioned competency and anchor, with what strength and limitations? | attributable simulations, coaching observations, work evidence, human verification, freshness, context, and contrary or missing evidence | Evidence is not a conclusion. A human-reviewed competency conclusion remains scoped to the competency, version, context, and review. |
| **Overall Behavioral Level (B1–B5)** | What holistic behavioral conclusion has an authorized human review supported for the defined scope and period? | multiple relevant competency observations and contextual review under versioned B-level anchors | It is not an arithmetic average, a synonym for L-level, or an automatic roll-up from outcomes or checklist completion. |

The canonical competency index uses B1–B5 as versioned behavioral proficiency anchors for competencies. Any overall Behavioral Level must therefore identify the governing framework version and the precise scope of the holistic conclusion; it must not erase the underlying per-competency findings or imply that every competency is at the same band. If no approved overall-level review contract exists, the platform should display only the individual reviewed findings and must not manufacture an overall B-level.

## Academy and Ramp Status

An operational status vocabulary can help teams coordinate support, provided it is explicitly local and versioned. For example:

1. **Assigned** — required learning and expected evidence are known.
2. **In progress** — the learner is participating; attempts, interruptions, and support remain attributable.
3. **Awaiting review or evidence** — activity may be complete, but a required review or opportunity is outstanding.
4. **Academy requirements completed** — an authorized reviewer confirmed the defined completion contract.
5. **Supported production ramp** — the person is practicing or working in production with the stated supervision and support.
6. **Ramp requirements completed** — the operational ramp contract is complete; this does not itself approve an L-level or B-level.

These are examples, not a new canonical status enum. An implementation proposal must reconcile them with the versioned training assignment, attempt, assessment, coaching, evidence, and review records in the [canonical record model](training/training-progression-record-model.md).

### Conditions for a Responsible Handoff

An Academy-to-production handoff should make the following visible to the authorized people:

- the learner and employment episode, role scope, organization scope, and applicable framework versions;
- completed, incomplete, retried, interrupted, and technically failed work without overwriting earlier attempts;
- required human reviews and their status;
- demonstrated evidence as well as missing opportunity, unavailable evidence, disputes, and limitations;
- agreed support, supervision, accommodations, and follow-up dates;
- the distinction between permission/readiness to begin supported work and an approved progression level; and
- the reviewer, rationale, effective date, and reconsideration path for any actual decision.

The handoff should transfer context, not silently convert Academy activity into proficiency evidence. One observation discussed in multiple sessions remains one observation, and a retry remains a new occurrence rather than a replacement for history.

## Relationship to L1–L5

L1–L5 is the canonical role-progression framework, referred to operationally here as production performance level. It is broader than course completion and remains governed by the [Orion L1–L5 canonical index](training/orion-l1-l5.md).

- An Academy or ramp milestone may satisfy a specifically published L-level requirement, but only when a progression reviewer admits the evidence under the pinned framework version.
- Starting production work does not automatically grant L1.
- Completing the Academy or ramp does not automatically grant or advance an L-level.
- A competency finding or overall B-level does not convert to an L-level by lookup, averaging, or threshold.
- Progression approval creates effective-dated L-level history only for the applicable employment episode and role scope.

## Outcomes Are Context, Not Automatic Judgments

Sales volume, account growth, order count, revenue, margin, conversion, activity volume, and quota attainment can be relevant work-context evidence. They are influenced by territory, account mix, pricing, seasonality, opportunity, assignment, team support, market conditions, data quality, and other factors. Consequently, none of them—alone or in combination—automatically determines:

- Academy or ramp completion;
- proficiency in an individual competency;
- an overall Behavioral Level B1–B5; or
- a production performance level L1–L5.

An authorized reviewer may consider a governed outcome record only when the applicable framework states its relevance and the review preserves source, time period, scope, limitations, and rationale. Business Central remains authoritative for financial facts; importing or displaying a financial measure does not make it behavioral evidence or a progression decision.

### Prohibited Shortcuts

Do not implement or describe formulas such as:

- “revenue target met = B4”;
- “order count threshold = proficient”;
- “Academy complete = L1”;
- “average competency band = overall B-level”;
- “overall B3 = L3”; or
- “AI score or checklist percentage = approved level.”

Dashboards may place operational status, reviewed findings, approved levels, and outcomes near one another, but must label their sources and meanings and must not visually imply causation or automatic conversion.

## Suggested Operational Review Points

| Review point | Operational question | Appropriate output | Output it must not create automatically |
|---|---|---|---|
| Academy entry | Is the assignment and support plan complete and understood? | assignment/ramp plan | baseline proficiency or level |
| Practice review | What was observed, under what conditions, and what should be practiced next? | attributable assessment, evidence, or coaching record | approved B-level or L-level |
| Academy completion | Were the versioned completion requirements met? | human-reviewed completion status | competency proficiency, overall B-level, or L-level |
| Production handoff | Is the supported-work plan safe, scoped, and staffed? | operational handoff and support plan | progression approval |
| Competency review | What does the admitted evidence support for each competency? | scoped human-reviewed findings | arithmetic overall B-level or L-level |
| Holistic behavioral review, if governed | What overall behavioral conclusion is supported for the stated role, context, and period? | separately approved B1–B5 conclusion with rationale | identical bands for every competency or an L-level |
| Progression review | Are the pinned requirements for a target L-level demonstrated? | authorized decision and, if approved, effective history | retroactive rewriting of evidence or prior decisions |

## Record and Governance Implications

Use the canonical records rather than creating a parallel Academy evidence system:

- training assignment and attempt records establish what was asked and what occurred;
- simulation and assessment records preserve the occurrence and evaluation provenance;
- coaching records preserve attributable developmental interactions;
- competency evidence connects a single primary observation to versioned anchors;
- competency or behavioral review records preserve human conclusions without overwriting evidence;
- progression reviews and progression history alone govern approved L1–L5 changes.

AI may summarize, suggest observations, or prepare a packet. It may not approve Academy completion where human review is required, confirm competency proficiency, set an overall Behavioral Level, or advance L1–L5. Learner-visible decisions should provide rationale and a correction, dispute, or reconsideration route.

## Relationship to the Anthony AE Checklist Analysis

The [Anthony AE checklist competency map](anthony-ae-checklist-competency-map.md) is a supporting example of how operational tasks can be traced to the canonical competency and evidence model. It is useful for finding coverage and evidence opportunities. It is not a second competency framework, a scoring rubric, or a progression formula.

## Follow-up Questions Before Implementation

1. Which organization owns each Academy and ramp status definition and version?
2. Which statuses are informational, which require human review, and who is authorized to decide them?
3. What is the approved scope and review contract, if any, for an overall Behavioral Level?
4. Which production observations are admissible for each competency or L-level requirement?
5. How are opportunity, support, territory, source quality, disputes, and technical failures shown to reviewers?
6. What may learners, coaches, managers, and executives see at each layer?
7. How will reports prevent financial and activity outcomes from appearing to be behavioral or progression decisions?

