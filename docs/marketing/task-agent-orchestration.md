# Governed task-to-agent orchestration

An existing campaign task is the unit of work. A contributor, approver, or admin explicitly selects Strategist only, Creator → Guardian, or Strategist → Creator → Guardian. Viewers can inspect evidence. The existing task has a title, owner, status and due date; optional assignment/revision instructions add human context without changing task scope or campaign authority.

## State machine and gates

| Workflow / action | Server transition |
| --- | --- |
| Assign Strategist only | strategist_running → awaiting_plan |
| Accept Strategist-only plan | awaiting_plan → completed |
| Assign Creator → Guardian | creator_running → guardian_running |
| Assign Strategist → Creator → Guardian | strategist_running → awaiting_plan |
| Accept and continue combined workflow | awaiting_plan → creator_running → guardian_running |
| Guardian ready | guardian_running → awaiting_review |
| Guardian needs changes | guardian_running → changes_needed; blocked after the third revision cycle |
| Explicit human revision | changes_needed → creator_running → guardian_running |
| Send to Approval | awaiting_review → awaiting_approval |
| Separate human approval | awaiting_approval → completed |
| Separate human requested changes | awaiting_approval → changes_needed |
| Stale context / uncertain handoff | blocked |
| Failed or invalid model stage | failed |
| Explicit stop | cancelled |

There is no automatic Strategist-to-Creator authority transfer. Every plan pauses for attributable human acceptance. For a simple drafting task, the narrowest workflow is Creator → Guardian: the human-selected task and asset type authorize drafting; calibrated Guardian QA remains advisory. No workflow launches campaigns, publishes, sends, changes campaign settings, or records approval.

Creator produces one draft or revises the same logical asset. Guardian assesses precisely that produced revision. A human may inspect the asset manually or explicitly request a further revision, with the prior content, task/brief, previous Guardian findings, optional instructions, and any formal human change request supplied server-side. The limit is three revision cycles, with no model retries or recursive calls. Standalone human workflows remain available; external edits cause stale orchestration checks rather than silent adoption of changed context.

Approval remains the existing approver/admin-only asset action. Its immutable workflow event advances the matching orchestration to completed. A separate `Mark task complete` action uses the existing human task RPC, checks the original task revision, and preserves owner/due date. Assignment and agent completion never silently complete a task.

## Storage and authority

Local migration `20260912192217_marketing_task_orchestration.sql` adds `marketing.task_orchestrations` and append-only `marketing.orchestration_history`. Identity includes workspace, campaign, task, initiating human, selected workflow, task/campaign revisions and asset type. Mutable coordination fields record state/revision, run IDs, asset/revision, revision-cycle count, timing, human instructions and failure reason. Terminal records and all history entries are immutable. Browser and service roles receive no direct table writes.

`/api/marketing-orchestration` authenticates a non-anonymous human using the repository's Supabase auth boundary. Its service-only command RPC checks current workspace membership, verifies the task's campaign/workspace, and derives all stage and result IDs. No browser actor identity, workflow/state override, model-selected workflow, or supplied result asset/run is accepted. Human decisions record the current human, while automatic stage transitions are labeled server transitions.

The server reuses `inferMarketing` for the existing OpenAI Responses call, strict output contracts, usage accounting, timeout/no-retry configuration and PR #26 QA calibration. Durable runs retain the existing immutable lifecycle. Their input metadata adds the specific task, trusted orchestration snapshot, accepted plan and prior Guardian evidence. Existing private Creator writes save the draft and immutable revisions; only the trusted orchestration path allows a human-authorized revision of a Guardian-rejected draft without fabricating a formal human review decision.

Plan acceptance and Send to Approval reuse PR #27 human resolution records. Detailed Agents history remains available through timeline links. Workspace reads include orchestration records and timeline evidence under the existing membership check.

## Failure and idempotency

Stable assignment IDs, an optimistic orchestration revision, row locks, and a partial unique index allow one active orchestration per task. Duplicate/stale action requests cannot create another stage or asset. Only the initiating request owns the returned stage context. One request executes at most two model calls (Creator then Guardian); Strategist always stops at a gate. There is no scheduler, polling-driven inference or background worker.

Each stage finalization validates fresh permissions, task/campaign/asset revisions, and the active run before applying results. A failed Creator stage leaves no new asset; a later Guardian failure preserves the completed Creator evidence and stops advancement. A lost completion response is never an instruction to repeat inference: an uncertain next-stage handoff is blocked. Cancellation fails an in-flight run so late model results cannot apply. A fresh active stage is clear; after the existing two-minute execution window, refresh derives an uncertainty alert and the human inspection action can persist a blocked state. No timeout starts another model call.

Attention replaces linked per-run alerts with actionable task gates. Asset approval/request-change gates are deduplicated only when they represent the same condition; separate failures/stale-context issues remain visible. Completed work with an open task is yellow; completed work with a done task is clear. Failed/blocked terminal records retain their inspection evidence, including after a human starts a new orchestration.

## Validation and rollout

Local PostgreSQL integration tests cover the three workflows, role/workspace denial, mismatched tasks, duplicate assignments/actions, exact asset revision and run links, human gates, three-cycle limits, immutable evidence, failure/stale/permission handling, cancellation, uncertain handoffs and separate approval/task completion. Browser tests exercise the complete combined workflow and viewer read-only behavior alongside the existing Marketing suites.

Apply the local migration separately before enabling the UI/API increment. No hosted migration, hosted data change, deployment or live model call was performed during implementation. Existing build bundle-size warnings are unchanged.
