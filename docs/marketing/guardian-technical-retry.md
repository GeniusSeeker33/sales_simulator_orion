# Guardian technical failures and retries

The guided CHECK stage represents deterministic Marketing Policy evaluation only. REVIEW represents Guardian/human readiness:

| Evidence | CHECK | REVIEW | Primary action |
| --- | --- | --- | --- |
| Deterministic policy violation | Policy issue | Not reached | Send Back for Revision |
| Guardian running after preflight | Completed | In progress | Wait / refresh |
| Guardian succeeds, recommends changes | Completed | Human decision needed | Request Changes & Send for Revision |
| Guardian succeeds, ready for human review | Completed | Human decision needed | Approve / Request Changes |
| Guardian fails technically | Completed when deterministic evidence passes | Guardian could not complete | Retry Guardian |

Guardian findings that require correction appear directly in Guided Work. Informational findings and semantic evaluations remain under View Guardian details. Technical codes, safe diagnoses, exact reviewed revision, policy version IDs, timestamps and retry links appear under Advanced technical history / the exact run view.

## Hosted investigation

Read-only inspection of the reported hosted failure found that the compatibility-restored `marketing.finish_marketing_agent_run_before_constraints` accepted only `summary`, `recommendation`, and `findings`. The policy-aware caller always supplies `constraint_evaluations`, which that older function rejected. The hosted run's asset, task, campaign and effective policy snapshots were unchanged at inspection. Its discarded output was not retained, so the exact response cannot be reconstructed from the durable row.

The regression test reproduces the structural condition with synthetic work and an older whitelist, then applies the same explicit canonical function definition included in this migration. No production run ID is embedded in application code or tests. The repair permits the required field without removing the outer count/ID/status checks or deterministic enforcement. Semantic `human_instruction` evaluations may be `semantic_review`; deterministic violations still override model judgments.

## Retry authority and persistence

Only an authenticated workspace contributor, approver or administrator may explicitly request `retry_guardian` through the trusted server. Browser roles cannot call private RPCs or declare an agent identity. The database locks the work and validates current membership, run lineage, task/campaign/asset revisions, asset state, complete effective policy snapshot, preflight and absence of another active stage/workflow.

The same orchestration transitions from failed/blocked to guardian_running with one new Guardian run. Asset content, asset revision and `revision_cycles` remain unchanged, including at the three-Creator-cycle limit. The immutable `guardian_retry_authorizations` row attributes the request to the human and links failed and retry run IDs plus the reviewed revision and policy snapshot. One authorization per prior run and orchestration revision prevents duplicate execution; stale request replay returns current work without a new run. A delayed predecessor callback cannot cancel its retry.

Changed asset/task/campaign/policy context blocks retry with safe guidance to refresh and inspect. It is never silently adopted by a technical retry. Existing explicit human Creator-revision paths remain separately governed. Content approval and task completion remain human decisions.

New terminal Guardian failures also append a row to `agent_run_diagnostics`. Diagnoses use a finite safe vocabulary and never store raw provider/SQL exception text. Existing public error codes and immutable run/history rows remain intact. Older failures without retained diagnostic evidence display a general rejection reason rather than inventing a precise cause.

Migration: `20260913210952_marketing_guardian_retry.sql`. No deployment, hosted migration, or hosted data modification is part of this change.
