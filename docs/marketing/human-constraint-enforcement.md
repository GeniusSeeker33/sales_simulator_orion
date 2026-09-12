# Structured human constraint enforcement

Freeform review notes remain human evidence; this layer adds explicit rules without extracting them with a model. The human can enter prohibited phrases and toggle no fabricated testimonials, no unverified comparative claims, and no unverified business-outcome claims when requesting changes. Draft/requested-change assets also expose a governed constraint editor. Existing campaign requirements remain separate in model context.

## Immutable scope and authority

Migration `20260912213640_marketing_human_constraints.sql` adds `marketing.human_constraint_sets`. Each immutable set records workspace, campaign, asset, applicable orchestration, creating human, asset revision, source human review decision when available, timestamp, and a superseded-set link. Its structured rules carry stable IDs, type, value, optional rationale, and supported details. Unchanged rules retain IDs across replacement sets. The active set is derived from the absence of a successor; no mutable satisfied/active flags exist. Empty replacement sets explicitly retire prior rules while preserving their history.

Rules apply to the same asset and its orchestration revision path. They are not inherited by unrelated tasks/campaigns or newly assigned work with a different resulting asset. A unique root per asset and unique supersession links prevent branching versions. Asset locks and expected asset/set IDs prevent stale overwrites.

Contributors, approvers and admins may add/supersede constraints on unpublished draft/requested-change assets. Only approvers/admins may record the formal human `changes_requested` decision. Its optional constraint update is atomic with that existing workflow event; a rejected rule update rolls back the decision too. Identity comes from `auth.uid()`. Viewers and service-role/agent callers cannot invoke the human constraint setter or write the table. The browser cannot provide rule IDs, human identity, evidence-verification flags or satisfied state.

## Deterministic contract v1

The PostgreSQL evaluator is authoritative for Creator finalization, Guardian finalization, workspace attention reads, and the shared asset submission/approval pathway. Browser calls to older human RPCs cannot bypass it. Incoming model/API preflight results are replaced by database-computed constraint checks.

| Type | Deterministic behavior |
| --- | --- |
| `prohibited_phrase` | Whole normalized phrase blocks when present. |
| `prohibited_claim` | Same literal check; absence requires semantic review of equivalent assertions. |
| `required_phrase_or_concept` | Phrase mode requires the normalized phrase. Explicit `details.mode = concept` treats absence as semantic review rather than claiming semantic certainty. |
| `required_destination` | Exact hostname matching, using the same bounded URL/hostname extraction and credential rejection as Guardian QA v2. The stored value must be a hostname. |
| `no_fabricated_testimonial` | Blocks obvious testimonial markers or a quoted endorsement attributed to a dealer/customer. Otherwise requests semantic review. |
| `no_unverified_comparative_claim` | Blocks the narrow comparative lexicon below. Otherwise requests semantic review. |
| `no_unverified_outcome_claim` | Blocks the narrow outcome lexicon below. Otherwise requests semantic review. |

Phrase normalization lowercases, collapses repeated whitespace and punctuation into spaces, and checks word boundaries. It does not use stemming, edit distance, fuzzy matching or semantic similarity. Matches expose the rule ID, matched normalized phrase, one-based **normalized text position**, and a surrounding normalized excerpt. These positions are intentionally not original-source character offsets.

Initial comparative lexicon: **competitive, best, leading, leader, superior**.

Initial business-outcome lexicon: **grow your business, success, increase sales, improve profit, outperform, win**.

Initial testimonial markers: **testimonial, testimonials, customer says, dealer says, satisfied dealer**, plus a bounded quoted statement followed by dash attribution to a dealer/customer. This release provides no approved testimonial evidence-linking facility and never invents such evidence. These intentionally narrow rules may require human semantic review outside the listed constructs. A lexicon pass does not certify that a claim is factual or supported. Required destination tests reject misleading suffix hosts and credential-bearing URLs.

The API supports all seven types; the compact editor focuses on prohibited phrases and the three requested toggles and preserves other existing rule types. At most 30 rules are stored per set, with bounded values/rationales. No arbitrary regex patterns or browser-provided evidence exceptions are accepted.

## Agent execution and human gates

Run insertion snapshots active constraint sets, flattened rules, current constraint preflight, Creator preflight where applicable, and the latest three human change requests for that asset. Creator and Guardian receive these fields separately from freeform instructions. Prompt instructions version `human constraints v1` makes rules mandatory, prohibits equivalent unsupported paraphrases, and directs Creator to omit uncertain claims. Guardian evaluates every supplied rule ID exactly once as `satisfied`, `violated`, or `semantic_review` with a detail.

Creator output that violates a rule remains an attributable saved draft and succeeded evidence run. Its deterministic failures are persisted in run QA and orchestration preflight. Orchestration stops at `changes_needed` before creating a Guardian run. At the third revision cycle it becomes blocked. The human can send the failures back to Creator, inspect manually or stop; no revision cycle or model call is initiated automatically.

Guardian receives the exact current asset and both structured constraints and preflight evidence. The server validates evaluation coverage; the database independently verifies rule IDs and overrides contradictory satisfaction/readiness when a deterministic check fails. Any violated evaluation requires `needs_changes`. Clean deterministic results plus informational/semantic findings can remain `ready_for_human_review`; they never constitute approval.

Run completion locks the asset and compares active constraint-set snapshots with those used for inference. Constraint edits/supersession during a model call reject the stale result without partial asset mutation. Existing task, campaign, asset, permission, cancellation, immutable-run and three-cycle protections remain in force.

The shared private asset writer checks active rules on **both submission and approval**, including direct human RPCs and agent submission requests. To change an enforced rule, an authorized human must explicitly supersede the constraint set; neither the model nor browser can mark a failed rule satisfied.

## Attention and audit display

Current checks produce red `Human action required` for blocking failures and yellow semantic-review signals when no blocker exists. Matching asset/orchestration/revision alerts are deduplicated against existing approval or task gates. Current checks are recomputed for newer revisions; a clean revision supersedes old constraint failures without erasing prior run/preflight history. Independent stale-orchestration or unresolved Guardian evidence remains conservative rather than inferring a resolution from unrelated changes.

Asset review shows active rules, exact failure evidence and immutable supersession history. Task execution shows active rules/current preflight, and timeline details preserve earlier preflight snapshots. Agents displays dedicated Guardian constraint evaluations alongside the original result. All severity messages use text as well as color. Human approval remains a separate decision, and approved assets do not acquire new yellow semantic-review attention merely because bounded checks cannot prove semantics.

## Validation and rollout

The hosted-failure regression saves a Creator revision containing `competitive wholesale firearms` under both a prohibited phrase and comparative-claim rule. It verifies succeeded Creator evidence, two preflight failures, no Guardian advancement, red attention, exact rule/match evidence and a later clean human-authorized revision. PostgreSQL tests cover normalization, all lexicons, testimonial constructs, destination safety, semantic mode, contradictory Guardian readiness, immutable/superseded sets, stale inference, authority and workspace isolation. Browser coverage captures rules during human review and follows failed preflight through a clean revision and separate approval.

Apply the local migration separately before enabling the updated model contract/UI. Existing agents and orchestration APIs retain their public signatures; legacy implementations moved behind revoked private wrappers. No hosted migration, hosted data change, deployment, live model call, new external service, publishing or background automation was performed.
