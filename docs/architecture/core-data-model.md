# Genius Seeker Core Data Model

**Status:** canonical reconciliation summary for the consolidated Orion/Genius Seeker repository.  
**Source provenance:** reconciles `geniusseeker-talent-success-platform/docs/core-data-model.md` with the implemented learner-record and progression work in this repository.  
**Important:** this document does not change deployed schema, Supabase data, auth, Business Central, RingCentral, or production behavior.

## Executive Summary

Genius Seeker uses a shared identity and evidence model without replacing authoritative enterprise systems. A person is identified by an immutable `person_id`; distinct employment episodes preserve hires and rehires. Canonical learner records resolve to a verified person, employment episode, organization scope, and role scope.

Learning records separate assigned work, attempts, simulations, assessment, human coaching, competency evidence, progression review, and effective approved level history. AI may support practice and review, but only an authorized human decision can approve competency/progression outcomes.

Business Central remains authoritative for accounting and financial facts. RingCentral remains authoritative for telephony events. Recruiting systems remain authoritative for applicant/job history. Genius Seeker links verified references, evidence, and development outcomes without becoming a competing ledger, ATS, or HR master.

## Canonical Identity Rules

| Concept | Canonical rule |
|---|---|
| Person | `person_id` is an opaque immutable UUID and is never derived from email, name, phone, rep code, extension, or login subject. |
| Employment | `employment_episode_id` is a distinct UUID for each approved period of employment; rehire creates a new episode for the same person. |
| Learner context | `person_id + employment_episode_id + organization_scope + role_scope_ref`. |
| Source references | Preserve system, environment/project, organization/tenant/company, entity, original record ID, and available source revision/time. |
| Versions | Pin competency, rubric, assessment, scenario, product, and progression-framework versions used in a decision. |
| Actors | Preserve verified human identity/authority separately from AI/service provenance. |
| Corrections | Never silently rewrite prior accepted decisions; preserve revision/supersession/correction lineage. |
| Missing data | Missing, disputed, stale, or incomplete information is unavailable—not zero and not inferred. |

## Canonical Identity / Employment Entities

1. `person` — one verified human.
2. `person_external_identity` — source account/profile/issuer subject linked to a person when verified.
3. `employment_episode` — one employment period for a person within an employer scope.
4. `application_person_link` — recruiting application linked to a verified person.
5. `employment_alias` — effective-dated source employee/user/rep/extension assignment linked to an employment episode.

The current simulator implementation uses verified `learner_bindings` as a secure access/attribution mechanism. That binding is an implementation of the canonical identity boundary, not a replacement person master. See `../durable-learner-records.md`.

## Canonical Training / Progression Records

1. `training_assignment` — targeted, versioned work with reason, due date, supports, required evidence, and reviewer.
2. `training_attempt` — one occurrence of assigned or voluntary learner work.
3. `simulation_session` — one bounded practice interaction inside an attempt.
4. `assessment_result` — one AI or human assessment against exact criteria and evidence revision.
5. `coaching_session` — attributable human coaching/observation and development actions.
6. `competency_evidence` — traceable observation mapped to versioned competency anchors.
7. `progression_review` — frozen evidence packet, requirements, findings, learner response, and human decision.
8. `progression_level_history` — effective history of human-approved levels.

Existing implementation documents in this repository are deployment/behavior evidence for these concepts and remain valid:

- `../durable-learner-records.md`
- `../attributable-coaching-sessions.md`
- `../competency-evidence-deployment.md`
- `../competency-band-review-deployment.md`
- `../progression-review-deployment.md`
- `../scoped-reviewer-history.md`

## Definitions vs. Evidence vs. Decisions

Keep these separate:

- **Definitions:** competency versions, B1-B5 anchors, assessment criteria, scenarios, L1-L5 framework requirements.
- **Occurrences:** training attempts, simulations, coaching sessions, work observations.
- **Interpretations:** AI suggestions and identified human assessment results.
- **Evidence:** verified competency evidence with source provenance and admissibility.
- **Decisions:** authorized human progression reviews and approved level history.

Completion does not equal proficiency. AI score does not equal competency. Competency does not automatically equal advancement.

## Enterprise Source-of-Truth Boundaries

| Domain | Authoritative source | Genius Seeker role |
|---|---|---|
| Recruiting applications/jobs | Approved recruiting source / Join-Orion | Link verified person/application context; do not duplicate full ATS history. |
| Employment dates/status | Approved HR/employment source | Preserve verified employment episodes and effective-dated aliases. |
| Training/coaching/evidence | Governed learning records | Maintain attributable evidence and human-reviewed development history. |
| Telephony events | RingCentral | Reference and reconcile calls/events; do not infer successful communication from connection alone. |
| Financial/accounting facts | Microsoft Business Central / Finance | Read approved minimal facts and reconcile; do not post or maintain a competing ledger. |
| Progression approval | Authorized human review | Preserve evidence packet, framework version, rationale, approvals, and correction/appeal history. |

## Implementation Reconciliation

The live/staging simulator has already implemented important portions of this model: durable learner attribution, RLS-bound records, attributable coaching, competency evidence, human-reviewed B1-B5 bands, human-approved L1-L5 progression, and scoped reviewer history. Those implementations are not to be renamed or rewritten solely to match older conceptual naming.

Where implementation and conceptual terminology differ, this document defines meaning while implementation docs define current behavior. Any schema migration requires a separate reviewed change.

## Reporting / Funding Implications

The identity + employment + training evidence chain is the foundation for reliable reporting such as training participation, coaching coverage, approved progression, time-to-productivity, 30/60/90 retention, training ROI, and—after official requirements are verified—training-grant evidence packages.

For Indiana training funding work, use `../compliance-funding/indiana-employer-training-grant-crosswalk.md`. Do not infer grant eligibility or compliance from this model alone.

## Non-Negotiable Guardrails

- No fake person/employment records to fill gaps.
- No automatic AI promotion, risk label, or employment decision.
- No retroactive rewrite of historical learner identity.
- No Business Central write-back through this data model.
- No financial attribution from incomplete/unreconciled data.
- No training ROI claim without complete cost inputs and an approved evaluation basis.
