# Candidate 360 Talent CRM

Adds `/talent/candidates` and `/talent/candidates/:personId` as a top-level
Talent / People workspace, separate from Marketing. This is a read-only
relationship workspace, not an ATS, HR master, or learner evidence editor.

## Inspection and release boundary

Inspected main at `27f62db` before implementing.

1. PR #35's CRM foundation already provides people, distinct applications,
   activities, document metadata, consent, workspace membership, RLS and source
   uniqueness. Person lifecycle and application status are independent fields.
2. `docs/unified-crm-migration-map.md` maps Join-Orion `candidate_applications`
   into people/applications and `candidate_activity` into activities. Original
   source references remain intact. Jobs remain `job_ref`.
3. `learner_bindings` projects independently verified canonical person and
   employment context. The conceptual `application_person_link` and
   `person_external_identity` crosswalks are not implemented for CRM. Neither
   `crm.people.id` nor its optional `auth_user_id` establishes that crosswalk.
   Matching emails, source names, lifecycle, hired status, browser sessions,
   or even coincident UUIDs do not prove it. Candidate 360 does not query or
   join learner bindings, evidence, coaching or progression.
4. There was no existing Candidate CRM UI. The shared application layout and
   navigation provide the visual foundation used by Marketing.
5. A GET-only server endpoint verifies the non-anonymous user with Supabase
   `auth.getUser(token)`. It uses a server-only PostgreSQL connection to the
   same project's private CRM schema. Every read runs in a repeatable-read,
   read-only transaction with `SET LOCAL ROLE authenticated` and the verified
   subject in transaction-local JWT settings. Existing RLS and explicit
   workspace predicates both apply. No service credential enters the browser.
6. CRM currently grants browser SELECT only and has no audited, role-restricted
   human-write command boundary. This release adds no write actions.
7. Files: `api/talent.js`, `api/_lib/talent-db.js`, `api/_lib/talent-read.js`,
   `src/lib/talent.js`, `src/pages/talent/TalentWorkspace.jsx`, scoped
   `src/styles/talent.css`, `src/App.jsx`, `src/lib/appNavigation.js`, package
   manifests, `.env.example`, this document and `tests/talent*` / the Talent
   fixture. No existing CRM or learner schema is modified.
8. No migration is required. No hosted reads, imports, seed candidates,
   ingestion jobs, Join-Orion environment changes or deployment are included.

## Server configuration

Use the existing `LEARNER_SUPABASE_URL` and
`LEARNER_SUPABASE_PUBLISHABLE_KEY` auth environment variables. Configure
`CRM_DATABASE_URL` only on the server, pointing to the **same Supabase project**.
Never use a `VITE_` prefix or the Join-Orion production database.

Use the Supabase transaction pooler connection URI; Postgres.js is pinned at
3.4.8 with prepared statements disabled for transaction pooling. TLS certificate
verification is required. The login must be allowed to `SET ROLE authenticated`;
all actual queries run as that existing restricted role, with no writes allowed
in the transaction. No new table grants or Data API schema exposure are needed.
The connection has a small pool, connection/idle timeouts, and each SQL statement
has a 10-second timeout. Credential errors and schema/configuration failures
produce a generic unavailable state, never a misleading empty pipeline.

For a certificate chain not trusted by Node's default CA store, set server-only
`CRM_DATABASE_CA_CERT` to the appropriate CA PEM obtained from Supabase's SSL
settings, with actual newlines. The client retains certificate and hostname
verification; it never retries with `rejectUnauthorized: false` or unverified
`ssl: 'require'`. A CA is not a database password. Do not reset credentials to
resolve a certificate-trust failure. See [availability diagnostics](talent-crm-availability.md)
for error categories, role/pooler compatibility, and bootstrap prerequisites.

The release operator must provision this server secret and verify same-project
configuration before releasing the API. This PR does not perform that operation.
See the [Supabase Postgres.js guide](https://supabase.com/docs/guides/database/postgres-js)
for the supported pooler connection convention.

`GET /api/talent` selects the first alphabetically sorted authorized workspace;
the UI also offers an explicit workspace selector. Read membership follows
CRM's existing viewer/contributor/manager/admin policy, independent of the app's
sales role. The UI route requires sign-in; API membership is authoritative.

Query parameters:

| Parameter | Meaning |
| --- | --- |
| `workspace_id` | Explicit CRM workspace UUID; required with `person_id` |
| `person_id` | Candidate profile in that workspace |
| `q` | Literal substring of name/preferred name/email or any historical job reference; max 200 characters |
| `stage` | Person lifecycle stage |
| `status` | Latest **candidate** application status |
| `owner` | Latest candidate application's assigned user UUID, or `unassigned` |
| `source` | Person or any application source system |
| `page`, `page_size` | 1-based page, default 25 rows, maximum 50 |

Unknown keys, invalid enums/UUIDs, repeated query arrays and out-of-range paging
are rejected. All request data is bound as SQL parameters. Responses use
`Cache-Control: no-store`. The browser clears old data while changing query or
workspace, aborts stale requests, and exposes explicit loading/error/empty states.

## Read semantics

- Candidates include people with a candidate application; applicant/candidate
  lifecycle is itself recruiting context even without an application. Learner
  and employee rows also qualify with Join-Orion candidate-application provenance.
  Unrelated dealer leads are excluded.
- A person appears once by CRM person UUID, regardless of application count or
  number of Join-Orion references. Distinct people sharing an email are not
  merged. Resolving duplicate imported people requires governed identity work.
- Latest application is the newest candidate submission, falling back to record
  creation when submission time is absent, with creation/UUID tie breakers.
  A late import of an older submission does not replace the current application.
  The profile shows **all** application types separately, newest submission first.
- Default list order is latest recorded activity, falling back to application
  submission/person creation when there is no activity; UUID resolves ties.
- Activity and documents include person-linked rows and application-only rows
  through that person's workspace-scoped applications. An explicit different
  person association is never silently reassigned through an application.
- All source-system/entity/original references are preserved in expandable
  Source details. Timeline text is plain React text, never rendered as HTML.
- Owners use the latest candidate application's `assigned_to`. When an explicit
  same-workspace CRM Auth association supplies a recruiter name, display it.
  Otherwise show a stable abbreviated user reference with the full UUID in the
  title; missing ownership is explicit. This is a CRM assignment display, not
  a learner/employment crosswalk. There is no inferred owner or Auth-directory scan.
- Document projections include type, original filename, creation time,
  application reference and source provenance. Storage paths/buckets, external
  URLs and arbitrary metadata are excluded. There are no file access links.
- Latest consent per channel/purpose is shown with capture time and provenance.
  Missing consent is not treated as opt-in; consent evidence stays private.
- No `payload_snapshot`, person attributes, raw activity metadata, auth user ID,
  storage credentials or consent evidence is projected. Only task `due_at`,
  `status`, and `completed_at` string fields are explicitly mapped.
- Talent Journey displays “No verified learner or employment linkage” and
  “Learner linkage: Not verified”. There is no link-creation or email-matching
  path. A future governed crosswalk and authorized learner summary API are
  prerequisites for displaying employment, learner history or approved levels.

## Explainable attention

Needs Attention counts candidates **on the displayed page**, not an implied
whole-workspace total. Every reason is expanded in the candidate row and shown
in Overview. No fit, quality, retention, hire recommendation or ranking is used.

- No owner: no recruiter on the latest candidate application, or no candidate
  application in which to record assignment.
- Submitted: latest candidate application remains `submitted`; a review status
  change is not recorded. This does not claim no human has ever read the record.
- Stale review: latest candidate application is `in_review` and the candidate
  has no recorded activity in the previous seven days. If there is no activity,
  use submission time, then application/person creation.
- Overdue task: activity type `task`, an explicit valid UTC ISO `metadata.due_at`
  earlier than server time, no `completed_at`, and status outside
  `completed`/`done`/`cancelled`. Malformed or impossible dates are ignored.
  The exact task summary and due time explain the reason. Earliest open valid
  task is the next-action indicator, including future tasks.

The first release uses bounded candidate pages and SQL filtering/counting rather
than downloading the workspace into browser memory. Profiles return their full
histories as requested. Large imported histories and query plans should be
measured before a large-scale rollout; timeline pagination and additional
workspace/person indexes can follow based on measured volume.

## Next write-boundary PR

Before lifecycle/status/owner changes or internal notes are enabled, implement a
trusted server command boundary with current CRM role checks, exact workspace
and person/application checks, allowed transitions, optimistic concurrency,
idempotency, and atomic audit activity recording the verified human and source.
Owner assignment must validate an eligible workspace member. Separate recruiting
source authority from CRM relationship annotations. Keep browser INSERT/UPDATE
revoked. Cross-system identity and learner writes remain outside that boundary.

## Verification

`npm run test:talent` executes the actual CRM migration in PGlite and exercises
the real API/SQL under authenticated RLS with synthetic Join-Orion fixtures.
`npm run test:talent-ui` runs the real UI → API → database path in local Edge,
replacing only external authentication and the connection driver. Fixtures are
test-only and never imported by the production build.

Run `node --test tests/*.test.mjs`, the Talent/Marketing/reviewer browser suites,
targeted ESLint, `npm run build`, and `git diff --check`. The regression suite
covers CRM, learners, Marketing, realtime, auth roles and conversations.
