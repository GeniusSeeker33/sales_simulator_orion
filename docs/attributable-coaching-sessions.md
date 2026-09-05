# Attributable coaching sessions — Issue #20

Related to [GeniusSeeker33/geniusseeker-talent-success-platform#20](https://github.com/GeniusSeeker33/geniusseeker-talent-success-platform/issues/20). Builds on the [learner foundation](durable-learner-records.md) and [scoped reviewer access](scoped-reviewer-history.md).

Requirements were read from the control repository at `8326efd1940509dd15510a474a57299f18e6ab76`: training-progression record design, Orion sales competencies and L1–L5 framework. Competency references use **orion-sales/0.1-draft**, C01–C15. This pins the existing draft content as discussion targets; it does not approve that framework as employment policy, assign B-bands or change L-levels. New competency content requires a new version and an explicit follow-up change.

## Permissions and durable records

- **Coach/manager:** a verified authenticated subject with an active, unexpired reviewer scope for the exact learner binding may publish a completed session. Publication/correction additionally requires that learner binding to be active and belong to a different subject. No email, name, rep code or browser role establishes authority. Reviewer scopes are checked and locked with the learner binding during writes so revocation is serialized with publication.
- **Learner:** their current active binding controls own coaching reads and response writes, following the existing learner-history boundary. They cannot publish coaching or modify coach content.
- **Other reviewers:** any active scope for the exact binding may read its sessions and learner responses. It does not permit editing or correcting another coach's sessions. Author identity alone grants no continuing access after scope revocation.
- **Storage:** private `learner_coaching.sessions` and `learner_coaching.responses` tables have RLS enabled and no anonymous/authenticated table grants. Public SECURITY INVOKER RPC wrappers invoke narrowly authorized private SECURITY DEFINER implementations with empty search paths and fully qualified objects. Internal access helpers are not executable by client roles.
- **Attribution:** publication derives learner binding, person UUID, employment episode UUID, organization/role scope, source project/environment and coach Auth UUID on the server. The original approved scope ID is retained as provenance. Native source record ID is the immutable session UUID; source system/entity and creation/revision metadata are recorded.
- **No infrastructure expansion:** existing individual Auth accounts and publishable client configuration are reused. No new credentials, service-role browser key, integration, notification service or global manager role is introduced.

**Deployment changes the permitted use of active reviewer scopes:** active Issue #19 manager/coach scopes can now publish coaching for active learner bindings. Before rollout, the access owner must approve that capability for existing grants and revoke grants whose holders should not coach. Separate read-only reviewer roles are not introduced in this narrow task.

## Published content and evidence

Every session contains occurred-at, versioned competency targets, evidence references, observed behavior, strengths, development opportunity, assigned practice/next action, optional follow-up date and developmental progress status. The progress enum is practiced / follow_up_pending / improving / demonstrated / reassess; even “demonstrated” is a coaching observation, not competency approval.

Structured summaries are required and capped at 1,500 characters each. The request rejects unexpected fields. UI instructions prohibit pasted transcripts, recordings, private artifacts and sensitive third-party details. There is no automatic copying of raw training text, AI feedback text, account snapshots or notes. Human-entered summaries still require appropriate judgment; there is no claim of semantic redaction of arbitrary pasted text.

Select 1–20 terminal training-attempt/simulation references from the existing paginated reviewer history. The migration adds only the exact record revision to that existing projection. Publication verifies **ID + kind + displayed revision + identical learner binding**, locks the source row and preserves source system/entity/project/environment, scenario, status and revision in the reference. Unknown, in-progress, different-episode, duplicate or stale references fail. Failed practice may be discussed but remains a technical failure/unscored reference. A simulation and its containing attempt are linked context, not two independent observations.

Next action is descriptive coaching follow-up; no training-assignment workflow is created. No band, level, progression, compensation or ranking field is accepted or written.

## Corrections and learner responses

All coaching submissions are immediately **completed and immutable**; drafts exist only in page memory. UPDATE/DELETE triggers protect published content, including against accidental privileged edits.

Only the original coach, still authorized for the active learner binding, can publish a correction of the latest version. It gets a new UUID, incremented revision, unique `supersedes_id` and mandatory reason. Prior text, author, time and evidence remain intact. The unique predecessor constraint and row lock prevent branching corrections. New evidence references are independently validated.

Learner acknowledgment/comment is a separate append-only record with its own UUID, server timestamp and exact coaching-version reference. Acknowledgment means **receipt, not agreement**. A comment can be submitted without acknowledgment. Learners cannot send coach-authored fields through this endpoint. Additional comments remain separate events rather than silent edits.

Old acknowledgments remain with the superseded version; they are never transferred to a correction. New responses must target the latest version. The learner may acknowledge/comment on the replacement separately. Stable client request UUIDs and server payload fingerprints make identical retries idempotent; changed submissions under an existing ID fail. On an uncertain save, retry the frozen request or check history before unlocking/canceling.

## Rehire and access changes

No history, evidence, responses or correction lineage crosses a binding/episode automatically. New rehire bindings need their own grants. Existing explicitly scoped reviewers may read historical coaching under retired bindings, as with Issue #19 history, but **cannot publish/correct coaching for a retired binding**. Learner access follows the current active-binding boundary; earlier episodes remain retained for explicitly authorized historical review.

Revocation/expiry blocks future scoped reads and writes without a JWT refresh. Previously delivered data cannot be recalled; an in-flight read uses its database snapshot. The UI rechecks on focus, manual refresh and a 30-second timer, hiding prior content during verification and on failures. Protected account switching unmounts the page. No coaching history, responses or drafts are written to localStorage.

Author substitution, corrections after binding retirement, and administrative erasure/redaction are deliberately not implemented. They require a separate approved auditable process; do not bypass immutability triggers informally.

## UI

- **Assigned Learner History:** select an approved episode, find evidence using the existing history pagination, then use Episode Coaching to publish or review. Evidence selected on another page keeps its ID/revision. Only the author gets a “Correct with a new version” control for the current record.
- **My Coaching** (`/my-coaching`): learner reads their current episode's sessions, original/corrected versions and responses; they can acknowledge receipt and optionally comment.
- Both views show coach Auth UUID, occurrence/publication dates, targets/version, narrative fields, next action, follow-up date, progress status, evidence IDs/revisions and correction lineage. They do not copy a personnel directory to resolve names.
- Up to 50 coaching versions are returned per page, with a timestamp/UUID cursor and one extra row for paging detection. Failed requests show unavailable rather than an empty history or successful save.

Learner practice, self-history, reviewer history and legacy quarantine remain in place. No private raw content is added to reviewer-history responses.

## Manual staging/deployment — approval required

**No production migration or deployment has been performed.**

1. Access/privacy/training owners approve existing scope holders' coaching permission, current learner/coach identity mappings, target version, summary-sharing expectations, retention and correction/response procedures. Confirm that learners understand comments are visible to authorized episode reviewers and acknowledgment is not agreement.
2. On a disposable staging project with the Issue #18/#19 migrations already applied, review and apply only `supabase/migrations/20260905181617_attributable_coaching_sessions.sql`. Keep `learner_coaching` and `learner_review` out of exposed schemas. Review effective grants/RLS and Security Advisor findings.
3. Reuse verified individual Auth accounts and exact-episode scopes provisioned through the approved Issue #19 process. No browser provisioning or new secrets. Revoke/restrict inappropriate existing grants before enabling this release.
4. Run local tests/build and the staging acceptance procedure below. Approve the production migration and frontend rollout separately. A frontend deployed before the migration fails closed for coaching.
5. Rollback by revoking client execution on the public/private coaching RPCs and disabling the coaching UI; retain immutable sessions/responses and their audit history for forward repair. Restore the prior reviewer read projection only through a reviewed follow-up migration if needed. Do not drop populated tables or restore insecure authentication.

## Verification and staging acceptance

Run `npm run test:learner`, `npm run build`, and ESLint for the changed UI/helper files. The tests execute all three migrations in isolated PGlite PostgreSQL; only Supabase Auth/JWT infrastructure is stubbed. They cover authorized coach/manager publication; ordinary/out-of-scope/anonymous/revoked/expired denial; attribution; learner/other-reviewer reads; immutable response isolation; exact same-episode terminal evidence; corrections/idempotency; disk reopen durability; rehire; and unchanged band/level sentinel state. Existing learner/reviewer regressions also run against the new migration.

Required hosted staging/browser checks (not claimed executed):

1. Provision learner A/B, coach C and reviewer D with separate individual accounts. Give C/D scope for A only. Publish a session as C against A's terminal written attempt and failed simulation with their displayed revisions. Verify canonical person/episode, coach subject, scope, timestamps and source/evidence revisions through approved inspection.
2. Refresh/sign in elsewhere: C, A and D can retrieve the session; B and an unassigned reviewer cannot. Direct table SELECT/INSERT/UPDATE/DELETE and internal helper execution using ordinary JWTs must fail.
3. A acknowledges and optionally disagrees in a comment. Verify coach text is byte-for-byte unchanged and D sees the separate learner response. Attempts to send extra coach fields, respond as B/C, or alter/delete prior responses fail.
4. C publishes a reasoned correction. Original content and responses remain; new version starts unacknowledged. D cannot correct C's record. A cannot respond to an obsolete version. Repeating the identical save creates no duplicate; competing corrections cannot branch.
5. Submit foreign/stale/in-progress evidence or a different episode's ID via RPC: deny. Do not convert failed practice to low proficiency. Confirm coaching leaves existing B/L state untouched.
6. Revoke C's scope while their form is open; next read/publish fails. Expired grants also fail without JWT refresh. Rehire A under a new binding: old scoped history remains distinct, old grants/evidence cannot write into the new episode, and current learner access remains scoped.
7. Test network failure/retry, page refresh, account switch, new/older coaching pages, evidence pagination, and all required form fields. No save should be displayed as confirmed on an error; no draft/raw artifact is stored in browser history.

Hosted JWT/PostgREST behavior, browser interaction and production permissions require staging verification. No live learner or provider API was used in automated verification.
