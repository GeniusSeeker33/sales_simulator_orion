# Orion CJF development portfolio connection (2026-10-28)

## Implemented
- Staged 257 source rows in `public.orion_cjf_account_import_staging`, including 246 distinct nonblank customer numbers. Rows remain unverified.
- Added `public.orion_read_cjf_portfolio()` in **development Supabase** `fbugmcjsjohapkvodwzt`. The function returns `source_row`, `customer_number`, and `source_account_name` only when `auth.uid()` maps to an active `orion_rep_profiles` row with `role in ('manager','admin')`.
- Revoked execute from PUBLIC and anon, granted to authenticated. Underlying staging table has RLS enabled, no client policies, and no anon/authenticated table privileges.
- Unauthenticated SQL call returned zero records; source staging count remains 257.
- UI component `OrionCjfPortfolioReview` is mounted behind `VITE_ORION_PORTFOLIO_REVIEW=true` in the feature branch; client uses separate dev Supabase URL and publishable key, never the live FFL database credentials.

## Required before preview
1. Configure `VITE_ORION_DEV_SUPABASE_URL` and `VITE_ORION_DEV_SUPABASE_PUBLISHABLE_KEY` for a **development-only deployment**, plus `VITE_ORION_PORTFOLIO_REVIEW=true`. Do not set these on production.
2. Provision a dedicated authorized development manager identity and active `orion_rep_profiles` row, and implement/sign in to the **development** Supabase Auth session. Existing application login uses a different `learnerClient` and does not authenticate this client. Do not provision or contact Chase without explicit approval.
3. Verify authorized manager receives 257 rows, unauthorized authenticated user receives 0, and anon cannot invoke the RPC. Verify browser requests and CORS.
4. Run build/tests and deploy a preview; do not merge or enable live claims/ownership based on name matching.
5. Review security advisor warnings for exposed SECURITY DEFINER RPCs before rollout: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Current function checks active manager/admin profile server-side; move to a more restrictive backend architecture before production if appropriate.

## Data semantics
Reported existing assignments are **not** 90-day invoice-backed ownership, and are **not** new 21-day protected prospects. Do not auto-convert or start expiry clocks. Preserve customer-number collisions and missing IDs for manual review. The live FFL hub's localStorage claims are not shared authoritative ownership.
