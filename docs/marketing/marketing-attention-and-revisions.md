# Human attention and governed Creator revisions

Attention is a deterministic presentation of existing campaigns, assets, agent runs and immutable workflow history. There is no attention status column, manually maintained duplicate state, dismissal flag or inferred approval.

## Rules

| Evidence | Presentation | Clearing rule |
| --- | --- | --- |
| Asset or campaign `in_review` | Critical / Human action required | The current approval state changes through its existing workflow |
| Asset or campaign `changes_requested` | Critical / Human action required | A saved response/revision or subsequent workflow decision changes the current state |
| Failed, started or cancelled agent run | Critical / Human action required | A confirmed durable outcome is required; opening the run does not fabricate an inspection record |
| Guardian `needs_changes` or failed deterministic QA | Critical / Human action required | A later content-save revision or human approval/change-request decision supersedes the assessed revision |
| Guardian findings with a nonblocking recommendation | Attention / Review recommended | Same supersession rule as Guardian issues |
| Successful Strategist proposal | Attention / Review recommended | No acknowledgment/action linkage currently exists, so the proposal remains visible |
| No applicable unresolved evidence | Clear | Means no action under these rules, not certification of quality or approval |

Submission alone does not clear Guardian findings, even though it increments the workflow revision. A later passing Guardian assessment without a content revision or human decision also does not silently dismiss an earlier issue. A human change-request decision supersedes earlier Guardian attention but creates/retains the asset's red requested-change gate. Missing Guardian revision/context metadata is red rather than presumed resolved. Failed runs remain visible because terminal outcomes are immutable and this increment does not add an operator-inspection acknowledgment workflow. Recent `started` runs are conservatively unconfirmed, including while inference is running.

`read_marketing_attention_workspace` retains the existing membership/workspace selection boundary and returns compact evidence for **all** workspace runs, plus the latest relevant content/review event for each asset. Counts are not computed from the 50-run activity feed. `src/lib/marketingAttention.js` is the shared pure projection for Overview, navigation and campaign/asset/run indicators. It sorts critical before attention, then timestamp descending with stable ID ties. Approvals counts asset gates (review and requested changes); Agents counts unresolved run items. Multiple kinds of evidence can refer to the same asset, so these are item counts, not a count of distinct campaigns.

Overview's Needs Your Attention section exposes reasons, campaign, asset/run identity, timestamp and direct action links. Run deep links can retrieve an older run outside the activity feed via the membership-checked `read_marketing_agent_run`. Asset deep links open that asset in the campaign. Approvals retains requested-change assets to keep the response handoff visible. Status labels combine text and distinct icons with red/yellow/green styling; navigation badges have accessible count/severity descriptions. Refresh is explicit and local writes reload the shared evidence. Read failure is shown as unavailable, not clear.

## Creator revision authority

The existing server endpoint accepts a narrow Creator revision request: target asset, expected campaign and asset revisions, optional supplemental instructions and the explicit save-only/resubmit choice. The server verifies Supabase Auth and the database checks contributor/approver/admin membership. The target must belong to the campaign/workspace, be agent-created, unpublished and currently `changes_requested`. The exact current revision must have immutable human change-request notes. Viewer, foreign-workspace, stale and nonmatching requests are denied before inference. No browser actor-mode, creator identity or private write grant is introduced.

The start RPC constructs the context from the current campaign/KPIs/tasks, prior asset content/revision, human decision snapshot and the latest successful Guardian assessment for that content version. Content-version matching accounts for submission and human review incrementing workflow revisions without changing content. A Guardian assessment from before the latest content save is not included. Supplemental instructions cannot replace the stored human feedback. Instructions are versioned as `marketing-v2`; completion of existing `marketing-v1` runs remains supported.

On completion, the same membership, campaign revision and asset revision/state checks run again under locks. Creator saves through the existing private agent pathway to **the same asset ID**. It may then submit the revised revision if the initiating human requested this. The original `created_by`, `created_via` and `assets.agent_run_id` remain creation provenance. New `asset_saved`/`submitted` history entries attribute the revision to the new run; that run records the prior content, human decision, Guardian assessment, output and outcome asset ID. The UI exposes this handoff evidence and links to prior Guardian runs. Nothing edits old run or workflow snapshots.

Malformed output, API failure, stale context or a failed write leaves the asset unchanged by that run and records failure. Saving and optional resubmission share the completion transaction. Creator and Guardian cannot approve, request changes as a human, activate campaigns, publish, send messages, change budgets or launch campaigns. Approver/admin review remains a separate human action.

## Release and verification

Migration `20260912172142_marketing_attention_creator_revision.sql` follows the PR #24 migration. Existing server environment variables remain sufficient. No hosted migration, deployment, connector or autonomous worker is introduced.

Focused tests cover severity/order/count derivation, conservative ambiguity, superseded Guardian evidence, workspace isolation, attention beyond 50 runs, deep reads, complete feedback handoff, new-run revision attribution, unchanged historic content, save-only/resubmit, stale campaign/asset rejection, malformed output and forbidden approval. Browser coverage checks red/yellow/green text, badge descriptions, Overview actions, revision handoff and a separate human decision. Marketing, API, learner, realtime, conversation/auth regressions, targeted lint and build use the same validation approach as PR #24: local PGlite and synthetic/mocked external boundaries, not hosted or live inference verification.
