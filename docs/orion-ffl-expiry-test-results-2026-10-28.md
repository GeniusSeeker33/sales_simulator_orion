# Orion FFL prospect expiry verification — 2026-10-28

Project: `fbugmcjsjohapkvodwzt` (development).

Tests executed in SQL transactions with `ROLLBACK`:
- Expired protected business → `available`, ownership audit count 1.
- Unexpired protected business → remains `protected`, audit count 0.
- Active invoice-backed business with elapsed active_until → remains `active`, audit count 0; invoice reconciliation intentionally required before any release.
- Unauthenticated qualifying-contact invocation rejected.
- Function privileges: contact callable by authenticated only, expiry by service_role only.

Not yet tested: actual authenticated representative identity and cross-rep contention, concurrent transactions, 21-day renewal through RPC, application integration, scheduled job. No live data imported and no production deployment.

Next: provision isolated test identities; run RPC and concurrency tests; implement scoped read API and UI integration behind feature flag.