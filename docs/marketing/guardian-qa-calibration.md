# Guardian CTA and recommendation calibration

The hosted false positive came from `cta_present`: it required the full campaign CTA as a literal substring and the server converted any failed deterministic check to `needs_changes`. Thus “Apply to become an Orion Wholesale dealer at Join-Orion.com.” failed against “Take the first step by applying at Join-Orion.com to begin the dealer qualification process.” despite equivalent destination and action wording.

## Objective checks, with bounded scope

`api/_lib/marketing-guardian-qa.js` replaces that check with:

- **Destination:** extract campaign destination hostnames and require their presence in the asset. Match complete hostnames, case-insensitively, allowing `www.` and ordinary trailing punctuation. A trusted name embedded in another host, URL credentials or an unrelated URL path does not pass. These checks verify host presence, not DNS reachability, URL path/query correctness or the meaning of surrounding prose.
- **Action:** look for a bounded list of action verbs and explicit inflections: apply/applying, join/joining, register/sign up, learn more/find out more/discover, contact/call/email/reach out, book/schedule/reserve, visit/explore/browse, buy/shop/order/purchase, download and subscribe. Domain names and URL paths do not count as actionable prose. When the campaign has recognizable action intent and the asset has none, this is a blocking failure.
- **Intent:** matching recognized action wording passes lexical intent presence. A different or unrecognized intent requires human semantic review rather than fuzzy matching or an automatic blocking mismatch. If the campaign has no recognizable destination, destination interpretation also requires human review.

Review-required checks have `passed: true` because they identify no objectively established defect, plus `review_required: true` and an explicit explanation. The UI labels them **Human semantic review**, not an ordinary pass. When no model findings exist, the server adds one informational CTA review finding so existing attention projection shows yellow. This is not a claim of semantic equivalence. Guardian's substantive review and the human must still assess negation, suitability, materially wrong intent, unsupported claims, explicit constraints and unresolved requested changes.

Existing non-CTA deterministic rules remain: content, supported asset type, defined audience/channel and unresolved placeholders. Any actual deterministic failure forces `needs_changes`.

## Structured findings and consistency

Each newly generated Guardian finding must include boolean `requires_correction`. Set it true for a concrete issue requiring correction before approval, such as unsupported/materially misleading comparative or commercial claims, missing/materially incorrect CTA, audience/channel mismatch, placeholders, unresolved requested changes or an explicit constraint violation. These must be warning or blocker severity. An optional warning can remain advisory (`requires_correction: false`). Informational findings cannot require correction, and blockers must require it; inconsistent severity/flag combinations are rejected as invalid structured output.

After strict contract validation and deterministic QA, the server **normalizes** the recommendation:

`needs_changes` iff a deterministic check failed or at least one warning/blocker requires correction; otherwise `ready_for_human_review`.

This handles contradictions in both directions: informational-only `needs_changes` becomes readiness, while readiness with an actual blocker becomes `needs_changes`. No free-text fuzzy classifier tries to decide whether a finding is substantive; the model must make that structured distinction under explicit server instructions. Unsupported claim assessment remains a semantic responsibility, not an invented regex guarantee.

`ready_for_human_review` only means Guardian found no blocking issue. It never updates asset approval, records a human decision or publishes. The database-backed regression verifies that the hosted wording example persists readiness with advisory findings while its asset remains `in_review` and unapproved until an authorized human approves it.

## Storage, attention and compatibility

No database migration is needed. The existing JSON output and deterministic-QA arrays store the new flag, review hints and `guardian-qa-v2` identifier. The server prompt includes this QA version; `marketing-v2` remains the unchanged database run protocol. No actor permissions, private write grants or human approval controls change.

Existing attention projection already produces red for `needs_changes`/failed QA, yellow for readiness with findings, and a separate red gate for assets awaiting human approval. Human decisions and newer saved revisions supersede old Guardian attention as before. Historical runs are not rewritten or silently reinterpreted: merely rerunning QA on the same content does not dismiss a historical finding under the existing conservative rules.

Tests cover the supplied hosted example, missing/spoofed hosts, actionless copy, semantic uncertainty, unsupported comparative findings, placeholders, informational/advisory-only findings, contradictions, true deterministic failures, attention and separate human approval. Validation uses local SQL and mocked inference; no hosted data, live inference, deployment or external service is modified.
