# Candidate 360 availability diagnostics

Inspected merged PR #39 on main `40f3783`. The reported hosted result was a
logged-in application user, configured transaction-pooler URL, `/api/talent`
returning 503, and only a Node DEP0169 warning in invocation logs. No hosted
database, credentials, environment variables, data or deployment were changed
or accessed during this investigation.

## What the old 503 meant

There were three explicit 503 branches in `api/talent.js`:

1. Missing server Auth URL or publishable key. Browser authentication can work
   while these separate server variables are missing or configured differently.
2. Auth client construction or `getUser()` throws. Previously returned Auth
   service errors were incorrectly grouped with invalid sessions as 401.
3. Anything thrown by the database wrapper/read callback. This included:
   - Missing `CRM_DATABASE_URL`, malformed URI/percent encoding, driver creation
     or invalid options.
   - DNS/TCP connectivity, pooler tenant/user routing, wrong database/password,
     paused/unavailable project, exhausted connection limits, connection timeout,
     certificate trust/hostname/expiry errors, transaction `BEGIN` failure.
   - Denied/missing `authenticated` role during `SET LOCAL ROLE`.
   - Failures setting either JWT GUC or the statement timeout.
   - Missing CRM schema/tables/functions, missing existing grants, RLS function
     errors, query timeouts, SQL errors in workspace/membership, candidate list,
     profile/history, document/consent, source or recruiter lookups.
   - Application callback/serialization failures or transaction completion and
     connection failures. The old catch discarded all information about phase.

A **successful SQL query** with no visible authorized workspace already returned
403. An unknown/foreign candidate within an authorized workspace returned 404.
An authorized workspace without candidates returned 200 with an empty list.
None of those is a database outage.

## Likely cause and evidence limit

The leading hypothesis is TLS trust: #39 forced certificate verification using
Node's default trust store but had no explicit CA configuration. A supplied
`sslmode=require` in the URI does not override the driver's explicit SSL option.
Supabase documents CA configuration for verified connections. The reported 503
alone cannot confirm this: database/pooler configuration and a missing foundation
schema or grants are also possible. The new category and allowlisted code are
needed to identify the failing hosted phase without exposing secrets.

No claim is made that the exact hosted failure has been reproduced or fixed.
The optional CA input addresses the TLS configuration gap without disabling
certificate or hostname verification. See [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

## Connection, role and Auth UID

The standard shared transaction-pooler username is `postgres.<project-ref>`;
the suffix routes the connection to the project and the database login role is
`postgres`. The password is the database password, not a Supabase API key.
Percent-encode reserved password characters once. Use the URI from Connect →
Transaction pooler, for the same project as server Auth. Unsupported parameters
copied from another driver can become invalid startup settings; use a Postgres.js
compatible URI. These facts do not establish what is configured in the hosted
environment, which was not inspected.

Standard Supabase `postgres` can assume `authenticated`. An arbitrary custom
login cannot unless it has the necessary role membership/SET permission.
Failure to assume that role is a server configuration error, not an end user's
missing CRM membership. No query may fall back to the connection's elevated role.
See [Supabase's own RLS-scoped database pattern](https://supabase.github.io/server/documents/postgres.html)
and [PostgreSQL SET ROLE](https://www.postgresql.org/docs/current/sql-set-role.html).

`pool.begin(...)` pins a connection for the whole read-only transaction.
`prepare: false` is appropriate for the shared transaction pooler. All role and
JWT settings are **transaction-local**, unlike unsupported assumptions about
session state surviving across pooled transactions. Both singular subject and
JSON claims are set from the server-verified user; neither comes from query
parameters or client-supplied identity. Commit/rollback clears the local state.
The wrapper now verifies the effective role, `auth.uid()` equality, and read-only
transaction flag before querying CRM. See [transaction-pooler guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Safe invocation logs

The handler emits one structured event for a failed operation, for example:

```json
{"event":"talent_availability","category":"crm_connection_failed","stage":"transaction_begin","code":"SELF_SIGNED_CERT_IN_CHAIN"}
```

Only allowlisted categories, stages and known error-code constants may appear.
Unknown codes are omitted. No URL, password, token, Authorization header, user or
workspace identifier, candidate row, SQL text, query parameters, raw error message,
stack, detail, cause, or arbitrary error properties are logged. Driver notices
are disabled. Logging failure cannot change an HTTP response or authorization.

| Category | Meaning / operator check | HTTP |
| --- | --- | --- |
| `auth_not_configured` | Required server Auth variables absent | 503 |
| `auth_verification_failed` | Auth client/service/transport unavailable, not a known invalid session | 503 |
| `crm_not_configured` | CRM database URL absent | 503 |
| `crm_configuration_invalid` | URI validation or driver construction failed | 503 |
| `crm_connection_failed` | Connection, TLS, pooler/login, or recognized transport failure; inspect code and stage | 503 |
| `crm_role_assumption_failed` | Cannot assume the fixed authenticated role | 503 |
| `crm_auth_context_failed` | JWT/context setup or role/UID/read-only verification failed | 503 |
| `crm_query_failed` | Database/schema/grant/query or other callback/completion failure | 503 |
| `crm_membership_missing` | No authorized workspace visible to this user | 403 |
| `crm_workspace_missing` | Requested workspace not in the user's visible workspace list | 403 |

For the last two categories, "missing" means **not authorized/visible**, not
proof that a workspace does not exist globally. The response remains the same
403 message for absent and foreign workspaces. The server does not perform an
elevated existence probe to distinguish them. Only a separately authorized
operator can check global bootstrap state.

Useful codes include `28P01` (database authentication), `42501` (role/grant
permission, distinguished by stage), `42P01`/`3F000` (missing relation/schema),
`42883` (missing function), `57014` (query cancelled/timeout), and TLS trust codes.
An unclassified driver error still has a phase; do not enable raw-error logging
to make it more specific. Successful requests and ordinary 401/404 responses do
not emit availability-error events. Diagnostic fields are never added to the
browser response. All responses remain `Cache-Control: no-store`.

## Bootstrap and release requirements

PR #35 creates CRM structure, RLS and grants, but no Orion workspace or members.
PR #39 adds no bootstrap. Supabase login, app manager/admin role, learner binding,
and Marketing membership do not automatically grant CRM membership.

- If the foundation is missing, an authorized release operator must apply the
  **existing** #35 migration through the normal release process. This diagnostic
  PR requires no new migration or grant changes.
- Orion workspace and explicitly approved Auth-user CRM memberships must be
  provisioned separately. Do not automatically enroll every application user,
  infer roles, or add candidates to test access. With schema present and no
  authorized memberships, 403 is expected; after approved membership exists,
  an empty candidate workspace should return 200.
- Configure an appropriate CA PEM only if the observed TLS error requires it.
  Do not disable SSL verification, reset passwords, or assume role failure just
  because a transaction pooler is used.

Those are release/operator prerequisites, not actions performed by this PR.
There is no deployment, hosted-data change, credential reset, or candidate import.

## DEP0169 attribution

Talent's application code has no legacy `url.parse()` call. The pinned
`postgres@3.4.8` parser in `node_modules/postgres/src/index.js` (and its CJS
variant) uses WHATWG `new URL`; the new preflight validation does too. The warning
does not establish that the database URL is invalid and normally does not throw.

The exact deployed runtime/dependency caller cannot be identified from the
warning without its stack/version. It is outside the inspected Talent code and
Postgres.js parser. Vercel supplies request helpers outside this repository;
even [current upstream Vercel helpers](https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/helpers.ts)
now use WHATWG URL. Do not assert a particular older runtime version is installed,
suppress all warnings, or upgrade unrelated dependencies based on this symptom.
Use a sanitized runtime warning stack/version in a separate investigation if
needed. No legacy-parser replacement or unrelated dependency update is included.

## Regression coverage

The fixture now runs the production role/context wrapper, not a duplicate setup.
Tests cover malformed URLs, driver construction, certificate/login/timeout errors,
denied role assumption, each context step, context mismatch, missing CRM relation
and grants, query/commit transport failures, safe log serialization and logger
failure. Real local PostgreSQL tests exercise role grants/denials, RLS workspace
isolation, read-only enforcement and subject cleanup across commit/rollback.
API tests preserve 401/403/404/503/empty-200 semantics. Browser coverage includes
an authenticated 503 outage with generic UI copy and no diagnostic leakage.
