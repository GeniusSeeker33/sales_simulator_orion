# Human-approved L1–L5 progression — Issue #23

Related to GeniusSeeker33/geniusseeker-talent-success-platform#23. No database migration, initial-level provisioning or production deployment was performed.

## Scope and authority

- Two private, RLS-enabled tables: `learner_progression.reviews` and `level_history`. No authenticated direct reads/writes or sequence access. Explicit invoker RPCs call private scoped implementations with empty search paths. Existing authenticated exact-episode scopes are rechecked on every request; no email/name privilege elevation or browser service-role credentials.
- Reviewer writes require active approved, unexpired/unrevoked scope and a separate active learner binding. Reads permit only own current learner episode or explicitly assigned reviewer episode. Historical retired-episode scope is read-only. Rehire starts with no official level; nothing transfers by matching person.
- `publish_progression_review(p_id,p_scope,p_body)` derives person, employment episode, reviewer, current level and source-history reference server-side. Per-episode advisory transaction lock serializes decisions; authorization is rechecked under scope/binding locks. The client must submit the exact `expected_history_id` it reviewed. A changed head rejects the decision rather than silently selecting a new starting level. Identical UUID/body retry rechecks scope and returns the existing receipt, without creating another review/event.
- `read_progression_reviews(p_scope,p_before)` returns 51 reviews at most (50 displayed + pagination sentinel), using a server-generated sequence cursor encoded as text. Each review includes its official history event; the initial confirmation and current official level/history ID accompany each page. No raw private source content or initial restricted approval reference is returned.

## Explicit human review

Records preserve immutable UUID, binding/person/episode, reviewer/scope, framework and competency version, current-level snapshot, from-history and observed-head references, selected outcome, exact band/supporting references, rationale, development plan, human framework confirmation, reviewed/recorded timestamps, completed status and supersession/revision/reason.

Allowed outcomes: remain_L1, advance_L1_to_L2, remain_L2, advance_L2_to_L3, remain_L3, advance_L3_to_L4, remain_L4, advance_L4_to_L5, remain_L5, defer_insufficient_evidence. No outcome is preselected, including corrections. No skipping, automatic promotion, score average or attempt-count rule. Rationale is required; remain/defer requires a development plan. `completed` means the human review was recorded, not that advancement occurred.

The version pair is pinned to `orion-sales/0.1-draft`. The explicit adjacent-only Issue #23 scope takes precedence over the broader draft framework's possible direct-placement exception. There is no direct-placement endpoint.

### Evidence and framework checks

- Band refs must be exact current non-superseded IDs/revisions, same learner binding and competency version. Select at most one review per C01–C15 to avoid treating conflicting reviews as one accepted profile. Source locks serialize against band correction. All supplied references, even on remain/defer, are validated; stale references cannot be disguised as context.
- Advancement requires a non-deferred human band review for each of the 15 domains plus an explicit human confirmation that **all** target framework requirements were met. This is coverage validation, not a computed level: no automatic outcome, band averaging or attempt threshold. The software does not substitute this checkbox for independent reviewer/manager approvals, competency minima, work transfer, freshness, opportunity context, evidence equivalence or prospective L5 specialty agreement. These remain substantive human checks under the pinned draft, and their approval references/context must be recorded in the rationale without copying private artifacts. Do not activate operational decisions until leadership has approved this process and the draft parameters.
- Optional supporting refs accept only current human-reviewed competency evidence IDs/revisions from the same episode/version. Raw attempt, simulation or coaching IDs and arbitrary artifact URLs are rejected. Coaching/practice may contribute through prior human-reviewed evidence. Real-world integrations are not invented.
- Stored snapshots contain only source ID/revision, band/finding, competency/type and system/entity/environment/project context. No copied transcripts, recordings, coaching narratives, AI feedback or unrelated PII. Reviewer rationale/plan is learner-visible and must be newly written, concise and appropriate to share.
- Technical failure, disputed evidence and missing opportunity never compute a negative decision. A defer or source correction does not automatically lower an official level. A later superseded band/support reference is flagged when reading the original review, but the original decision/history remains until explicit authorized reconsideration.

## Official history and corrections

1. **Unknown baseline:** no history means unavailable, never implicit L1. An administrator must record a separately documented human L1 enrollment confirmation using the private initialization function below. It is not executable by authenticated users and is not an exposed API. Only L1 can be initialized, once per binding. The initial event preserves approver identity, exact scope, written-approval reference, rationale, source context and timestamp. It is labeled initial_confirmation, not advancement.
2. **Advance:** atomically insert review + `advancement` event linking that review and the previous official history. At most one event per review and one successor per history row. Current level derives from the newest committed event in the same episode. History effective order is server-recorded sequence/time, never browser or backdated reviewed_at.
3. **Remain/defer:** ordinarily insert review only. No false advancement, inherited level or level reset. Development plan is required.
4. **Correction:** original reviewer with active scope may supersede only the **latest episode decision**, preserving its original starting history/level. New current evidence, explicit outcome and reason are required. If the original decision affected history, append a `correction` event, even if the corrected level is unchanged; never edit the previous event. Replacing the latest advancement with remain/defer explicitly retracts it to that decision's starting level. The UI explains this before publication. This is correction of an erroneous decision, not discipline or an automated downgrade. If a prior remain/defer is corrected into advancement, append a correction event at the adjacent target.
5. **Dependent decisions:** a decision with later episode reviews cannot be corrected through this narrow endpoint, even for narrative edits. Otherwise its correction could invalidate later baselines. Independent/older-review appeals, unavailable-original-reviewer escalation and multi-decision repair need a separately approved workflow; never bypass immutable history or edit rows manually to simulate it.

No HR/employment action, compensation, commission, external integration, dashboard or employee ranking is triggered. Existing legacy browser levels remain quarantined. The practice Levels page is not made an official progression source by this change; official history appears only in the new panel.

## Manual staging/provisioning (not performed)

1. Leadership/HR/training owner approves draft framework use, names appropriate progression approvers and verifies any required distinct human approvals before publication. Review existing scope grants: this migration adds progression publication to those same scopes. Revoke inappropriate grants before rollout; learners cannot self-provision or self-confirm an initial level.
2. IT applies `supabase/migrations/20260905194609_human_approved_progression.sql` manually in isolated staging after the prior five migrations. Keep learner_progression and all other private learner schemas unexposed in Data API settings. Verify explicit public RPC grants, table/sequence denial and trusted function ownership. Run hosted Security Advisor before release.
3. After a documented initial L1 approval for a verified episode, an administrator may execute the following with the **reviewed staging scope UUID and restricted written-approval reference**, never a browser identity guess. This records the human approval; the migration itself initializes nobody:

   ```sql
   select learner_progression.initialize(
     '<approved-scope-uuid>'::uuid,
     '<restricted-written-L1-approval-reference>',
     '<concise learner-visible L1 confirmation rationale>'
   );
   ```

   The scope identifies the approving human and exact active episode; the function validates its approval/revocation/expiry and prevents duplicate or higher-level initialization. The privileged operator must verify the referenced human approval independently. Initial-record corrections are a separate governance decision; do not overwrite or re-run initialization.
4. Use separately authenticated synthetic staging learners A/B, scoped reviewer, outside reviewer and approver. Existing publishable-key learner client suffices; no new secrets or production data. Run checks below, then obtain IT/data-owner approval for production migration/provisioning/UI release. No automatic production step is included.
5. Rollback access by disabling new UI/public RPC execution and revoking affected scopes through an approved operational change. Preserve reviews/history. Revocation prevents future requests but cannot erase content already received by a client. UI refresh/focus/30-second polls recheck access and hide unavailable results; drafts remain in memory only.

## Verification and staging acceptance

`npm run test:learner` executes all six actual migrations in isolated PGlite PostgreSQL with authenticated/anonymous roles, synthetic subjects and disk restart. New tests cover unavailable baseline/private initialization, exact reviewer scope, no explicit-outcome default, adjacency, required rationale/plan, source version/episode/revision/supersession, defer/remain with no advancement, atomic advancement/idempotency, stale history head, append-only retraction/re-approval corrections, later-decision blocking, all adjacent transitions, read-only learner history, rehire, pagination and unchanged employment/compensation sentinels. Previous learner/coaching/evidence/band/legacy tests also run.

PGlite does not exercise hosted JWT/PostgREST, actual browser flows or concurrent independent connections. Required staging checks:

- Confirm initial state is unavailable; browser cannot invoke initialization. After authorized manual L1 confirmation, reviewer sees L1 and an empty outcome selector. Read the band-review body, explicitly choose remain/defer/adjacent advance, provide rationale and required plan/confirmation. Advance only after the framework's actual human requirements are satisfied. Verify reload/new session preserves review and official history.
- Learner sees rationale, reviewer, versions, source IDs/revisions, plan, timestamps and full paginated correction/history chain, with no write controls. B/outside/revoked/expired users fail direct RPC attempts as well as UI reads/writes, using the same still-valid JWT after revocation.
- Wrong episode/version, stale or superseded band, duplicate domain, arbitrary source, missing rationale/plan, missing explicit outcome and skipped level all fail. Missing/disputed/technical support never selects a negative outcome. A band corrected later flags history but does not lower the official level.
- Remain/defer add no advancement. Correct the latest advancement to defer: original event remains, correction explicitly restores its starting level. Newer decisions block older corrections. Rehire gets no inherited level or old evidence permissions.
- In separate staging connections, race two advancement publications from the same head: only one can create the next event; the other must refresh. Race scope/binding revocation and band correction against publication: no decision may use a revocation/supersession committed before its relevant authorization/source lock. Review committed-before-revocation events as legitimate history. Deadlock/serialization failures must roll back the entire request and be retried with unchanged UUID/body or refreshed evidence as appropriate.
- Verify no HR, pay, commission or external integration writes; no automated L-level changes on practice completion or AI results. Run Security Advisor and inspect grants before release.
