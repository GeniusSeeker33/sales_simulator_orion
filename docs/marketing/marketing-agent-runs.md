# Governed Marketing agent runs

The first run layer adds explicit human-initiated Strategist, Creator and Guardian work to the existing Brief → Tasks → Assets → QA → Approval workflow. It introduces no scheduler, background autonomy, publishing, activation action, connectors, messaging, analytics ingestion or campaign launching.

## Execution and authority

`POST /api/marketing-agent-run` verifies the bearer token with Supabase Auth `getUser`, rejects anonymous sessions, validates a narrow request, and passes the verified human ID to service-only `start_marketing_agent_run`. That RPC checks contributor/approver/admin membership and workspace/campaign/asset relationships before creating a durable run and returning the database context snapshot. No learner enrollment is required: Marketing workspace membership is the authorization source.

The server reuses the OpenAI Responses SDK pattern and `gpt-4.1-mini`. Instructions and JSON schemas live in `api/_lib/marketing-agents.js` under `marketing-v1`. There are no model tools. Context is untrusted task data, not permission. Output is strictly validated recursively (including unknown fields, lengths, enums and contradictory recommendations) before it reaches persistence. Model requests use `store: false`, a 30-second timeout, no automatic model retries and a 6,000-output-token limit.

| Action | Viewer | Contributor | Approver/admin | Agent |
| --- | --- | --- | --- | --- |
| Read workspace campaigns/assets/runs | Yes | Yes | Yes | Assigned context only |
| Initiate run | No | Yes | Yes | Never |
| Edit campaign brief/settings/tasks | No | Existing human workflow | Existing human workflow | Never |
| Propose plan/task titles | No initiation | Via Strategist | Via Strategist | Strategist evidence only |
| Save/submit text assets | No | Yes | Yes | Creator: one new attributable draft per run |
| Review QA evidence | Yes | Yes | Yes | Guardian produces advisory findings only |
| Record asset approval or requested changes | No | No | Separate human decision | Never |
| Approve/activate campaign | No | No | Existing human workflow; active requires approved | Never |
| Publish, send, connect channels, launch autonomously | No new capability | No new capability | No new capability | Never |

The browser cannot supply an initiating identity or actor mode, create runs via database RPC, or call private agent asset/campaign functions. Only `service_role` receives the start/finish RPC grants. The existing human write RPCs and private agent helpers keep their current grants. Never expose the service credential in a `VITE_*` variable.

## Contracts and persistence

- Strategist: `summary`, ordered `steps[{title,rationale}]`, `proposed_tasks[string]`. Tasks remain proposals in the run result; a human adds actual tasks through the existing task form.
- Creator: `name`, supported `asset_type`, nonempty `content`. The type must match the initiating request. The human chooses save-only or save-and-submit. The completion RPC invokes the existing private agent asset pathway, fixes `created_via=agent`, sets `assets.agent_run_id`, and preserves run attribution in workflow history. No existing asset is edited by this layer.
- Guardian: `summary`, `recommendation` (`ready_for_human_review` or `needs_changes`), categorized findings with severity. Deterministic QA checks content, supported type, audience/channel presence, exact CTA text and unresolved placeholders. Any failed deterministic check forces `needs_changes`. These checks are intentionally limited; semantic claims and suitability still require human review. Recommendations do not change asset approval, record review decisions or publish.

`marketing.agent_runs` retains workspace/campaign, agent key, purpose, initiating human, started/ended timestamps, status, instruction version, provider/model, input snapshots, structured output, usage, nullable USD cost, sanitized error code and outcome asset. Token counts are stored when returned; cost stays null because this integration does not receive authoritative cost. Existing legacy runs retain unknown metadata. `agent_run_history` records immutable lifecycle snapshots; terminal runs cannot be changed or deleted. Readers remain workspace-scoped.

`finish_marketing_agent_run` locks the run and rechecks membership and campaign revision; Guardian also checks the specific asset revision. Results older than two minutes are rejected. A database subtransaction wraps allowed result writes, so validation, submission or persistence errors roll back the draft and workflow entries together. Failed runs have no applied output. Terminal completion is idempotent: retrying the same run after a lost RPC response cannot create another asset or erase success.

Model/refusal/incomplete/malformed errors become failed runs with sanitized codes. If the database becomes unavailable while finalizing, the API returns the durable run ID and an uncertain-outcome message. A hard process termination can leave `started` without a completion timestamp. Refresh Agents and inspect the record before explicitly starting new work; there is no automatic retry, recovery worker or hidden autonomy. Infrastructure failure recovery remains an operator responsibility. Starting a new request creates a new run and can incur another model call.

## UI and configuration

Marketing → Agents shows the most recent 50 workspace runs and expandable outcomes, timestamps, identity, usage and cost availability. Campaign pages provide Ask Strategist, Create draft with Creator and Run Guardian QA, with required human instructions and explicit Creator submission/Guardian asset controls. Refresh is manual. Guardian results describe their recorded revision and do not replace the Approvals workflow.

Server configuration uses the existing `LEARNER_SUPABASE_URL`, `LEARNER_SUPABASE_PUBLISHABLE_KEY` and `OPENAI_API_KEY`, plus **server-only** `LEARNER_SUPABASE_SERVICE_ROLE_KEY` for the same Supabase project. Apply repository migration `20260912161020_marketing_agent_run_layer.sql` after the two Marketing migrations through the reviewed release process. This change does not configure hosted secrets, apply hosted migrations or deploy.

## Validation

`npm run test:marketing` covers the server handler, real Supabase/OpenAI SDK adapters with mocked network, strict contracts, and all three migrations in local PGlite. It checks authenticated/unauthorized initiation, workspace isolation, attribution, output handling, browser denial of privileged functions, forbidden agent approval, immutable history, stale context/revoked permission, transactional rollback and ambiguous completion retries.

`npm run test:marketing-ui` exercises real React components, the browser RPC/API clients, the server handler and local SQL with synthetic authentication and deterministic inference. It covers all three roles, failure display, run outcomes and a separate human approval. Learner, realtime, conversation and auth regressions, targeted lint and the production build are also required. These checks do not claim hosted Auth/PostgREST or live model validation.
