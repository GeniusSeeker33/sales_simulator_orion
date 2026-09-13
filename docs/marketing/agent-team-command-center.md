# Agent Team Command Center

Marketing → Agents defaults to current work. `deriveAgentWork` projects the existing workspace attention, tasks, orchestrations, compact runs, constraint checks and approval evidence; no new persisted status or migration is required.

- **Needs You:** one card per unresolved orchestration, including its current asset gate. Standalone agent attention is grouped by asset when applicable; otherwise by run. An unrelated failed run is not absorbed into another workflow. Failed/blocked workflows remain actionable, conservatively, until the underlying attention rules resolve them.
- **Working:** active workflows without a current attention condition. Refreshing re-evaluates uncertainty; it never initiates inference.
- **Recently Completed:** latest ten resolved workflows, including stopped workflows. Completed work whose task remains open stays in Needs You until explicit human task completion.

The Agents badge and default cards use the same projection. Approvals retains its asset-gate count; a shared asset gate can be represented in both navigation destinations. A card explains the combined condition, so historical stage runs do not inflate the Agents badge.

The task and Agents views share the same summary, revision count, pipeline and governed action controls. Creator and Guardian stages use the latest ordered execution cycle, excluding Guardian evidence before the latest Creator run. A plan checkmark requires its persisted human acceptance. Current constraint checks take precedence over recorded preflight; stale asset context is marked uncertain. Approval completion requires the matching asset revision and actual approved state. Missing evidence is never treated as a successful agent run.

Constraint failures name the matched rule and phrase. Details offer the existing revise, manual review and stop paths. All mutations still use the authenticated orchestration API and its expected revision. Asset review links include the asset ID and current revision; an outdated link explicitly displays the new revision and asks the human to review current content. Approval remains in the existing human review form.

Run History retains the recent 50 raw runs with campaign/task/agent/status filters, IDs, usage, model and instruction versions, outcomes and QA. The task timeline retains links to every recorded stage, including older runs available through exact-run lookup. Existing asset history preserves all prior content and human decisions. No audit evidence is edited or removed by this presentation layer.

Validation includes pure projection tests, a browser reproduction of historical Clear runs alongside current unresolved work, badge correspondence, responsive layout, revision links, history filters and authoritative resolution clearing. Existing browser tests still exercise real local SQL and governed action APIs for plan acceptance, constraint revision, submission, human approval and task completion. No hosted data, migration, deployment or live inference is involved.
