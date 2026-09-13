# Guided Marketing work and inherited policy

A task's Guided Work and the Agent Team Command Center present the same server-provided actions. The compact PLAN / CREATE / CHECK / REVIEW / DONE display is a projection of existing run and workflow evidence, never another persisted status. Asset links also open the guided card for task-owned work. Advanced technical history retains prior runs, revisions and decisions.

## Authority

| Action | Viewer | Contributor | Approver / admin | Agents |
| --- | --- | --- | --- | --- |
| Read scoped work / effective policy | Yes | Yes | Yes | Supplied scoped snapshot only |
| Assign work, accept plan, authorize preflight revision, complete eligible task | No | Yes | Yes | No |
| Request changes and authorize revision in one action | No | No | Yes | No |
| Approve content | No | No | Yes | No |
| Create / supersede workspace or campaign policy | No | No | Yes | No |
| Create attributed content / advisory QA | No | Through explicit request | Through explicit request | Trusted stage only |

Existing contributor authority to add asset constraints remains unchanged. Campaign activation, publishing, sending, budgets and task completion are never agent powers.

## Persistence and execution

`marketing.policy_versions` is append-only, with one linear supersession chain per workspace or campaign. Effective rules combine current workspace policy, current campaign policy, and current asset/review constraint sets. Scopes are additive; review rules cannot remove standing requirements. Superseding one scope never edits another scope. Empty superseding sets explicitly retire that scope's rules. Prior versions remain immutable.

Each run snapshots complete effective sets, source labels, rule and version IDs, human authors and timestamps. All roles receive that context. Persistence compares the snapshot to current effective policy, rejecting stale inference. Human asset constraints persist across revisions by logical asset/orchestration identity, independent of the revision that introduced them.

`human_instruction` is semantic and explicitly marked as requiring review. Existing deterministic claim/phrase checks remain bounded heuristics, not factual verification. `approved_destination` rejects detected URLs/domains other than the configured hostname/root destination (including invented paths); it does not require every draft to include a URL. `required_destination` remains available when a destination must appear. Guardian assesses every effective rule; advisory judgments never count as approval.

The authenticated server API accepts a `review` command. The database verifies the human review role, orchestration/asset/task/campaign versions and active policy IDs, then executes one transaction:

- Request changes: record the human decision; supersede asset rules only if changed; preserve inherited policy; insert PR #31's immutable revision authorization; return a new Creator stage owned by the same orchestration.
- Approve: record submission if needed, record the actual human approval, and advance the same orchestration. Task completion remains a separate command.

A failed command rolls back decision, rules and authorization together. A replay with the previous orchestration revision returns current evidence without creating another stage. Creator and Guardian execute through the existing bounded server loop. A model failure preserves the already-recorded human request and a failed run. Deterministic preflight can preserve a failing draft for inspection and stops before Guardian. No background execution is introduced.

PR #31's permission, lineage, active-stage, concurrency and three-cycle checks also govern **Continue this work**. Missing human feedback is collected within that same interaction. Closed, ambiguous, active or stale campaign/task work cannot be revived by the UI.

## Human-controlled Orion setup after deployment

This PR does not deploy, apply hosted migrations, configure policy, or modify hosted data.

After an authorized deployment and migration, a workspace approver/admin may review `orion-policy-draft.json` and load it into Marketing → Settings → Workspace Marketing Policy → Import policy draft. Loading only edits the local form. Review every rule against the actual workspace, merge any current rules that must remain, and click **Save Marketing Policy** explicitly. The saved version records the human and timestamp. The ten suggested defaults are documentation, not application or migration defaults.

Campaign settings provide the same editor. For a proposed referral campaign, humans can add semantic instructions such as “Referral program is proposed, not active” and “Any reward or incentive structure requires Orion approval.” These are examples, not automatically applied rules.

The migration is `20260913194223_marketing_guided_policy.sql`. Local integration and browser tests apply it to isolated PGlite databases, never hosted Supabase.
