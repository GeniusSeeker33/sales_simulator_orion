# Marketing Command Center Foundation

**Status:** implemented repository foundation; environment deployment is not implied. Publishing, cross-channel ingestion/reporting, and agent orchestration are future work.

## Purpose

The Marketing Command Center adds governed campaign planning to the Genius Seeker / Orion platform. Its current scope is deliberately narrower than an autonomous marketing system: authorized workspace members can plan and review attributable campaigns while human approval remains the boundary for activation and publication.

## Implemented foundation

### Tenant-aware workspaces and campaigns

- Marketing records are scoped to a workspace, with the initial Orion workspace supplied as seed data for environments that apply the migration.
- Workspace membership uses `viewer`, `contributor`, `approver`, and `admin` roles.
- Campaign reads and writes are workspace-scoped. Campaign ownership must refer to a member of the same workspace.
- Campaign plans can record objectives, audiences, channels, budget, dates, status, approval state, KPIs, tasks, and attribution keys.
- The application currently provides a workspace overview and campaign create/edit/list views for provisioned members.

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

The current UI supports campaign approval state as part of campaign planning. A dedicated approval-queue module and actual publishing workflow are not yet implemented.

## Future work

The following are architectural extension points, not current capabilities:

- content drafting and an operational asset library;
- a dedicated human review queue;
- channel connectors and publishing execution;
- cross-channel event ingestion, analytics, and reporting;
- server-side agent orchestration and operational agent-run lifecycle management;
- self-service workspace membership and settings administration.

Future agents may prepare or revise work only within the governed write boundary. They must not approve campaigns, activate them, or publish assets. Any future orchestration must run through a trusted server-side path with a valid, caller-attributed agent run; the browser has no agent write mode.

## Implementation references

- Campaign workspace UI: `src/pages/marketing/MarketingWorkspace.jsx`
- Campaign form: `src/components/marketing/CampaignForm.jsx`
- Browser RPC client: `src/lib/marketing.js`
- Data model, row-level security, RPC boundary, and audit controls: `supabase/migrations/20260911120000_marketing_command_center.sql`
- Domain and migration checks: `tests/marketing-domain.test.mjs` and `tests/marketing-migration.test.mjs`

These paths document the current implementation but are not substitutes for environment-specific migration, provisioning, security review, or deployment validation.
