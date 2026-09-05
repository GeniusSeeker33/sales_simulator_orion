# Durable verified learner records — Issue #18

Related to [GeniusSeeker33/geniusseeker-talent-success-platform#18](https://github.com/GeniusSeeker33/geniusseeker-talent-success-platform/issues/18).

## Implementation boundary

The existing React/Vite practice screens now use Supabase Auth and durable PostgreSQL records. This is a minimal implementation of the merged core-model, identity/employment crosswalk and training-record designs, not a new identity master. No live database was inspected or migrated.

- **Identity:** a Supabase-authenticated subject must have one active, independently verified `learner_bindings` row. The row references existing opaque `person_id` and `employment_episode_id` UUIDs, organization/role scope, identity and employment source references, environment/project, verifier and restricted evidence reference. Account-assigned rep, email, static roster and browser-created login objects never establish this binding.
- **Persistence:** `begin_learner_attempt` derives all attribution from the current binding. For simulation it atomically creates an attempt plus linked session before invoking a provider. Written practice records completion at submission; its text stays in memory. Native UUIDs are the source record IDs; native source system/entity, environment/project and timestamps are stored.
- **Lifecycle:** records start `in_progress`; a single atomic finish sets both attempt/session to `completed`, `technical_failure` or `abandoned`. Failure has null score. Revision 1 is start; revision 2 is terminal. Save retries use the same ID and identical terminal payload. Conflicting terminal rewrites fail.
- **Security:** learners have SELECT only, limited by RLS to their own records under an active binding. There are no learner INSERT/UPDATE/DELETE grants and no manager/admin history policy. Two narrowly scoped SECURITY DEFINER functions have an empty search path, fully qualified objects, current `auth.uid()`/binding validation, and explicit execute grants only to authenticated users. They accept no person, employment, assigned-rep or tenant input. Simulation/attempt identity consistency also has a composite FK.
- **Provider access:** the four existing practice provider handlers verify the bearer token with Supabase `getUser` and check enrollment using an RLS-bound publishable client. No service-role key is used. Existing provider configuration remains server-only.
- **Legacy:** old `simulatorResults` and `sales-simulator-orion-training-results-v1` values remain untouched. Their loaders return no learner history and legacy writers reject calls. Nothing imports, guesses or relabels them. New history is not fed into legacy leaderboards, computed levels or reward logging.

## Data and compatibility limits

The practice UI retains account context, written exercises, typed simulation, voice and feedback. New “My saved practice” lists the latest 50 records from the database after refresh/sign-in. Empty means a successful query returned no accessible rows; query failures display unavailable. A refresh during a call leaves a durable **unscored in-progress** occurrence; resuming/reconstructing that conversation is not implemented. A save error is explicit with a retry; a refresh before retry cannot recover an unsaved terminal payload. A start whose acknowledgement is lost may leave an in-progress occurrence; it is never inferred completed.

Written practice is now unscored: the former character-count heuristic is not a competency assessment. Written responses, personal notes, dealer contact details, account snapshots, raw recordings and transcripts are not copied to the new tables. Existing in-session voice recording remains browser-local; no new upload/storage path is introduced.

Simulation numeric suggestions are a small **learner-submitted, unreviewed AI feedback projection**, not an attested assessment or human conclusion. A learner can alter a request's practice suggestions; these values are deliberately ineligible for performance rankings, progression or payment decisions. No competency bands or human approvals are created. Raw AI text/interaction artifacts are not retained in the durable foundation and these records alone cannot support a later evidence review. An approved restricted evidence-storage/attestation design is required before using them as competency evidence.

Version references: `orion-practice-v1` identifies the base scenarios/written exercise definitions and `legacy-score-call-v1` the existing scoring prompt in repository base commit `e4fc018e031e8ae3ffd647e007e78e8eb1b4cea9`. Difficulty is stored for simulation. Dynamic account/inventory context remains in-session; these are occurrence records, not replayable evaluations. Do not treat these legacy criteria as the governed C01–C15 framework. Future content/prompt changes must receive new version references.

**Authentication transition:** the old browser passwords, derived employee-code passwords and email-based admin elevation are removed. Existing local “orion-auth-session” objects are ignored/removed, not migrated. All pilot logins receive only the ordinary learner route role; previous manager/admin screens have no new access grant. The separate newsletter Supabase client is unchanged. Use a separately approved learner project unless IT explicitly approves secure reuse; there is no fallback to the newsletter project. Missing learner configuration fails closed.

## Manual deployment — human approval required

1. **IT/identity owner:** choose the Supabase project/environment and organization scope. Confirm data residency, retention, correction/erasure policy, verified employment authority, consent for existing provider processing and who may provision/revoke bindings. Do not assume OS, recruiting or newsletter projects are shared.
2. Use a disposable staging project first. Review and apply only `supabase/migrations/20260905170811_durable_learner_records.sql` through the approved migration process. This PR does not run `db push`, link a live project or deploy anything. The CLI generated the timestamped migration; tests execute that exact SQL.
3. Configure Supabase Auth for individually provisioned accounts: disable public signup, invite/provision each pilot user via the approved administrative process, establish password recovery and redirect settings, and test email confirmation/recovery. Do not reuse previous shared/browser passwords. Credential-response owners should rotate any formerly exposed credentials still valid elsewhere.
4. A trusted identity steward verifies the person and employment episode at their authoritative source, then inserts the binding through approved privileged tooling. The verifier must be a separate identified Auth user; unresolved/disputed people receive **no binding**. Reference the existing canonical UUIDs; do not derive them from email or generate competing person identities. Preserve fully scoped source system/entity/record/tenant references in `identity_source_ref` and `employment_source_ref`; references must point to restricted records, never bearer URLs or credentials.
5. Configure matching browser and server settings in the deployment environment:
   - Browser: `VITE_LEARNER_SUPABASE_URL`, `VITE_LEARNER_SUPABASE_PUBLISHABLE_KEY`.
   - Server: `LEARNER_SUPABASE_URL`, `LEARNER_SUPABASE_PUBLISHABLE_KEY`.
   - Existing `OPENAI_API_KEY` remains server-only. Never put service-role/secret keys in any VITE variable. Publishable keys are public identifiers; RLS and verified JWTs enforce access.
6. Record the actual learner environment/project in each binding. Run the acceptance procedure below; review effective grants/RLS and Supabase Security Advisor findings in staging. Approve production migration and coordinated frontend/API release only after those checks pass. No automatic production approval is implied by PR merge.

Provisioning shape (placeholders only; run with approved privileged tooling, never the browser):

```sql
insert into public.learner_bindings (
  auth_user_id, person_id, employment_episode_id, organization_scope, role_scope_ref,
  source_environment, source_project, identity_source_ref, employment_source_ref,
  verified_by, verification_evidence_ref
) values (
  '<confirmed-auth-user-uuid>', '<canonical-person-uuid>', '<confirmed-episode-uuid>',
  '<approved-organization>', '<approved-role-ref>', '<actual-environment>', '<actual-project>',
  '<fully-scoped-identity-source-ref>', '<fully-scoped-employment-source-ref>',
  '<independent-verifier-auth-uuid>', '<restricted-verification-case-ref>'
);
```

**Revocation/rehire/correction:** a trusted steward sets `revoked_at`, `revoked_by` and `revocation_reason` together. Binding identity/source fields cannot be edited or deleted. A replacement cites `supersedes_id`; rehire uses a new employment episode UUID for the same person. Revoked binding records are not readable through ordinary learner history and cannot accept new writes. Prior episodes remain unchanged for authorized administrative review; cross-episode access and disputed-record corrections need a separately approved process. Do not silently update historical learner IDs. A binding grants pilot access; it does not declare employment policy.

**Rollback:** stop pilot writes/revoke affected bindings and roll back the coordinated release under IT control. Keep tables/records intact for audit and forward repair; do not drop populated tables or restore the insecure browser-auth path as a production workaround. No automatic down migration or historical import is supplied. The foundation uses new names and leaves existing enterprise integration tables untouched.

## Verification

Run `npm ci`, `npm run test:learner`, and `npm run build`. The automated suite executes the real migration in isolated PGlite PostgreSQL, with only Supabase's Auth schema/JWT helper stubbed. It changes database roles to exercise RLS and closes/reopens an on-disk database. It covers:

- anonymous/unbound denial; server-derived person/episode on written attempts and linked simulation sessions;
- A/B isolation including direct ID queries, cross-user finalize, forbidden direct writes and binding forgery;
- idempotent save, terminal immutability, failed/unscored constraints and malformed provider output;
- persistence after database restart/new identity session, revocation and distinct rehire episodes;
- quarantined legacy values staying byte-for-byte unchanged.

**Required staging/browser acceptance (not claimed executed against a live service):**

1. Provision verified test learners A/B with distinct people/episodes; use separate browser profiles. A completes a written exercise and typed simulation. An approved database operator verifies both contain A's authenticated subject, person/episode, organization and source context, regardless of the account's assigned rep.
2. Refresh, log out and back in, then use another browser/device as A. Both record IDs must appear in My saved practice. A session interrupted by refresh must remain in-progress/unscored.
3. Sign in as B. Query A's attempt and session UUIDs directly via the Supabase REST API using **B's JWT + publishable key**, not privileged tooling. Both return no rows. Attempt direct writes and RPC finish on A's ID: reject. Remove the JWT: access is denied. An authenticated but unbound test account cannot start records or call practice providers.
4. Complete a voice call and verify its attempt/session match the same learner. Reject microphone permission or force a realtime/provider error: persisted state is technical_failure and all suggestions null. Stop with no learner transcript: abandoned/unscored.
5. Block/return HTTP 500 from score-call/customer-reply/speech, or return a malformed score. End the attempt; verify technical_failure/unscored in both database and UI, never a zero score. Interrupt while a provider reply is pending: unscored. Restore connectivity and retry saving after a database outage; same ID, no duplicate terminal event.
6. Seed both legacy localStorage keys with a distinct test record before sign-in. Complete new work; original values remain unchanged, never copied to learner tables or displayed as the signed-in learner's history.
7. Revoke A's binding and repeat reads/start/provider requests: no access. Test expiry/logout and same-browser A→B switching. Review RLS/grants and verify compiled assets contain no passwords or secret/service-role keys.
8. Confirm legacy role-route limitations with pilot owners and verify existing practice controls under the coordinated staging frontend/API deployment.

PGlite tests do not validate hosted PostgREST/JWT signing, invitation email, real provider/audio devices, or deployment settings. Those are explicit staging gates, not reasons to connect to production from this task.

