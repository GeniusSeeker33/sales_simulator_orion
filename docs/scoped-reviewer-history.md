# Scoped manager/coach history — Issue #19

Related to [GeniusSeeker33/geniusseeker-talent-success-platform#19](https://github.com/GeniusSeeker33/geniusseeker-talent-success-platform/issues/19). Builds on the merged [durable learner foundation](durable-learner-records.md).

## Authorization and privacy

A trusted identity/access steward provisions a `learner_review.scopes` row linking a **verified Auth user UUID** to one existing **learner binding UUID**, with manager/coach role, independent approver, restricted approval reference, approval time and mandatory expiry. A grant confers read access to that exact binding's history, including earlier records; there is no person-wide, email-based, team-name or organization-wide inference. “Manager” and “coach” are labels within an approved grant, not global application roles.

The scope table is in a non-exposed schema, has RLS enabled, and grants no table access to anonymous/authenticated users. Scope identity/approval fields cannot be changed or deleted: revoke with actor/time/reason, then create a replacement referencing `supersedes_id`. No browser provisioning, record writes, reassignment or privilege elevation is added.

Existing learner table RLS and write commands are unchanged. Reviewers cannot SELECT assigned learners' base tables directly. The public **SECURITY INVOKER** `read_reviewer_history` RPC delegates to a narrowly scoped **SECURITY DEFINER** reader in the private schema. The implementation uses an empty search path, fully qualified objects, `auth.uid()`, and current grant approval/expiry/revocation checks on **every request**, including pagination. Anonymous execution is revoked. Its explicit JSON projection excludes learner Auth subjects, email/name, verification/approval evidence, private notes, transcripts, recordings and credentials. Future base-table columns do not automatically appear in this response.

Review access never permits practice writes for the reviewed person. Reviewers who separately have their own learner binding retain their normal own-record permissions only.

## Employment episodes and revocation

Each approved scope references the immutable Issue #18 binding, preserving its person, employment episode and organization. Rehire/replacement bindings need new, explicit approval; no access transfers to the new episode.

**Historical access is a deliberate grant:** an existing approved reviewer scope can read the records of its exact retired learner binding. Retiring a learner binding prevents learner use under Issue #18; it is not itself revocation of the separate reviewer grant. To withdraw review access, revoke that scope (or all of the reviewer's scopes). This preserves independently approved historical review without merging episodes. For an identity dispute, the steward must revoke affected reviewer scopes as part of the dispute response.

A revocation committed before the next request denies that request even with the same JWT. Already delivered information cannot be recalled, and an in-flight database statement uses its existing snapshot. The UI rechecks on focus, manual refresh and every 30 seconds; it hides stale data while checking and clears history on denied/unavailable responses. No reviewer history is persisted to browser storage. Account switching unmounts the protected page.

## UI

`/reviewer-history` appears as **Assigned Learner History**. The route requires verified sign-in; actual authorization is the database grant, not navigation visibility. An ordinary user sees no scopes and cannot retrieve others' records by guessing IDs. No existing manager/admin dashboard route is enabled.

Choose an approved person/episode/organization, identified by canonical UUIDs without copying a personnel directory. The view shows:

- written vs simulation practice, scenario/content version and source environment/project;
- attempt ID, start/end timestamps and lifecycle status;
- linked simulation session ID, scenario/version, difficulty, timestamps and status;
- technical failure as **unscored**; available overall AI feedback as **unreviewed, supporting evidence only**.

Results are chronological, not ranked. There are 50 occurrences per page, with a timestamp+UUID cursor and one extra row to detect an older page. Each page revalidates scope. Empty authorized results and unavailable/denied requests have distinct messages. Individual historical episodes remain separately selectable. Learner self-history and legacy-data quarantine are unchanged.

This does not create coaching writes, approved competency evidence, progression, risk scores or performance conclusions. Raw feedback text was not stored by Issue #18 and is not invented here.

## Manual staging and provisioning

**No migration or production deployment has been run.**

1. IT/access owner approves the reviewer identities, exact learner bindings/episodes, role, expiry, historical-access purpose and approver; approve retention/audit and dispute/revocation ownership. Reviewers must use individual provisioned Auth accounts. Never create access from names, emails or browser roles.
2. In a disposable staging project already running the Issue #18 migration, review/apply only `supabase/migrations/20260905175922_scoped_reviewer_history.sql`. Keep `learner_review` out of Supabase's exposed schemas. Review effective grants/RLS and Security Advisor results. No new secrets, service-role browser key, environment variables or integrations are required.
3. Using approved privileged SQL tooling, insert a scope with verified source UUIDs and explicit approved timestamps. The authenticated browser role has no such capability:

```sql
insert into learner_review.scopes (
  reviewer_user_id, learner_binding_id, reviewer_role,
  approved_by, approved_at, approval_ref, expires_at
) values (
  '<verified-reviewer-auth-uuid>', '<exact-approved-learner-binding-uuid>', 'coach',
  '<independent-approver-auth-uuid>', '<approved-at-timestamp>',
  '<restricted-access-approval-reference>', '<approved-expiry-timestamp>'
);
```

4. To revoke a grant, set all audit fields together with approved tooling:

```sql
update learner_review.scopes
set revoked_at = now(), revoked_by = '<authorized-revoker-auth-uuid>',
    revocation_reason = '<approved-reason>'
where id = '<grant-uuid>' and revoked_at is null;
-- To remove all review access, target reviewer_user_id instead and revoke every active scope.
```

5. Execute the acceptance checks below, then separately approve production migration and frontend release. A frontend deployed before the migration displays unavailable and grants no access.
6. Rollback: revoke affected scopes or revoke authenticated execution on the public/private reader; remove the reviewer route in a follow-up rollback. Preserve scope audit rows and durable learner records. Do not broaden table policies or drop populated tables to recover.

## Verification

`npm run test:learner` runs the original learner regression suite **with both migrations applied** and the scoped reviewer suite in isolated PGlite PostgreSQL. Coverage includes learner A/B denial; assigned manager and coach access; out-of-scope, anonymous, revoked and expired denial; direct-table privacy; no mutations or reassignment even for reviewers with their own learner binding; separate rehire episodes; technical-failure null scores; limited response fields; stable paginated reads and AI labels. Run `npm run build` and ESLint for the changed UI/helper.

Required staging/browser checks (not claimed executed against hosted services):

1. Provision A/B plus assigned reviewer M and unassigned reviewer N. Complete written/simulation work as A and B; confirm learner self-history still shows only the signed-in learner's rows.
2. Give M a grant to A's exact binding. In Assigned Learner History, verify A's separate attempt/session context, timestamps and statuses; B must not appear. As N, no scopes appear. Try M's grant UUID using N's JWT through RPC: deny.
3. Using M's JWT and a publishable key, direct SELECT of A's base records remains empty; direct INSERT/UPDATE/DELETE of records, bindings and scope rows fails. Both finish/reassignment attempts must fail. Repeat with a reviewer who also has a personal learner binding.
4. Revoke M's grant with a separate administrative session while M's page remains open. The next RPC/page request must deny without token refresh; manual refresh/focus/poll removes displayed history. Attempt an older-page cursor after revocation: deny.
5. Rehire A through a new Issue #18 binding. The old grant does not include new records. Approve a distinct new-episode grant and confirm both episode UUIDs are separate, without rewriting history.
6. Verify failed simulations remain unscored and AI feedback remains unreviewed/supporting evidence. Check network responses for the documented field allowlist and absence of raw/private content.
7. Exercise empty history, unavailable network, expired grant, same-browser account switch and multiple history pages. Sign out/in using individual Auth accounts.

Automated SQL tests stub only the Supabase Auth schema/JWT helper. Hosted JWT/PostgREST configuration and browser interaction are staging gates; no live APIs or production data were used for verification.
