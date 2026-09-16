# Orion CRM workspace provisioning

## Design decision

The CRM foundation already has the required uniqueness, Auth foreign key, role
constraint, grants, and RLS boundaries. The smallest safe solution is therefore
**no migration plus a controlled operator script**. Adding a privileged RPC
would create a durable attack surface without improving this one-time bootstrap.
The script runs only from a trusted shell with a server-side PostgreSQL
credential; it is not imported by the browser and creates no HTTP endpoint.

The operation does not import candidates, change Candidate 360 authorization,
alter RLS, inspect application-admin status, or infer access from an email
domain. An operator must name one authoritative `auth.users` record explicitly.

## Prerequisites and controls

1. Use a reviewed change ticket and a trusted operator workstation or CI job.
2. Confirm the target is the same Supabase project used by learner Auth.
3. Set `CRM_DATABASE_URL` only in the trusted process environment. It must be a
   database role that can read `auth.users` and insert into the `crm` schema
   (normally the server-side database credential already used for CRM). Never
   use a `VITE_` variable, paste this credential into a browser, or expose the
   Supabase service-role key client-side.
4. Set `CRM_PROVISIONED_BY` to an attributable operator/change identifier, such
   as `alice@example.com/TICKET-1234`. It is included in the command receipt and
   PostgreSQL `application_name`, where database logging captures it if enabled.
5. Set `CRM_PROVISION_USER` to the exact email or UUID of an **existing**
   Supabase Auth user. Email matching is case-insensitive against `auth.users`;
   it does not inspect domains or application roles. If an email is ambiguous,
   the command fails and the UUID must be used.

The command prints a JSON receipt. Save it with the reviewed change ticket; do
not commit receipts containing personal information. The transaction takes a
workspace-scoped advisory lock so concurrent runs cannot create competing
bootstrap state.

## 1. Create or verify the Orion workspace

Set the environment and run the controlled command:

```sh
export CRM_DATABASE_URL='postgresql://...'
export CRM_DATABASE_CA_CERT='-----BEGIN CERTIFICATE-----...'
export CRM_PROVISIONED_BY='operator@example.com/TICKET-1234'
export CRM_PROVISION_USER='first.admin@example.com'
npm run provision:crm
```

`CRM_DATABASE_CA_CERT` is optional and accepts the same PEM value as the Talent
API. The command creates exactly `name = 'Orion'`, `slug = 'orion'`. On rerun it
reuses that workspace. It fails rather than modifying a workspace if `orion`
has another name, or if an `Orion`-named workspace has another slug.

The receipt reports `workspace.created`. An operator may independently verify:

```sql
select id, name, slug, created_at
from crm.workspaces
where slug = 'orion';
```

Expect exactly one row with name `Orion` and slug `orion`.

## 2. Add the first CRM admin

Omit `CRM_PROVISION_ROLE`, or set it explicitly:

```sh
export CRM_PROVISION_USER='00000000-0000-4000-8000-000000000000'
export CRM_PROVISION_ROLE='admin'
npm run provision:crm
```

Replace the example UUID with a reviewed existing Auth user. The script resolves
the user in `auth.users` before creating either workspace or membership and
rejects nonexistent users. The default initial role is `admin`. It inserts the
membership with conflict protection, so reruns cannot duplicate it.

If membership already exists, it is preserved exactly. In particular, the
script never silently promotes or downgrades an existing role; the receipt and
stderr warning identify a requested/existing role mismatch.

## 3. Add future CRM members safely

Use the same reviewed command, with one exact Auth email or UUID and an explicit
role for each approved person:

```sh
export CRM_PROVISIONED_BY='operator@example.com/TICKET-1277'
export CRM_PROVISION_USER='new.member@example.com'
export CRM_PROVISION_ROLE='contributor'
npm run provision:crm
```

Do not bulk-select application administrators, use an email-domain query, or
create browser-side membership writes. Review each identity and least-privilege
role independently. A membership in another CRM workspace does not affect the
Orion decision; the script only writes to the canonical `orion` workspace.

## 4. Available CRM roles

| Role | Intended grant |
| --- | --- |
| `viewer` | Read-only CRM access. |
| `contributor` | Future governed content/data contribution access. |
| `manager` | Future governed team/workflow management access. |
| `admin` | Workspace administration; reserve for approved operators. |

The current foundation remains read-only to browser users regardless of these
descriptions: RLS and grants determine actual capabilities. Provisioning a role
does not weaken or bypass those policies.

## 5. Verify membership

Use an operator database session, not a browser write, and verify by immutable
Auth UUID:

```sql
select w.id as workspace_id, w.name, w.slug,
       m.user_id, u.email, m.role, m.created_at
from crm.workspaces w
join crm.workspace_members m on m.workspace_id = w.id
join auth.users u on u.id = m.user_id
where w.slug = 'orion'
  and m.user_id = '<reviewed-auth-user-uuid>'::uuid;
```

The user can then sign in normally and retry `GET /api/talent`. Keep the
provisioning receipt and verification result with the change ticket. Do not put
credentials or personal data into source control.

## 6. Removing or changing membership

This bootstrap command intentionally does not remove membership or change an
existing role. Those operations require a future governed process with explicit
authorization, actor/reason audit history, review, and tests for last-admin and
cross-workspace safety. Until that process exists, do not perform ad-hoc browser
writes or repurpose this script to overwrite roles. Handle an urgent exception
only through the organization's reviewed database change procedure, recording
the exact workspace UUID, Auth UUID, prior value, approved new value, actor,
reason, and timestamp.
