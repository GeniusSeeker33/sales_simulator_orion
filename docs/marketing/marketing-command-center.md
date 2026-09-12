# Marketing Command Center Foundation

**Status:** implemented repository foundation; environment deployment is not implied. Explicit governed agent runs are implemented; publishing and cross-channel ingestion/reporting remain future work.

## Purpose

The Marketing Command Center adds governed campaign planning to the Genius Seeker / Orion platform. Its current scope is deliberately narrower than an autonomous marketing system: authorized workspace members can plan and review attributable campaigns while human approval remains the boundary for activation and publication.

## Implemented foundation

### Tenant-aware workspaces and campaigns

- Marketing records are scoped to a workspace, with the initial Orion workspace supplied as seed data for environments that apply the migration.
- Workspace membership uses `viewer`, `contributor`, `approver`, and `admin` roles.
- Campaign reads and writes are workspace-scoped. Campaign ownership must refer to a member of the same workspace.
- Campaign plans can record objectives, audiences, channels, budget, dates, status, approval state, KPIs, tasks, and attribution keys.
- The application provides a workspace overview, campaign create/edit/list views, structured briefs, operational tasks, text assets, and human review for provisioned members.

Here, **tenant-aware** means that the data model and authorization boundary scope records by workspace. It does not claim self-service tenant provisioning, billing isolation, or a completed multi-tenant administration product.

### Attribution foundation

- Every campaign has a workspace-unique attribution key.
- The schema models attributed events with source-system and source-event identifiers for idempotency.
- Agent-run and campaign-transition records provide an audit-oriented basis for attributing changes.

The schema is ready to receive attribution records, but automated cross-channel ingestion, metric aggregation, dashboards, and outcome reporting have not been implemented.

### Human approval governance

- Campaigns cannot become active unless their approval state is approved.
- Only a human caller with an `approver` or `admin` workspace role can approve a campaign through the exposed campaign workflow.
- Campaign transitions are append-only and record the actor and state change.
- Agent-attributed writes are prevented from approving or activating campaigns.
- Publication records are modeled so that published assets require approval and human publisher attribution.

Campaign approval remains part of campaign settings. The Approvals section now lists assets in review across the selected workspace. Publication is not implemented.

## Governed campaign workflow

Campaign detail follows **Brief → Tasks → Assets → QA → Approval** inside the existing Marketing navigation.

- Briefs reuse campaign objectives, target audiences, channels, and `campaign_kpis`. Added campaign fields hold the offer, CTA, key message, requirements, and notes. Saving a brief increments the campaign revision, resets campaign approval to draft, and records an audit entry. Active campaigns must first be paused.
- Tasks use `campaign_tasks` with `todo`, `in_progress`, `blocked`, and `done`, optional workspace-member owners, due dates, revisions, and attributable history. Pre-existing tasks retain unknown creator attribution rather than inventing it.
- Assets use `assets` for social, email, web, and print copy, plus image and video briefs. Content is text (up to 50,000 characters); no binary storage is added. Creator and creation mode are immutable through the RPCs.
- Drafts and assets with requested changes can be submitted to `in_review`. In-review content cannot be edited until a reviewer requests changes. Only human workspace approvers/admins can approve or request changes; requested changes require notes. Editing an approved asset resets its approval to draft and clears approval attribution.
- `workflow_history` is append-only. Every task/brief write and asset action records its actor. Asset entries preserve the exact content revision, campaign context, success metrics, and review notes. Approval does not activate a campaign or publish an asset.
- All writes check workspace membership and expected revisions. The public asset RPC fixes actor mode to human; private agent wrappers remain ungranted to browser roles and require a caller-attributed agent run. Agents may draft and submit but cannot make human review decisions, activate campaigns, or publish.

### RPCs and deployment

The existing `read_marketing_workspace` returns campaigns, members (IDs and roles), KPIs, tasks, and assets for one authorized workspace. `read_marketing_asset_history` loads history on demand. Narrow writes use `save_marketing_brief`, `save_marketing_task`, and `write_marketing_asset`; the existing campaign save RPC remains in use. No direct browser table writes are enabled. The caller-scoped `has_membership` helper is executable by authenticated readers so existing RLS policies can evaluate it.

Apply `20260912111609_marketing_campaign_workflow.sql` after the foundation migration through the normal reviewed migration process before releasing this UI. This PR does not apply hosted migrations or deploy. Legacy records are retained; workflow history starts when the new RPCs are used. Published/retired legacy assets cannot be changed through this workflow. Workspace provisioning and selection retain the foundation behavior (default/first authorized workspace); there is no new workspace administration UI.

`npm run test:marketing` executes both migrations in PGlite and checks authorization, RLS, mutations, revisions, agent restrictions, and immutable history. `npm run test:marketing-ui` runs the real UI and RPC client against an isolated local PGlite fixture, with synthetic auth replacing hosted authentication. The browser flow covers campaign creation, brief/KPI saving, tasks, content, requested changes, resubmission, human approval, and visible history. It uses installed Edge by default; set `REVIEW_TEST_BROWSER` for another installed Playwright channel. Hosted Supabase auth/PostgREST and production deployment are outside this local test.

## Future work

The following are architectural extension points, not current capabilities:

- channel connectors and publishing execution;
- cross-channel event ingestion, analytics, and reporting;
- continuous agent orchestration and automated recovery;
- self-service workspace membership and settings administration.

The first governed agent run layer is documented in [Marketing agent runs](marketing-agent-runs.md). Agents prepare work only within the governed write boundary. They must not approve campaigns, activate them, or publish assets. Any future orchestration must run through a trusted server-side path with a valid, caller-attributed agent run; the browser has no agent write mode.

## Implementation references

- Campaign workspace UI: `src/pages/marketing/MarketingWorkspace.jsx`
- Campaign form: `src/components/marketing/CampaignForm.jsx`
- Browser RPC client: `src/lib/marketing.js`
- Data model, row-level security, RPC boundary, and audit controls: `supabase/migrations/20260911120000_marketing_command_center.sql`
- Domain and migration checks: `tests/marketing-domain.test.mjs` and `tests/marketing-migration.test.mjs`

These paths document the current implementation but are not substitutes for environment-specific migration, provisioning, security review, or deployment validation.
