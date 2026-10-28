# Live database audit — 2026-10-28

Project: `SalesExecutive_Simulation_Dashboard_Orion` (`shwdkkiinqhacwerukch`), ACTIVE_HEALTHY.

## Read-only findings
- Source code `src/lib/supabaseClient.js` fallback URL points to this project. Environment overrides and the production Vercel deployment are **not yet independently confirmed**.
- `public."FFL_holders"` exists, with ATF-style fields: license region/district/county/type/sequence, expiration, licensee/business name, premises and mailing address, phone.
- No columns/tables matching `%owner%`, `%invoice%`, `%dealer%`, or `%account%` appeared in `public` schema inspection, apart from unrelated `Pace Report` rep-code fields.
- `pg_policies` returned **no policies** for matching FFL/account/dealer tables. This does **not** establish whether RLS is enabled or which grants are present; audit those before exposure.
- No database mutations performed.

## Required next checks
1. Read `pg_class.relrowsecurity`, `relforcerowsecurity`, and table grants for `public."FFL_holders"`. Verify access using least-privileged roles in a nonproduction context.
2. Inspect auth/users and `appRoles` mapping; ensure Orion user authorization is not based on editable user metadata.
3. Determine whether `FFL_holders` has a stable unique license key. Its ATF composite fields are candidate identifiers; avoid name-only joins.
4. Confirm actual production Supabase URL and Vercel environment values, without printing credentials.
5. Obtain safe test Supabase project. Design additive RLS-protected tables and audited server-side transactional operations there.
6. Determine BC posted invoice integration and data freshness before enabling automatic release.
