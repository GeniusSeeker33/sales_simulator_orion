# Marketing human resolution actions

Successful Strategist proposals can be accepted without creating tasks, dismissed, or turned into selected campaign tasks. Guardian recommendations of `ready_for_human_review` can be handed to human approval when the assessed asset is still the current unpublished draft.

## Authority

| Action | Viewer | Contributor | Approver / admin | Agent / service role |
| --- | --- | --- | --- | --- |
| Read workspace evidence | Yes, within workspace | Yes | Yes | No new grants |
| Accept / dismiss / create selected tasks | No | Yes | Yes | No |
| Send current Guardian draft to Approval | No | Yes | Yes | No |
| Record approval or request changes | No | No | Existing human workflow | No |

`resolve_marketing_agent_run` derives the acting human from `auth.uid()`, checks and locks workspace membership, and locks the successful run before checking for an existing resolution. There is no actor identity parameter. One resolution per run prevents conflicting or repeated task creation. The service role and browser have no direct resolution table writes. Existing private agent RPC grants are unchanged.

Task selections are zero-based JSON integer indices into the persisted Strategist `proposed_tasks`, never browser-supplied text. Duplicate, out-of-range, malformed or empty selections fail. Each selected title is checked and passed to `save_marketing_task` with `todo` status and no owner or due date. Creation and resolution insertion are one transaction; any failure rolls back all tasks and their history.

Guardian submission checks the persisted recommendation, deterministic QA, asset workspace/campaign, assessed revision, draft approval state and unpublished state under a row lock. It calls the existing human `write_marketing_asset(..., 'submit', ...)` pathway. It cannot approve. A stale or already-submitted asset is rejected, and the control disappears after refresh. Other outstanding Guardian blockers remain visible under existing conservative attention rules.

## Immutable evidence and attention

Migration `20260912185640_marketing_human_resolution_actions.sql` adds `marketing.agent_run_resolutions`, an append-only record containing workspace, campaign, run, human UUID, action, timestamp, optional note and created task IDs. The run link is unique; task IDs link back to their human workflow history. The migration also adds the governed human RPC and includes resolution evidence in the existing permission-scoped workspace snapshot. No changes to immutable agent runs or existing workflow evidence are required.

Strategist resolution evidence clears that proposal's yellow signal. A current Guardian-ready draft gets yellow attention even without findings. Sending it to Approval clears that run's advisory signal and exposes the asset's red review gate. A separate human approval clears the gate; requested changes keep the red revision-response gate. New content/human decisions supersede older Guardian evidence under existing revision rules. These are projections, not stored duplicate statuses.

The Agents view shows selected-task controls, optional human notes, and explicit resolved labels with actor UUID and timestamp. It retains history and uses the same derived attention counts as Overview and navigation. Failed refreshes retain the recorded action locally and surface the error; Refresh runs reloads durable evidence.

This migration must be applied separately before using the new UI. It was tested only in local PGlite fixtures; no hosted migration or deployment was performed.
