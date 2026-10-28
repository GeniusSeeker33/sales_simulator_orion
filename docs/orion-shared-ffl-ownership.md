# Orion Shared FFL Ownership — implementation specification

Status: implementation branch, not deployed. Existing FFL search remains unchanged until verified.

## Confirmed source audit
- FFL search: `src/lib/fflStore.js` queries Supabase table `FFL_holders`.
- Hub UI: `src/pages/FFLProspects.jsx`; route `/ffl-prospects` protected by auth.
- Manual rep claims: `src/lib/fflClaimsStore.js` stores per-FFL claims in browser localStorage.
- Account book: `src/lib/accountStore.js` uses bundled account data and browser localStorage.
- Employee roster: `src/data/employees.js` is a historical snapshot.
- Existing rep matching is partly name-based; this is not reliable for business-wide ownership.

## Policy (approved)
1. A *qualifying, documented contact* starts or renews exclusive prospect protection for 21 days.
2. A *qualifying posted invoice* starts or renews active ownership for 90 days.
3. At 90-day expiration without another qualifying invoice, ownership is automatically released and the business becomes dormant/available.
4. Ownership is at the **business** level, across verified linked FFL locations, not per individual license.
5. Rep initials are display-only; immutable user/employee IDs own records.
6. Dormant means no exclusive sales ownership, **not** an invalid or expired FFL license.

## Proposed schema (requires live DB inspection before migration)
- `orion_businesses`: uuid PK, normalized display/legal name, external BC customer ID nullable, created_at.
- `orion_ffl_business_locations`: unique stable FFL key, business_id FK, FFL source key, verified_at, match confidence.
- `orion_rep_profiles`: auth user ID PK, employee ID, rep initials, active, role; map existing roster.
- `orion_business_ownership`: business_id PK, rep_user_id, state (protected|active|available|dormant), protected_until, last_invoice_at, active_until, version, updated_at.
- `orion_prospect_contacts`: append-only event with business_id, actor, occurred_at, method, qualification flag, notes, created_at.
- `orion_invoice_events`: unique source invoice ID, business_id, posted_at, amount/status, imported_at; never accept browser-supplied authoritative invoices.
- `orion_ownership_audit`: append-only event history including actor, reason, before/after and timestamps.
- `orion_sync_health`: invoice feed watermark, last success and failures.

## Required server-side operations
- `record_qualifying_contact(business_id, contact_type, notes)`: resolve authenticated rep, lock business ownership row transactionally, reject active conflicting owner, record contact, grant/renew protection from contact time.
- `ingest_posted_invoice(...)`: trusted service only; idempotent on source invoice ID; link to verified business; update active_until to latest qualifying posted invoice + 90 days; handle voids/credits by reconciliation.
- `expire_ownership(now)`: scheduled trusted job; only expire protected claims after 21 days, or active claims after 90 days; **do not release** when invoice sync is unhealthy/stale or business identity unresolved; append audit.
- `manager_override(...)`: role-gated, mandatory reason, append audit.
- Never allow direct client UPDATE of owner or invoice state. All writes through authorized server functions with concurrency control and audited identity.
- Use RLS with explicit role and organization authorization, no permissive anonymous access, no client service keys.

## Migration / launch sequence
1. Inspect live database schema and RLS, including `FFL_holders`; identify actual deployed Supabase project and authentication system. No changes yet.
2. Inspect Business Central invoice access and authoritative business IDs; review 5,240 bundled accounts and match ambiguity. Do not auto-merge by name.
3. Build and review additive migration in this branch; apply to nonproduction Supabase environment first.
4. Add repository/service functions and tests for races, 21-day renewal, 90-day expiry, multiple locations, late/duplicate/voided invoices, role restrictions and sync outages.
5. Replace browser-local claims in Hub with read-only shared ownership view, then authenticated contact/claim operations behind a feature flag. Preserve legacy local data for recovery.
6. Run simulation-only expirations against actual accounts and reconcile with managers before enabling live release.
7. Integrate into Orion-specific portal with separate organization authorization and data boundaries. Keep GeniusSeeker intellectual property and unrelated data isolated.

## Blockers before live rollout
- Verify which Supabase project is actually used by deployed `app.geniusseeker.com`.
- Confirm business-level identity mapping across FFL locations.
- Confirm invoice source, semantics, freshness and Business Central access.
- Confirm Orion employee SSO/user IDs and approved roles.
- Confirm historical ownership assignments and a safe migration strategy.
