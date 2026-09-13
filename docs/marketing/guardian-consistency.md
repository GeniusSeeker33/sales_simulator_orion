# Guardian review consistency

Guardian output is advisory evidence. A contradictory review must not authorize another Creator cycle.

## Acceptance boundary

Both authenticated server handlers share `inferMarketing`. After strict JSON and effective constraint ID coverage validation, and before recommendation calibration, `guardianInconsistencies` checks public assessment evidence. Existing Guardian fields remain unchanged. Versioned instructions ask each ID-linked evaluation detail and constraint-specific finding to start with `Assessment: satisfied.`, `Assessment: violated.`, or `Assessment: semantic_review.` Findings about a constraint use its literal `[constraint_id]` prefix.

The validator recognizes:

- Opposite satisfied/violated assertions for the same constraint ID.
- A short, unqualified satisfaction assertion inside that ID's detail.
- An unlinked satisfaction finding naming exactly one matching prohibition, such as “No unverified comparative claims”. No synonym expansion or ambiguous multi-rule matching is used.
- An explicit “All constraints are satisfied” summary against a violation.
- `needs_changes` without a violated constraint or substantive correction finding, or readiness despite corrective evidence.

Borderline prose, semantic_review, unrelated findings, and ambiguous rule names are not treated as contradictions. This is deliberately not a general natural-language entailment classifier; unsupported phrasings can be missed. Consistent violations still produce needs_changes. Deterministic failures take precedence and remain blocking policy evidence.

## Persistence and authority

The trusted server passes a bounded envelope containing the original validated result, safe contradiction descriptions and validator version. Only service_role can invoke completion. The migration records the failed run, diagnostic and immutable `marketing.guardian_consistency_evidence` in one transaction, with no asset mutation. Browser roles cannot read or write that table or call private helpers. Authorized read projections expose only contradiction descriptions and safe diagnostic codes, not prompts or hidden reasoning.

The outcome is a failed Guardian run with safe diagnostic `guardian_semantic_structured_mismatch`. PR #34's retry authorization path remains unchanged: verified human writer, exact asset/task/campaign revisions, unchanged effective policy, locked workflow, one attributable Guardian run, no Creator call and no cycle increment. Duplicate requests and late predecessor callbacks remain idempotent. A server command guard additionally rejects content revision and review decisions against the unresolved inconsistent run.

## Presentation

Current deterministic checks remain CHECK completed; REVIEW uses a warning icon and “Guardian review inconsistent”. Human attention is critical with reason “Guardian review issue”. Guided Work offers Retry Guardian when the server permits it and Inspect Guardian details. If context is stale, the server's refresh reason is shown instead. Creator revision controls are hidden. Expanded history shows the rule, narrative status, structured status and safe reason; the prior run and its retry link remain immutable.

## Verification

Unit tests cover both contradiction directions, exact-rule fallback and its ambiguity exclusions, genuine violations, advisory semantic review, recommendation support and deterministic precedence. Real PostgreSQL/API tests cover atomic evidence, immutable history, Guardian-only retry at cycle 1/3, unchanged content, duplicate/stale/unauthorized/foreign-workspace rejection and browser RPC denial. Browser tests exercise human feedback, inconsistent review, inspection, deduplicated navigation and a successful retry through final human approval.

Apply the migration through the normal reviewed release process. This PR does not deploy or change hosted data.
