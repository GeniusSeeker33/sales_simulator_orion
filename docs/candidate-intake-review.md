# Candidate intake review queue

The **Talent / People → Intake Review** surface is a read-only, human-governed view of Join-Orion applications that have not yet been imported into Candidate 360. It does not import candidates, merge identities, rank applicants, or recommend hiring decisions.

## Eligibility and states

The server calls the same canonical source adapter and `reconcileJoinOrionCandidates` dry-run engine used by the CLI. A future source application is eligible by default when it is valid, has a supported mapping, is not explicitly excluded, and has no existing CRM application provenance. The view explains `ready_for_review`, `identity_review_required`, `already_imported`, `excluded`, `invalid`, and `source_mapping_attention` states.

Only ready and identity-review states appear as queue items. Diagnostic counts distinguish invalid or unmapped records from a genuinely empty queue. Candidate-to-learner and candidate-to-employment linkage always remains **not verified**.

## Reviewed exclusions in hosted operation

Migration `20260916120000_join_orion_intake_exclusions.sql` adds `crm.join_orion_source_exclusions`, a durable workspace-scoped store containing only explicit source application UUID, classification/reason, reviewer, and reviewed timestamp. RLS permits reads only to CRM `manager` and `admin` members; writes remain service-role-controlled governance operations.

## Provisioning a reviewed exclusion manifest

Operators can inspect a reviewed manifest without writing by running
`npm run provision:join-orion-exclusions`. The command requires
`CRM_DATABASE_URL`, `CRM_WORKSPACE_ID`, `JOIN_ORION_DATABASE_URL`,
`JOIN_ORION_EXCLUSION_FILE`, `JOIN_ORION_EXCLUSION_OPERATOR`, and
`JOIN_ORION_EXCLUSION_FINGERPRINT`; each database also accepts its corresponding
optional `*_DATABASE_CA_CERT`. The fingerprint must come from the completed
review rather than being calculated ad hoc during provisioning.

The default is a dry run. After checking its plan, an operator may explicitly
run `npm run provision:join-orion-exclusions -- --apply`. Apply only inserts
missing exclusion governance rows, runs atomically, rejects changed or extra
hosted governance instead of replacing/deleting it, and succeeds only when the
hosted canonical fingerprint equals the reviewed fingerprint. It never imports
or updates candidate data. Command output contains counts and identifiers only;
database credentials and candidate fields are never printed.

The hosted server reconstructs the version 1 manifest from ordered rows and passes it through the existing validator, preserving canonical validation and fingerprint calculation. Existing production exclusions must be loaded through a separately reviewed service-role migration/operation before enabling the hosted queue; production UUIDs must not be placed in the client or an unreviewed repository fixture. Changes produce a different fingerprint rather than weakening PR #49 protections.

## Security and data minimization

The browser calls `/api/talent-intake` with its verified human session. The server requires membership in the selected CRM workspace with role `manager` or `admin`, runs CRM reads in the existing authenticated, read-only, RLS transaction, and connects separately to Join-Orion using server-only `JOIN_ORION_DATABASE_URL` and optional `JOIN_ORION_DATABASE_CA_CERT`. Authorization is never inferred from email.

The response contains the minimum review fields and a resume-presence boolean. It never contains resume paths, cover letters, admin notes, referral payouts, raw payloads, or database credentials.

## Refresh and failures

Refresh is manual. Every request performs a fresh governed read; the API sends `Cache-Control: no-store` and there is no polling or background job. Source unavailable, CRM unavailable, invalid exclusion configuration, authorization denial, source mapping attention, and an empty queue are separate states. Diagnostics are secret-safe.

## Approval boundary and follow-up

PR #50 intentionally stops at review. The current importer applies a complete dependency plan and has no safely governed per-application contract. **PR #51** should add an approval record and selective import operation that revalidates source state and exclusion fingerprint, blocks unresolved identity cases, computes the selected dependency closure, preserves transaction/idempotency guarantees, and records source application ID, operator, timestamp, fingerprint, run ID, and resulting CRM IDs. It must not import unrelated applications.
