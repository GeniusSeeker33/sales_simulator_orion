# Orion MVP staging and pilot readiness

Related to GeniusSeeker33/geniusseeker-talent-success-platform#24. **Overall: BLOCKED for a hosted/real-learner pilot; ready for operator review of this runbook.**

Verified baseline: `fd7e450459a1461d6f503d3bd4b5f10f0b286418`, merged PRs #1–#6, 2026-09-05. This task changes documentation only. No hosted database, Auth account, credential, initial level or deployment was created/changed. No approved staging project or individual test accounts were supplied/selected. Every hosted procedure below is **BLOCKED — HUMAN ACTION**, not an executed result.

Local verification at this baseline: `npm run test:learner` passed **69 tests**, applying all six actual migrations in isolated PGlite PostgreSQL; `npm run build` passed with the existing large-bundle warning. Local tests cover SQL roles/RLS, durable restart, the six layers, corrections, revocation, rehire and unchanged employment/compensation sentinels. Stubbed Auth/JWT helpers do not prove hosted Auth, PostgREST, browser, provider/audio or independent-connection concurrency behavior.

## 1. Exact migration order

| Order / merged PR | File under `supabase/migrations/` | Dependency/result |
|---|---|---|
| 1 / #1 (`7be912a`) | `20260905170811_durable_learner_records.sql` | Supabase Auth → bindings, attempts, simulations, RLS and practice commands |
| 2 / #2 (`aaa7561`) | `20260905175922_scoped_reviewer_history.sql` | Bindings/attempts → private reviewer scopes and scoped read |
| 3 / #3 (`bb14494`) | `20260905181617_attributable_coaching_sessions.sql` | Shared authorization helper, coaching/responses; replaces reviewer read to expose exact revisions |
| 4 / #4 (`6c72396`) | `20260905191217_human_reviewed_competency_evidence.sql` | Coaching/helper/source records → human competency findings |
| 5 / #5 (`187d8a3`) | `20260905192514_human_approved_competency_band_review.sql` | Competency evidence → human band/defer review |
| 6 / #6 (`fd7e450`) | `20260905194609_human_approved_progression.sql` | Prior layers → progression review, official history and private L1 initialization |

Before execution, IT records approved **staging** project/reference, environment, region, operator, UTC time, baseline SHA and existing `supabase_migrations.schema_migrations` versions. Stop on production, unapproved shared/newsletter project or unexplained drift. Apply committed files through the reviewed migration process in this order and record completion. CREATE statements are not idempotent replay scripts. An existing table is not proof a migration was fully applied: reconcile full SQL and history. Do not automatically `db push`, reset, silently repair migration history or delete data. Verify all six versions/functions/policies afterward. This runbook adds no migration.

## 2. Staging requirements

### Auth, runtime and environment

- Dedicated approved non-production Supabase project. Disable public self-signup and anonymous sign-ins; invite/provision individual verified accounts. Test confirmation/recovery and redirect allowlist; approve session and administrator MFA policies. Get subject UUIDs from Auth, never infer authority from email/name/user-editable metadata. No legacy/shared passwords.
- Separate browser profiles for each test person. Keep passwords/JWTs in individual session memory or approved secret tooling, never GitHub, committed files, screenshots or shared logs. The ordinary `rep` frontend route role is intentional: scoped reviewer authority comes from the database, not manager/admin navigation.
- Frontend: `VITE_LEARNER_SUPABASE_URL`, `VITE_LEARNER_SUPABASE_PUBLISHABLE_KEY`. Server: `LEARNER_SUPABASE_URL`, `LEARNER_SUPABASE_PUBLISHABLE_KEY`. All must target the **same staging project**. Missing configuration fails closed. No service-role/secret key in any browser bundle or `VITE_*` variable.
- Existing `/api/customer-reply`, `/api/score-call`, `/api/speak-customer`, `/api/realtime-session` need a staging server runtime and server-only `OPENAI_API_KEY` for approved synthetic provider tests. A Vite-only static server does not validate these APIs. They verify bearer users and active enrollment. Provider budget/processing approval, HTTPS/microphone and failure injection remain hosted gates.
- Do not configure/call RingCentral, Business Central, FedEx, compensation or unrelated services. The separate newsletter fallback client is not the learner project. IT must isolate unrelated legacy routes/network calls from the pilot; missing enterprise credentials alone does not prove the entire legacy site is safe. Review actual network traffic on controlled learner routes without printing secrets.

### Exposed schemas and exact RPC surface

Use `public` for this feature's API. Keep `auth`, `learner_review`, `learner_coaching`, `learner_competency`, `learner_band`, `learner_progression` **unexposed**. Internal USAGE/function grants are not permission to expose private schemas.

Public `learner_bindings`, `learner_training_attempts`, `learner_simulation_sessions` have authenticated SELECT guarded by owner/active-binding RLS; own binding audit rows remain visible. No authenticated INSERT/UPDATE/DELETE. Assigned reviewers do not get direct SELECT of their learners' base records. All private tables have RLS and no anonymous/authenticated table access.

| Public RPC | Arguments (defaults shown) | Authority |
|---|---|---|
| `begin_learner_attempt` | `p_id,p_kind,p_scenario,p_difficulty=null` | Own active learner |
| `finish_learner_attempt` | `p_id,p_status,p_ai_score=null` | Own active learner, terminal once |
| `read_reviewer_history` | `p_scope_id=null,p_before=null,p_before_id=null` | Null lists own active scopes; selected scope reads exact episode |
| `publish_coaching_session` | `p_id,p_scope,p_body` | Active exact reviewer |
| `respond_to_coaching` | `p_id,p_session,p_ack,p_comment=null` | Own current learner; separate response only |
| `read_coaching_sessions` | `p_scope=null,p_before=null,p_before_id=null` | Own current learner or exact reviewer |
| `publish_competency_evidence` | `p_id,p_scope,p_body` | Active exact reviewer |
| `read_competency_evidence` | `p_scope=null,p_before=null,p_before_id=null` | Own current learner or exact reviewer |
| `publish_competency_band_review` | `p_id,p_scope,p_body` | Active exact reviewer |
| `read_competency_band_reviews` | `p_scope=null,p_before=null,p_before_id=null` | Own current learner or exact reviewer |
| `publish_progression_review` | `p_id,p_scope,p_body` | Active exact reviewer; initial history required |
| `read_progression_reviews` | `p_scope=null,p_before=null` (sequence cursor) | Own current learner or exact reviewer |

All 12 require a signed authenticated user. `learner_progression.initialize(uuid,text,text)` is **private administrator-only**, never a public RPC or authenticated grant. Trigger functions and `learner_coaching.authorized_binding` are internal. The two PR #1 practice commands deliberately use public SECURITY DEFINER with explicit checks/empty search path; later public wrappers use SECURITY INVOKER and scoped private definers. Never grant EXECUTE on all functions indiscriminately.

### Security Advisor and effective-grant checks

Run hosted Security Advisor; save finding IDs, disposition, owner and time in the restricted log. Unexpected exposure, broad grants, missing RLS or unsafe ownership/search paths block the pilot. Review the intentional practice definers specifically; no global waiver. Audit actual grants even with no Advisor findings. Operator read-only SQL:

```sql
select n.nspname,c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'SELECT') as auth_select,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as any_auth_write,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as any_anon_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and (n.nspname in
 ('learner_review','learner_coaching','learner_competency','learner_band','learner_progression')
 or (n.nspname='public' and c.relname in
 ('learner_bindings','learner_training_attempts','learner_simulation_sessions')))
order by 1,2;
-- All RLS true; writes/anon false; auth SELECT true only on the 3 public tables.
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where tablename in
 ('learner_bindings','learner_training_attempts','learner_simulation_sessions');
-- SELECT owner predicates only, not USING(true). Inspect the complete expressions.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
 p.prosecdef,p.proconfig,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('learner_review','learner_coaching','learner_competency','learner_band','learner_progression')
 or (n.nspname='public' and p.proname in
 ('begin_learner_attempt','finish_learner_attempt','read_reviewer_history','publish_coaching_session',
 'respond_to_coaching','read_coaching_sessions','publish_competency_evidence','read_competency_evidence',
 'publish_competency_band_review','read_competency_band_reviews','publish_progression_review','read_progression_reviews'))
order by 1,2;
```

Check private sequence grants deny authenticated/anon and all owners are trusted administration roles. Unexposed-schema REST failure alone does not prove table grants/RLS: combine real-JWT negatives with this audit. SQL-role impersonation is not evidence of hosted JWT authentication.

## 3. Six individual identities and exact provisioning

Aliases label individual accounts, never shared logins. Keep alias→Auth UUID mapping in a restricted ledger. A steward allocates opaque test person/episode UUIDs for this clearly synthetic scenario. Real people require authoritative verified UUIDs, not new identities derived from email, assigned rep or browser state.

| Alias | Initial records | Expected access |
|---|---|---|
| A | A_AUTH / A_PERSON / A_EP1; returned A_BIND1 | Own learner history, no reviewer grant |
| B | Distinct B_AUTH / B_PERSON / B_EP1; B_BIND1 | Own records only |
| M | Manager Auth UUID; M_A_SCOPE on A_BIND1 | Exact A reviewer; no own learner binding needed |
| C | Coach Auth UUID; C_A_SCOPE on A_BIND1 | Exact A reviewer; no own learner binding needed |
| X | Outside reviewer Auth UUID, no active scope/binding | Denied A/B access |
| V | Independent verifier/approver Auth UUID; separately authorized named privileged operator | Provisioning only, no implied app rights |

M/C scopes now authorize **all later publications**, not just PR #2 reads. Role labels do not provide per-feature permissions. Scope approval is not L1 enrollment approval or approval of every future decision. Leadership must approve eligible reviewers and required independent human decision procedures.

### Learner binding / employment episode

Replace every placeholder with approved ledger values and execute only with privileged staging tooling. Repeat for B using distinct IDs and capture returned binding UUID. No separate employment master is created here: bindings reference steward-verified episode/source records.

```sql
insert into public.learner_bindings
(auth_user_id,person_id,employment_episode_id,organization_scope,role_scope_ref,
 source_environment,source_project,identity_source_ref,employment_source_ref,
 verified_by,verification_evidence_ref)
values ('<A_AUTH>'::uuid,'<A_PERSON>'::uuid,'<A_EP1>'::uuid,'<test-org>','<role-ref>',
 '<actual-staging-environment>','<actual-project-ref>','<scoped-synthetic-identity-ref>',
 '<scoped-synthetic-employment-ref>','<V_AUTH>'::uuid,'<restricted-verification-ref>')
returning id;
```

Verifier differs from learner; one active binding per Auth subject. Identity/source fields cannot be edited/deleted. References preserve source system/entity/record/environment/project/tenant context; never store private content or signed bearer URLs in them.

### Scope / expiry / revocation / replacement

```sql
insert into learner_review.scopes
(reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approved_at,approval_ref,expires_at)
values ('<M_AUTH>'::uuid,'<A_BIND1>'::uuid,'manager','<V_AUTH>'::uuid,
 '<approved-UTC-time>'::timestamptz,'<restricted-scope-approval-ref>',
 '<approved-future-expiry>'::timestamptz)
returning id;
-- Repeat for C_AUTH / coach; record C_A_SCOPE.

update learner_review.scopes
set revoked_at=now(),revoked_by='<V_AUTH>'::uuid,revocation_reason='<approved-test-reason>'
where id='<M_A_SCOPE>'::uuid and revoked_at is null;
```

Expiry must follow approved_at. For the expired fixture, create a separate X scope approved by V with labeled test reference, `approved_at=now()-interval '2 hours'`, `expires_at=now()-interval '1 hour'`; it must never appear active. Do not change browser clock or wait for JWT expiry.

Never edit scope identity/expiry/approval, delete it or clear revocation. To restore M after testing, insert a new approved scope using these fields **plus `supersedes_id='<old-scope-uuid>'`**; use the returned new UUID thereafter. Retiring a binding does not revoke separate historical reviewer reads; revoke those scopes as well when access must end.

### Human-approved initial L1

Before initialization, progression read returns `current_level:null`, and publication fails. After independently verifying a separately documented human L1 confirmation, the privileged operator runs:

```sql
select learner_progression.initialize(
 '<active-M_A_SCOPE>'::uuid,
 '<restricted-written-human-L1-confirmation-ref>',
 'SYNTHETIC STAGING ONLY: documented human L1 enrollment confirmation.'
);
```

Capture returned H0. Only L1, once per binding. The private function records the scope's human/episode/approval reference but does not authenticate a written signature itself. Operator verification is mandatory. Browser/authenticated invocation fails. Migration initializes nobody. Mistaken initial history needs governance escalation, not overwrite/re-initialization.

## 4. End-to-end hosted acceptance script

All steps start **BLOCKED** until executed. Log run ID, project, deployed commit, alias/operator, UTC time, exact record IDs/revisions, sanitized request/result/error, expected vs actual and artifact location. No passwords/JWTs/raw conversations/real customer data. Empty authorized data differs from unavailable/denied; admin SQL is not a browser PASS.

Use the actual individual JWT in an approved HTTP client for direct checks: `POST <STAGING_URL>/rest/v1/rpc/<name>`, `apikey:<publishable key>`, `Authorization: Bearer <individual JWT>`, JSON body. Keep tokens in secret/session memory, never shell arguments or committed files. Never use service-role credentials for isolation checks. New publication → fresh UUID; retry → identical UUID/body. Substitute actual IDs, revisions and valid non-future dates in examples.

| Step / actor | Script action | Expected / capture |
|---|---|---|
| 1 / A then B | Individual login/confirmation/recovery; written exercise at `/training`; typed simulation and approved voice practice. Account context may show another assigned rep. | Server-derived binding attribution. Capture A written W, simulation attempt T/session S; B WB/TB/SB. Dealer rep is not learner proof. |
| 2 / A | Refresh, logout/login, new browser/device; inspect **My saved practice**. Separately refresh an in-progress session. | Same durable W/T/S; interrupted occurrence remains in_progress/unscored. Self-history shows latest 50, not all-time aggregate. |
| 3 / M, C | `/reviewer-history`, **Assigned Learner History**, exact A episode. | A only; written/simulation, scenario, timestamps, status, exact revisions and unreviewed AI label. Capture actual terminal revisions (normally 2). |
| 4 / C | Publish completed coaching from W/T/S with exact revisions and required narrative/targets. | K1 revision 1; authenticated coach/episode. M can read through its own scope. |
| 5 / A | `/my-coaching`, acknowledge K1 and optionally comment. | Separate response R1 tied to K1 revision; coach fields unchanged. Receipt is not agreement. |
| 6 / C or M | Explicit human C01 finding from current practice or matching coaching target/version. | E01 revision 1. No copied AI/coaching text. Reviewer actually observes/reviews permissible evidence. |
| 7 / M | Review E01; explicitly choose B2 for the pre-agreed synthetic case and rationale. Create a separate defer fixture. | Q01 revision 1; no preselected outcome/averaging. Defer assigns no band. |
| 8 / V/operator | Validate written synthetic L1 approval and initialize as above. | H0 initial_confirmation/L1, not advancement; no browser initialization. |
| 9 / M | Explicit remain_L1 then defer_insufficient_evidence with plans. Prepare synthetic full-domain packet Q01–Q15 through human-reviewed observations/bands for each C01–C15. | Remain/defer create no history event and retain H0. No fabricated real competency claims. |
| 10 / M | Explicit advance_L1_to_L2, current Q01–Q15 revisions, expected H0, rationale and human framework confirmation. | P_ADV plus one atomic H1/L2 advancement linked to H0/P_ADV. Identical retry has no duplicate. |
| 11 / A, M, C | Refresh/new session; read progression reviews and official history, corrections and older pages. | Rationale, reviewer, refs, timestamps, plan and immutable H0/H1 visible only in scope. No learner writes or legacy score-derived level. |

**Synthetic tests validate plumbing, not real proficiency/KPIs.** Practice stores occurrences and learner-submitted unreviewed score projections, not replayable assessed artifacts. Do not invent observations from a durable score after losing source access. Use pre-agreed live-observed synthetic roleplay and concise human observations. Real pilot source admissibility, meaningful evidence access, work transfer and independent approvals are gates. The app does not enforce all minima, two-human approvals, freshness or L5 specialties: all-domain coverage/checkbox are not substitutes. `real_world_work` publication is disabled pending a governed source. Keep advancement testing synthetic/segregated until those gaps are responsibly resolved.

### Exact payload examples

Each publish wraps the body as `{"p_id":"<new UUID>","p_scope":"<active author's A scope>","p_body":{...}}`.

Coaching (`publish_coaching_session`):

```json
{"occurred_at":"<ISO time>","targets":["C01"],"evidence":[{"kind":"attempt","id":"<W>","revision":2}],"observed_behavior":"Synthetic observed clarifying question.","strengths":"Checked the need.","development_opportunity":"Allow response time.","next_action":"Repeat supported practice.","follow_up_on":"","progress_status":"follow_up_pending"}
```

Acknowledgment (`respond_to_coaching`, no publish wrapper): `{"p_id":"<new response UUID>","p_session":"<K1>","p_ack":true,"p_comment":"Synthetic receipt; consider limited opportunity."}`.

Competency (`publish_competency_evidence`):

```json
{"competency_version":"orion-sales/0.1-draft","competency_code":"C01","source_type":"human_coaching","evidence":{"kind":"coaching","id":"<K1>","revision":1},"observed_behavior":"Synthetic behavior reviewed by this author.","finding":"supports","evidence_date":"<YYYY-MM-DD>"}
```

Practice alternative uses `source_type:"ai_practice"` with `{kind:"attempt",id:"<W>",revision:2}` or `{kind:"simulation",id:"<S>",revision:2}`. Written exercises have no valid AI competency score; this names practice context. Other findings: does_not_yet_support, insufficient_opportunity, technical_failure, disputed. Failed/abandoned practice rejects supports/does_not_yet_support.

Band (`publish_competency_band_review`):

```json
{"competency_version":"orion-sales/0.1-draft","competency_code":"C01","outcome":"B2","evidence":[{"id":"<E01>","revision":1}],"rationale":"SYNTHETIC STAGING ONLY: explicit human review of scripted C01 anchors.","reviewed_at":"<ISO time>"}
```

Progression (`publish_progression_review`), remain body:

```json
{"framework_version":"orion-sales/0.1-draft","competency_version":"orion-sales/0.1-draft","expected_history_id":"<H0>","outcome":"remain_L1","bands":[],"supporting_evidence":[],"rationale":"Synthetic baseline review.","development_plan":"Arrange observed practice.","framework_requirements_confirmed":false,"reviewed_at":"<ISO time>"}
```

To defer, explicitly choose `defer_insufficient_evidence`. To advance, explicitly choose `advance_L1_to_L2`, refresh expected history, supply **all actual** Q01–Q15 `{id,revision}` entries, true human framework confirmation and rationale. Optional support accepts human competency evidence refs only, never raw practice/coaching IDs or arbitrary URLs. No automatic selection.

Corrections use new UUID, current refs, `supersedes_id` and required `correction_reason`, retaining other required fields. Original scoped author only. Coaching/evidence/band target latest version; band retains competency/version. Progression targets only latest episode decision, retains its original baseline, but expected_history_id must match current head. See the six layer-specific deployment documents for full constraints.

## 5. Negative/security acceptance — hosted results BLOCKED

| Test | Action | Expected |
|---|---|---|
| A vs B | A JWT GET `/rest/v1/learner_training_attempts?id=eq.<TB>&select=id`; equivalent session SB; try finish TB. Repeat B→A. | No foreign rows; mutation rejected; own records remain readable. |
| Outside/anonymous | X JWT calls each scoped reader/publisher with real M_A_SCOPE and A IDs; repeat with no JWT. | Denied publication/selected-scope reads. Null-scope reviewer listing has no active X grants. |
| Reviewer not learner | M directly queries A's public attempts/sessions and tries finish W. | No foreign rows; finish denied; scope grants no practice impersonation. |
| Revoked | V revokes M while M stays signed in; retry all readers/publishers and older-page cursors with same JWT. | Future calls denied; refresh/focus/poll clears unavailable results. Restore only by new scope. |
| Expired | X uses its separate expired scope and still-valid JWT. | Read/write denied independent of browser clock/token expiry. |
| Wrong episode | C coaching references WB/SB under C_A_SCOPE. For downstream checks, create genuine B evidence/band fixtures under a separately approved temporary C→B scope after baseline isolation tests; revoke it afterward. Use those B IDs under C_A_SCOPE. | Every layer rejects mismatched episode; no reassignment. |
| Stale revision | Submit W revision 1 instead of terminal 2; incorrect E/Q revision in downstream write. | Rejected even when UUID exists. |
| Superseded | Publish K1→K2, E01→E02, Q01→Q02 corrections in turn; new downstream request references each old immediate source. | Rejected. Existing downstream record preserves snapshot and flags corrected immediate source; no automatic lower band/level. |
| Private tables | Real JWT REST request with `Accept-Profile: learner_coaching` and each private schema; effective-grant audit above; controlled SQL role test SELECT/INSERT/UPDATE/DELETE private tables. | Schema unexposed, effective privileges false, direct SQL denied. Do not expose schema just to test. |
| No broad writes | A/M direct POST/PATCH/DELETE of the 3 public learner tables; audit policies and sequence/function grants. | Denied; no broad write/reassignment policy. |
| Learner tampering | A tries each coach/reviewer publication with reviewer scope; add coach fields to response RPC. | Denied/invalid arguments. Valid acknowledgment changes only separate receipt/comment, never coach-authored fields. |
| Provider failure | Approved staging network tooling blocks/returns failure or malformed score from practice provider route; finish via UI. Separately refresh mid-session. | Provider failure terminal technical_failure/null score/unscored; interruption in_progress/unscored. Never zero competence. Injected failure is not proof live provider works. |
| Non-scored context | Create technical_failure/disputed/insufficient_opportunity findings; band request with only these refs. | Only defer allowed, no numeric penalty. Progression remain/defer needs plan and adds no advancement. |
| Invalid progression | Missing/empty outcome, advance_L1_to_L3, wrong starting level or missing expected history. | Rejected. UI starts unselected and offers adjacent outcomes only. |
| Correction ledger | Before later decisions, correct latest P_ADV to defer with reason/current head. | Original H1/L2 remains; new correction explicitly restores original L1 baseline. No false advancement/automatic discipline. Later decisions block older corrections. |
| Legacy quarantine | Seed labeled synthetic values in `simulatorResults` and `sales-simulator-orion-training-results-v1`; sign in/complete new work. | Values unchanged, never attributed or used for new bands/levels. |

Pagination: scoped practice uses started_at+UUID; coaching/evidence/band use created_at+UUID. Progression uses returned text sequence_no. If approved, create >50 synthetic fixtures in isolated staging and verify page continuity/no duplicate display (51st row is sentinel). Retry older cursors after revocation. No real employee data needed.

## 6. Synthetic rehire — after original-episode checks

Record A_EP1/A_BIND1 and old scope/coaching/evidence/band/history UUIDs. Leave old M/C historical scopes active initially to prove they do not transfer. Privileged staging transaction:

```sql
begin;
update public.learner_bindings
set revoked_at=now(),revoked_by='<V_AUTH>'::uuid,revocation_reason='Synthetic rehire test'
where id='<A_BIND1>'::uuid and revoked_at is null;
insert into public.learner_bindings
(auth_user_id,person_id,employment_episode_id,organization_scope,role_scope_ref,
 source_environment,source_project,identity_source_ref,employment_source_ref,verified_by,
 verification_evidence_ref,supersedes_id)
values ('<A_AUTH>'::uuid,'<A_PERSON>'::uuid,'<new-A_EP2>'::uuid,'<test-org>','<role-ref>',
 '<actual-staging-environment>','<actual-project-ref>','<same-verified-person-ref>',
 '<new-synthetic-employment-ref>','<V_AUTH>'::uuid,'<rehire-verification-ref>','<A_BIND1>'::uuid)
returning id; -- capture A_BIND2
commit;
```

1. A refreshes/signs in: no inherited coaching, competency bands or progression reviews; official level unavailable, never inherited L2/L5 or implicit L1. New practice derives same A_PERSON + new A_EP2. Own binding audit row may remain visible; retired learner content history does not.
2. Old M/C scopes read only explicitly authorized retired A_EP1; no A_EP2 records or new-episode rights. They cannot publish/correct on retired binding (`can_create:false`). Historical read retention is intentional, not transferred access.
3. Explicitly approve a new C/M scope for A_BIND2. Try old W/K/E/Q refs in new publications: reject. A cannot respond to old K1. New scope creates neither bands nor L-level. A new L1 requires its own written confirmation/private initialization.
4. Capture new episode fixtures to prove distinct IDs/history. Revoke old historical scopes when their approved purpose ends. Do not delete records or restore a retired binding.

## 7. Hosted concurrency/stale-state checks

Approved staging only; short transactions and separate authenticated clients. Log commit order, IDs and sanitized results. Any deadlock/serialization error must roll back the entire request. PGlite did not validate these interleavings.

For held transactions, an approved administrator may use a dedicated SQL session with `BEGIN; SET LOCAL ROLE authenticated;` and `select set_config('request.jwt.claim.sub','<verified reviewer UUID>',true);` before the relevant RPC. This is **SQL-role simulation, not proof of real-JWT authentication**. Use actual individual JWT REST for the other connection. Never enable client access to privileged SQL tooling.

| Case | Session 1 | Session 2 / result |
|---|---|---|
| Revocation first | Privileged transaction updates scope revocation, holds row lock. | JWT publication may wait. Commit revocation: publication denied, no review/event. Repeat binding revocation. |
| Publication first | Reviewer-role transaction publishes valid decision, holds locks. | Scope revocation waits. Commit publication then revocation: exactly that earlier authorized decision remains; subsequent JWT reads/writes denied. |
| Source correction first | Original-author transaction publishes K/E/Q correction, holds transaction. | Downstream request on old immediate source waits/fails. Commit correction: downstream must reject stale source or roll back, never succeed from an already superseded source. |
| Downstream first | Downstream publication transaction holds source locks. | Source correction waits or a conflicting transaction aborts. Commit downstream then correction: historical decision retained, successor flagged; no automatic penalty. |
| Two progressions | Two real reviewer clients read H0; prepare distinct UUIDs and explicit L1→L2 with expected H0. Send concurrently. | One advancement succeeds; other rejects changed history or rolls back retryable conflict. Exactly one H0 successor, no duplicate/L3. Successful identical retry returns same receipt. |

Use fresh valid fixtures/scopes per case. Restore revoked access by new approved scope, never clearing revocation. These tests must never target real learners. A completed authorized request before revocation remains legitimate history.

## 8. Non-destructive rollback

IT owns the approved **staging** rollback; production remains outside scope. Stop pilot UI/server route access first; do not restore insecure legacy browser authentication. Revoke affected reviewer scopes with actor/time/reason. Revoke learner bindings too if own practice/provider access must stop. Preserve evidence logs and all immutable history.

Complete feature shutdown: revoke authenticated EXECUTE on all 12 named public RPC signatures in section 2 **and** their granted private implementations:

- `learner_review.read_history(uuid,timestamptz,uuid)`
- `learner_coaching.publish(uuid,uuid,jsonb)`, `respond(uuid,uuid,boolean,text)`, `read_sessions(uuid,timestamptz,uuid)`
- `learner_competency.publish(uuid,uuid,jsonb)`, `read_evidence(uuid,timestamptz,uuid)`
- `learner_band.publish(uuid,uuid,jsonb)`, `read_reviews(uuid,timestamptz,uuid)`
- `learner_progression.publish(uuid,uuid,jsonb)`, `read_reviews(uuid,bigint)`

Use each function's qualified schema and exact migration signature; no blanket unrelated-schema changes. Example:

```sql
revoke execute on function public.publish_progression_review(uuid,uuid,jsonb),
 learner_progression.publish(uuid,uuid,jsonb) from public,anon,authenticated;
```

Repeat for the complete approved list. For full read shutdown, revoke authenticated SELECT on the 3 public learner tables too. Keep private initialization/internal helpers ungranted. Test with still-valid JWTs: UI removal alone is insufficient. Save pre-change ACLs and approval record for controlled restoration of only reviewed privileges/new scopes/bindings. Never clear immutable revocations, DROP/TRUNCATE/delete populated tables, reset the project as normal rollback, rewrite decisions or remove migration history. Retention/erasure exceptions require a separate approved process.

## 9. Readiness matrix — final disposition

PASS means actually verified locally/repository fact; BLOCKED means required hosted work not run/missing prerequisite; DEFERRED means deliberately outside this task; HUMAN DECISION requires named-owner approval. Documenting a script does not make its hosted result PASS.

| CHECK | STATUS | OWNER | BLOCKER / DECISION |
|---|---|---|---|
| Six merged PRs, ordered migrations | PASS | Engineering | Baseline/merge history verified; all six applied by local suite |
| Local six-layer regression suite | PASS | Engineering | 69 tests on 2026-09-05; PGlite, not hosted Auth |
| Production build | PASS | Engineering | Passed; existing large-bundle warning |
| Production untouched by this task | PASS | Engineering | No hosted deployment/API/provisioning calls; documentation-only change |
| Named staging project/region/operator/isolation | BLOCKED | IT | No approved target/session supplied or selected |
| Individual Auth/confirmation/recovery/signed JWT | BLOCKED | IT / identity steward | Six accounts and hosted execution required |
| Frontend/server matching, provider/audio | BLOCKED | IT / QA | Approved staging runtime/configuration and synthetic execution required |
| Hosted migration history, exposure, grants, Advisor | BLOCKED | IT / security | Execute audit and resolve unexpected findings |
| Binding/episode/scope/expiry and written L1 approval | BLOCKED | Steward / approver | Execute approved provisioning, capture refs |
| Full hosted UI/API and new-session durability | BLOCKED | QA / M / C | Execute steps 1–11, not substitute admin SQL results |
| Hosted negatives and private access | BLOCKED | QA / security | Real-JWT section 5 checks required |
| Synthetic rehire | BLOCKED | QA / steward | Execute section 6; local equivalent passed only |
| Hosted concurrency/stale state | BLOCKED | IT / QA | Execute section 7; inspect resulting official history |
| Rollback rehearsal | BLOCKED | IT / QA | Execute shutdown and still-valid-JWT retest |
| Scope publication authority / initial approvals | HUMAN DECISION | Leadership / HR / training | Scope labels do not enforce separate later-write rights; approve people/procedures |
| Draft minima, independent approvals, specialties | HUMAN DECISION | Leadership / HR / training | Human requirements not enforced by coverage/checkbox need approved process |
| Independently reviewable evidence for real pilot | BLOCKED | Training / privacy / product | Occurrence/AI score alone insufficient; real-world validator unavailable; approve genuine evidence access/process before real decisions |
| Retention, notice, provider consent, corrections | HUMAN DECISION | HR / privacy / IT | Initial-record errors, original-author absence and dependent-review appeals require handling |
| Synthetic-only staging vs real pilot go/no-go | HUMAN DECISION | Sponsor / IT / QA | No real pilot until applicable blockers pass with artifacts and decisions signed |
| Higher-level direct placement / broader appeals | DEFERRED | Product / leadership | Adjacent progression/latest-decision correction only |
| Production rollout, enterprise integrations, compensation, dashboards/ranking/actions | DEFERRED | Sponsor / IT | Explicitly excluded; this runbook authorizes none |
