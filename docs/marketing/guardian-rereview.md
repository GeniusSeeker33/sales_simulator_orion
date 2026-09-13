# Human-requested Guardian re-review

A human writer may request a second Guardian assessment of a current unchanged draft after a successful `needs_changes` review. This applies to legacy persisted results as well as new, internally consistent recommendations. No historical result is reclassified or rewritten.

## Eligibility and execution

The migration generalizes `marketing.guardian_retry_context`, used by the existing `retry_guardian` command from PR #34. It does not add a new action, worker, retry loop or browser RPC.

Re-review requires:

- A successful Guardian `needs_changes` result on the active orchestration in `changes_needed` or `blocked`.
- The latest Creator run completed successfully and produced this same logical asset before Guardian.
- An entirely passing deterministic QA result containing the basic content, asset type, audience, channel and placeholder checks. Missing, partial or non-boolean QA evidence is ineligible.
- The exact current unpublished draft revision, task revision, campaign revision and effective policy snapshot matching the prior Guardian context.
- A verified human workspace writer, no active/uncertain stage, and no conflicting workflow ownership.

The existing command takes the same locks, validates the supplied optimistic revisions, records the immutable Guardian retry authorization, and starts only Guardian. Asset content, asset/task/campaign revisions, policy, and `revision_cycles` remain unchanged. Re-review remains possible at the Creator cycle limit because it consumes no Creator cycle. Duplicate requests with an old workflow revision return current state without inference; another request against the active Guardian revision is rejected.

All new completions still use PR #36 consistency validation. Ready results return to human review; consistent needs_changes results retain both human choices. Inconsistent and technical failures retain their existing retry paths. No agent can approve or publish.

## Evidence and presentation

`guardian_rereview_requested` is a safe projection of the immutable retry authorization joined to its successful needs_changes predecessor. History exposes the author, authorization ID, timestamp, predecessor/current run links, unchanged asset revision, task/campaign revisions, cycle count and policy version IDs. It adds no duplicate event/status table and preserves original findings.

Before re-review, Guided Work offers primary **Request Changes & Send for Revision** and secondary **Retry Guardian review**, with the explanation: “Run Guardian again on this same draft without changing the content or using a revision cycle.” Contributors can request review; existing approver/admin rules still govern human review decisions.

During the request and persisted Guardian execution, CHECK stays completed and REVIEW shows **Guardian reviewing again**. Creator revision controls are hidden. The same workflow card remains the unit of work and attention; prior stage signals never create an additional card. The new result supplies the next human actions.

## Verification

Database/API tests cover normal and legacy reviews, cycle 1/3 and the cycle limit, exact context and immutable content/history, active and completed duplicate requests, stale asset/task/campaign/policy denial, authentication/workspace boundaries, ready/needs_changes/inconsistent/technical-failure outcomes, and deterministic QA gating. Projection tests cover persisted and locally pending review stages. Browser coverage exercises both choices, the pending UI, unchanged revision 3 at cycle 1/3, a second recommendation, another re-review, authorization details, deduplicated navigation and final human approval.

The migration is committed for the normal reviewed release process. No deployment or hosted data change is performed by this PR.
