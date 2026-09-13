# Unified CRM migration map

This document maps `join-orion.com` records into the private `crm` schema in the
`SalesExecutive_Simulation_Dashboard_Orion` Supabase project. Phase 1 creates
the destination only. It does not move production data or change either site.

## System of record

The Genius Seeker Supabase project becomes the system of record. Both
`join-orion.com` and `app.geniusseeker.com` will eventually use that project.

## Legacy mappings

| Join Orion source | CRM destination | Notes |
| --- | --- | --- |
| `dealer_applications` | `crm.organizations`, `crm.people`, `crm.applications` | Dealer business, primary contact, and immutable intake snapshot |
| `candidate_applications` | `crm.people`, `crm.applications` | Candidate identity and immutable intake snapshot |
| `application_activity` | `crm.activities` | Dealer timeline entries |
| `candidate_activity` | `crm.activities` | Candidate timeline entries |
| `dealer_documents` | `crm.documents` | Metadata first; storage objects require a separate transfer |
| `sales_reps` | `crm.people`, `crm.organization_people` | Sales relationship, not a duplicate login identity |
| `job_postings` | application `job_ref` initially | A governed jobs domain can follow separately |
| `contributors` | `crm.people`, `crm.organization_people` | Contributor relationship |
| `admin_users`, `user_profiles` | Supabase Auth plus `crm.workspace_members` | Roles must be assigned from trusted server-side data |
| `visitor_counts` | Remains analytics data | Not CRM identity data |

Every imported record must retain `source_system`, `source_entity`, and
`source_id`. Their composite uniqueness makes migration reruns idempotent and
provides an audit trail back to the original project.

## Cutover gates

1. Export and reconcile source row counts.
2. Create the Orion workspace and approved memberships.
3. Run a dry-run transform with no destination writes.
4. Import through a privileged server process; browsers receive no bulk-write access.
5. Verify counts, required relationships, duplicate emails, and RLS isolation.
6. Repoint the Join Orion staging environment before production.
7. Keep the source project read-only through the rollback window.

## Explicitly out of scope for Phase 1

- No live data copy or deletion.
- No Auth user migration.
- No Storage object transfer.
- No environment-variable changes.
- No change to existing newsletter tables or policies.
- No public form submission RPCs or Edge Function changes.
