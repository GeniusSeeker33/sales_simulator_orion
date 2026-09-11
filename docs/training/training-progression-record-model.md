# Training, Coaching & Progression Record Model

**Status:** canonical consolidated design.  
**Source provenance:** reconciles the Talent Success eight-record training/progression design with the implemented learner, coaching, evidence, band-review, and progression work in this repository.  
**No production schema migration is authorized by this document.**

## Core Principle

Training execution, evidence, assessment, coaching, and progression are different facts and must stay separate.

A learner can complete training without demonstrating proficiency. AI can suggest observations without making a human decision. A competency band can be human-confirmed without automatically advancing an L-level. Only an authorized human progression review can create approved progression history.

## Shared Record Contract

Canonical learner records carry or resolve to:

- `person_id`
- `employment_episode_id`
- `organization_scope`
- `role_scope_ref`
- fully scoped source references
- created/updated actor and time
- revision / record status
- correction / supersession lineage
- access scope and retention policy
- versioned definitions used in the record or decision

Failed attempts, technical failures, missing opportunities, and disputes remain attributable records; they are not silently dropped or converted to low proficiency.

## 1. Training Assignment

Purpose: targeted work with a clear development reason and completion contract.

Key concepts:
- assigned activity/module/scenario + version
- competency targets
- assigned-by / coach / completion reviewer
- required evidence and completion criteria
- due date / support modality
- workflow status

Completion is a human-reviewed execution decision, not a proficiency verdict.

## 2. Training Attempt

Purpose: one occurrence of a learner undertaking assigned or voluntary work.

Key concepts:
- assignment reference when applicable
- activity + version
- start/end time
- modality and support given
- completed / abandoned / technical-failure distinctions
- retry relationship
- immutable submitted artifact/reference when retained

A retry is a new occurrence; it does not erase the original attempt.

## 3. Simulation Session

Purpose: one bounded simulated interaction inside a training attempt.

Key concepts:
- scenario/difficulty/product-context versions
- AI or human roleplay origin
- occurrence timing
- interaction/transcript/recording reference only when approved and necessary
- provider/model/config provenance for AI
- technical failure / interruption / retry status

The existing realtime voice simulator is an implementation source for these occurrences, not the authority for human progression decisions.

## 4. Assessment Result

Purpose: one evaluation run or identified human assessment against exact criteria.

Keep separate:
- AI result/provenance
- human review/finding
- observation status
- evidence/admissibility status
- reassessment relationship

AI output remains AI output after review; a human reviewer may accept, correct, or reject it but should not overwrite provenance.

Technical failure, unavailable evidence, or missing opportunity must not become a zero ability score.

## 5. Coaching Session

Purpose: an attributable developmental conversation or observation.

Key concepts:
- identified coach and reviewer if different
- occurred-at + modality
- competency targets
- reviewed attempts/results/evidence
- observed behavior
- strengths and development opportunities
- assigned practice / follow-up
- learner comments / acknowledgment

Learner acknowledgment means receipt, not agreement.

The current implementation is documented in `../attributable-coaching-sessions.md`.

## 6. Competency Evidence

Purpose: connect one reviewable observation to versioned competency anchors.

Evidence must preserve:
- one primary observation origin
- source type: AI practice, human coaching, or real-world work evidence
- competency/version/anchor references
- occurrence context/time
- restricted evidence reference/hash when needed
- human verification status
- availability/freshness/limitations

Discussing or rescoring one observation does not manufacture a second independent observation.

The current implementation is documented in `../competency-evidence-deployment.md`.

## 7. Progression Review

Purpose: learner-visible human decision against a frozen framework and frozen evidence packet.

A progression review pins:
- target L-level + framework version
- exact requirement versions
- evidence IDs + revisions
- accepted/excluded evidence and rationale
- per-requirement findings
- learner notice/response
- authorized human approvals
- decision and effective date
- reconsideration/appeal linkage

Valid outcomes should distinguish at least:
- target level approved
- not yet demonstrated
- insufficient evidence/opportunity
- deferred for correction

Missing/disputed evidence is not automatically “not demonstrated.”

The current implementation is documented in `../progression-review-deployment.md`.

## 8. Progression Level History

Purpose: effective history of approved L-levels.

Requirements:
- must cite an authorized decided progression review
- exact framework/role scope
- effective-from / effective-to history
- prior history reference where applicable
- one effective level at a time per learner episode/role

A later approval closes the prior effective interval; it does not erase it. Rehire does not automatically carry forward an old level.

## Human Approval Boundary

Only authorized human review can create or change approved progression history.

The following cannot independently approve advancement:
- number of completed activities
- AI score
- average score
- simulator feedback
- points/rewards
- coach recommendation alone
- call volume
- sales value alone

## B1-B5 vs. L1-L5

These are deliberately different layers:

- **B1-B5** = demonstrated competency band for specific versioned competencies/anchors.
- **L1-L5** = broader role progression level governed by framework requirements and an authorized progression review.

Do not collapse B-bands into L-levels by arithmetic averaging.

Current human-reviewed band implementation: `../competency-band-review-deployment.md`.

## Implementation Status

The simulator repository already contains staging-tested/implemented behavior for substantial portions of this design:

| Canonical concept | Current implementation evidence |
|---|---|
| learner attribution / attempts / sessions | `../durable-learner-records.md` |
| attributable coaching | `../attributable-coaching-sessions.md` |
| competency evidence | `../competency-evidence-deployment.md` |
| human-reviewed B1-B5 | `../competency-band-review-deployment.md` |
| human-approved L1-L5 review | `../progression-review-deployment.md` |
| scoped reviewer history | `../scoped-reviewer-history.md` |
| manager / coach workflow | `../manager-coach-ui.md` |

Implementation docs describe current behavior; this file defines the canonical meaning and guardrails. No deployed table should be renamed simply to match this conceptual vocabulary.

## Funding / Reporting Relevance

Together with the person/employment crosswalk, these records can provide a clean evidence chain for:

- training participation
- coaching coverage
- competency target coverage
- progression
- time to productivity
- 30/60/90 retention
- training ROI
- eligible training-funding documentation after official program rules are verified

See `../reporting/orion-reporting-and-integration-plan.md` and `../compliance-funding/indiana-employer-training-grant-crosswalk.md`.

## Guardrails

- AI never becomes the final competency/progression authority.
- Missing data is not zero.
- Technical failure is not low proficiency.
- Completion is not proficiency.
- Proficiency is not automatic advancement.
- Historical evidence is never silently reassigned to a different person or employment episode.
- Private coaching/evidence remains access-controlled and is not copied wholesale to executive dashboards.
