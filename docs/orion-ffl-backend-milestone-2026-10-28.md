# Orion FFL backend milestone

Development Supabase project: `fbugmcjsjohapkvodwzt` (not production).

Applied migrations: `orion_ffl_ownership_foundation`, `orion_qualifying_contact_and_prospect_expiration`, `orion_block_unreconciled_active_takeover`.

The authenticated qualifying-contact RPC checks for an active Orion rep profile, validates method and notes, serializes ownership updates, blocks competing protected reps, and rejects all invoice-backed active accounts until reconciliation. It appends contact and ownership audit events. The 21-day prospect expiry function is service-role-only and is not scheduled.

Permissions verified: anon cannot execute either function; authenticated can execute only the contact function; service role can execute expiry. Unauthenticated contact test rejected.

Security review outstanding: Supabase flags the authenticated SECURITY DEFINER RPC (https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Eight RLS-without-policy informational findings reflect deliberately closed tables.

Next: isolated fixture tests, scoped read authorization, project-specific identity mapping, development Hub integration. No live application changes.