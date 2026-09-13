# Human-authorized orchestration recovery

PR #31 fixes asset revisions becoming detached from a failed task workflow. The asset form previously always requested standalone Creator work, while the workflow observer ignored terminal failures and the work projection used revision equality as ownership.

## Recovery boundary

`revise` stays on the existing authenticated orchestration API. The server locks the orchestration, task, campaign and asset, checks current workspace permissions, and validates an exact orchestration revision, asset revision, task revision, campaign revision and sorted active constraint-set IDs. It inserts an immutable `orchestration_revision_authorizations` record and increments the cycle atomically before creating the new Creator run.

Eligible work:

- Existing `changes_needed` work on its current draft (Guardian/preflight feedback), preserving the prior deliberate revision action.
- `changes_needed`, a failed Guardian stage, or `blocked` specifically for human constraint failure, with a current attributable human `changes_requested` decision on the same logical asset.
- Guardian failures must have a failed run with a known model, validation or persistence error and an earlier successful Creator result linked to the same asset.

Cancelled/completed workflows, exhausted three-cycle budgets, changed/missing task or campaign context, missing/ambiguous asset lineage, another active workflow on the task, in-flight/uncertain stages and missing write permission are ineligible. Creator-stage failures are not terminal-recovery candidates in this increment. Ineligible cases require inspection/manual handling or a new orchestration; they never silently fall back to standalone Creator.

The original orchestration ID, task, campaign, workflow, initiator and initial scope revisions stay fixed. Each revision authorization identifies the acting human, prior workflow revision/state, reviewed asset revision, human decision, constraints, instructions and cycle number. Existing terminal snapshots remain immutable. The audit trigger permits a failed/blocked current row to advance only when its exact new state matches that durable authorization. Completed and cancelled rows remain terminal.

## Execution and retries

Creator saves a revision of the same asset. Existing PR #29 deterministic preflight runs on that result: violations preserve Creator evidence and stop at `changes_needed` (or `blocked` at the cap); a pass hands the exact revision to Guardian. Guardian recommendations lead to review or changes needed. Actual human approval and explicit task completion remain separate actions.

An old expected orchestration revision returns current evidence without a new run token. A refresh/new request while a stage is active cannot authorize another revision. The task lock and existing partial unique index prevent a second active orchestration. Constraint edits during inference still reject stale output through the existing finalization checks. Delayed callbacks from an earlier cycle cannot block a later human-authorized cycle; same-cycle uncertain handoffs retain their existing fail-safe handling.

Standalone Creator initiation and finalization both reject revision of a task-owned asset. This also prevents an already-started legacy standalone revision from applying after rollout. Already-completed detached revisions remain in asset history; a new human change request can explicitly adopt the current logical asset back into its original workflow, subject to all guards.

## UI and rollout

Task-owned assets offer **Revise with Agent Team**, identify the existing workflow and explain the preserved Guardian/human gates. Task details show recovery availability, exact latest human notes, constraints and the cycle count. Assets created outside orchestration retain standalone Creator behavior. The shared work projection groups asset decisions by workspace/campaign/asset lineage rather than equal revision numbers, so the Agents badge and current-work cards stay aligned.

Apply `20260913154417_marketing_orchestration_recovery.sql` through the normal release process before the new UI/API. No hosted migration, data edit, deployment or live model call was performed for this PR. Existing fixtures execute all Marketing migrations locally in PGlite. Tests reproduce rejected Guardian persistence, recovery and preflight failure, stale/version/permission rejection, duplicate initiation and late callbacks, legacy detached/in-flight revisions, immutable evidence, grouping and final human approval/task completion.
