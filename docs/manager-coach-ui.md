# Manager / coach workflow UI — Issue #26

The reviewer page now starts with an approved learner/episode selection, a selected-learner summary, official level from governed history, four prominent next-action buttons, and a five-stage workflow strip. Practice, coaching, evidence, bands and progression use separate cards with the most recent unsuperseded record on the loaded page emphasized. Other records remain accessible through View history and existing page controls. This is a presentation change, not an aggregate competency profile or automatic advancement workflow.

## Identification and state boundaries

The governed scope response has organization and role context but no verified display name. The UI therefore uses numbered Learner / Episode aliases derived from the authorized list, not invented names, emails or rep assignments. These aliases can renumber when the authorized list changes; they are navigation labels, not durable identifiers. Exact person, binding, employment-episode and scope IDs remain in collapsed Technical details. A future stable human-readable label requires a separately approved data-contract decision.

The existing verified auth context owns the authenticated user. A keyed auth boundary clears the workspace on user changes, and an Auth event hides it immediately while that context catches up. Each selected scope creates a new keyed episode subtree, dropping old drafts, cursors, snapshots and in-flight UI results. Async reads ignore results after unmount. Same-episode revalidation keeps the last successful snapshot and draft mounted and visible; background status announcements do not change layout. A failed/denied response replaces the snapshot and hides affected content. Thirty-second and window-focus revalidation continue unchanged, and typing does not trigger reads. Focus on form mount uses preventScroll; only an explicit action scrolls to its section. Drafts remain in memory and are discarded on account/episode changes, Cancel, or successful publication. The existing server authorization remains decisive; client labels, snapshots and buttons do not grant access.

## Actions, forms and evidence

Record Coaching, Record Competency Evidence, Review Competency and Review Progression are buttons; availability uses the existing per-section can_create response. Actions scroll to and focus a distinct form card. Native labels, visible borders, required cues, checkbox states, focus rings and textual badges support keyboard use. Technical/history disclosures are closed by default. No raw identifier is needed to choose evidence already available through the governed read RPCs.

The shared evidence picker pages through existing authorized practice/coaching/evidence/band read RPCs. It excludes in-progress practice and superseded reviewed records; band sources filter to the selected competency and existing version. Selected entries preserve their exact IDs/revisions across source pagination. Corrections may retain previously selected references; unavailable or stale references are never silently replaced. The server still validates currency, episode, version, eligibility and reference limits at publication. Technical failure/disputed/insufficient opportunity remain explicit non-scored context; they are not treated as low bands. No outcome is automatically selected by the new picker.

Publication uses the existing payloads, request IDs, retry behavior, correction lineage and immutable record semantics. No migrations, RLS, auth rules, scoring, provisioning, competency/progression rules, or integrations changed. Learner acknowledgment/comment writes remain unchanged. Summaries are page-based, not complete coverage claims. Missing/unavailable level or activity is not presented as zero or advancement.

## Verification

- Existing `npm run test:learner`: 69 passed (learner, reviewer, coaching, competency evidence, bands and progression).
- Existing `npm run test:realtime`: 19 passed; `npm run test:conversation`: 8 passed.
- `npm run test:review-ui`: 7 browser tests passed using installed Microsoft Edge and synthetic local data. Covers account change, delayed episode switch, single-episode rendering, action/focus behavior, default collapsed details/history, mobile overflow, exact competency/band/progression evidence packets, and draft preservation across access refresh.
- `npm run build`: passed; existing large-bundle warning remains. Focused ESLint on changed production UI modules passed.
- Desktop, mobile and coaching-form screenshots were visually inspected. No hosted data, credentials or live Supabase writes were used.

The browser suite uses a dedicated Vite configuration under tests/reviewer-ui that aliases only the auth/client modules to fixtures. It is not the production configuration and the fixture is prominently marked synthetic. Run `npm run test:review-ui` with Microsoft Edge installed; another supported installed channel can be selected through REVIEW_TEST_BROWSER (for example chrome). Test artifacts are ignored by Git. The fixtures do not test database authorization; the existing database tests remain the security verification.

## Human staging review still required

With individually verified staging accounts, confirm that managers can identify the selected episode and next action immediately, complete each review using real authorized evidence pages, and understand deferred/failure/correction states. Include a rehire with two episodes, access revocation, an interrupted publication/retry, keyboard-only use, and a small screen. Confirm the numbered-label convention is acceptable until an approved human-friendly identifier exists. Validate readability with realistically long observations and many history pages. These hosted usability checks were not executed here; no deployment was performed.

### Coaching scroll regression

The old workspace collapsed its content during every background access check, shortening the document and dropping active-field focus. A browser regression reproduces the focus loss with the original workspace. With the fix, delayed timer/window-focus reads preserve the same form DOM, all coaching fields, targets, exact evidence selections, scroll position and focus. The 13 browser tests also cover failed-access hiding, account/episode clearing, Cancel and successful publication. The 69 learner/governance tests, build and focused lint pass. These are local synthetic browser/database checks; hosted staging verification remains a human step. No deployment or authorization/RPC/schema changes.
