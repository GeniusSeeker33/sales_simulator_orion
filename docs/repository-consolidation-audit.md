# Repository Consolidation Audit

**Status:** planning only — no application code, database schema, deployment configuration, or production data changed.

**Repositories reviewed**

- `GeniusSeeker33/sales_simulator_orion` — current working Orion/Genius Seeker application and staging implementation.
- `GeniusSeeker33/geniusseeker-talent-success-platform` — architecture, governance, reporting, competency, progression, contributor, and integration design repository.

## Recommendation

Use `sales_simulator_orion` as the surviving working product repository because it contains the active application, APIs, staging implementation, auth, learner/coaching/progression features, realtime simulation, Supabase work, and deployment-oriented documentation.

Migrate the authoritative platform architecture and governance assets from `geniusseeker-talent-success-platform` into clearly named documentation/data folders in this repository. Reconcile overlaps rather than copying competing versions. After migration and validation, archive — do not delete — `geniusseeker-talent-success-platform` so its Git history remains available.

A future repository rename to `geniusseeker-platform` or `geniusseeker-talent-success-platform` may be appropriate after consolidation, but rename is explicitly out of scope for the first migration.

## Guiding Rule

Where both repositories cover the same concept:

1. Preserve the broader platform/governance definition from the Talent Success repository.
2. Preserve the implementation-specific and staging-tested behavior from `sales_simulator_orion`.
3. Create one canonical design document plus implementation/deployment notes rather than two competing specifications.
4. Do not replace working schema/code merely because an older conceptual design uses different names.
5. No production migration is implied by moving documentation.

## Migration Map

| Talent Success source | Disposition in surviving repo | Rationale / target |
|---|---|---|
| `docs/architecture.md` | **KEEP / MIGRATE** | Canonical platform architecture. Target `docs/platform/architecture.md`. |
| `docs/vision.md` | **KEEP / MIGRATE** | Product vision. Target `docs/platform/vision.md`. |
| `docs/business-model.md` | **KEEP / MIGRATE** | Business model context. Target `docs/platform/business-model.md`. |
| `docs/roadmap.md` | **MERGE / RECONCILE** | Reconcile with current implementation roadmap and staging status. Target `docs/platform/roadmap.md`. |
| `docs/current-state-audit.md` | **ARCHIVE AS REFERENCE** | Valuable historical audit, but portions are superseded by implemented staging work. Target `docs/history/talent-success-current-state-audit.md`. |
| `docs/core-data-model.md` | **KEEP / MIGRATE** | Canonical conceptual data model. Target `docs/architecture/core-data-model.md`; annotate implementation status rather than rewriting deployed tables. |
| `docs/identity-and-record-inventory.md` | **MERGE / RECONCILE** | Pair with implemented durable learner records/auth work. Target `docs/architecture/identity-and-record-model.md`. |
| `docs/person-employment-crosswalk-design.md` | **KEEP / MIGRATE** | Important for employment episode attribution, retention, grant evidence, and finance reporting. Target `docs/architecture/person-employment-crosswalk.md`. |
| `docs/training-progression-record-design.md` | **MERGE / RECONCILE** | Overlaps heavily with implemented durable learner, coaching, competency, and progression docs. Keep as canonical design; implementation docs remain deployment evidence. Target `docs/training/training-progression-record-model.md`. |
| `data/competency-models/orion-sales-competencies.md` | **KEEP / MIGRATE** | Authoritative versioned competency framework. Target `docs/training/orion-sales-competencies.md` or retain under a canonical `data/` catalog if consumed by code. |
| `data/training-levels/orion-l1-l5.md` | **KEEP / MIGRATE** | Authoritative L1–L5 framework. Target `docs/training/orion-l1-l5.md` or canonical `data/` catalog if code-consumed. |
| `docs/orion-pilot.md` | **MERGE / RETIRE AFTER RECONCILIATION** | Superseded in part by `docs/orion-mvp-staging-pilot-readiness.md`. Preserve unique intent, then point to current pilot runbook. |
| `data/reporting-definitions/orion-executive-dashboard.md` | **KEEP / MIGRATE** | CFO/CEO metric definitions. Target `docs/reporting/orion-executive-dashboard.md` (or canonical `data/reporting-definitions` if machine-consumed). |
| `docs/orion-reporting-and-integration-plan.md` | **KEEP / MIGRATE** | Canonical reporting governance and source-of-truth boundaries. Target `docs/reporting/orion-reporting-and-integration-plan.md`. |
| `integrations/microsoft-business-central/data-contract.md` | **MERGE / RECONCILE** | Existing app already has Business Central APIs. Keep this as governance/data contract and explicitly cross-reference implementation endpoints. Target `docs/integrations/business-central-data-contract.md`. |
| `contributors/operating-model.md` | **KEEP / MIGRATE** | Useful for fractional-team operating model. Target `docs/operating-model/fractional-team-operating-model.md`. |
| `contributors/fractional-team-governance-plan.md` | **KEEP / MIGRATE** | Relevant to fractional trainer/marketing/community roles. Target `docs/operating-model/fractional-team-governance.md`. |
| `contributors/compensation-governance-boundary.md` | **KEEP / MIGRATE WITH REVIEW** | Preserve governance boundary; do not imply approved compensation policy. Target `docs/operating-model/compensation-governance-boundary.md`. |
| `contributors/contribution-framework.md`, `contributors/roles.md`, `contributors/revenue-participation-model.md` | **MERGE / RECONCILE** | Consolidate into one operating-model package; retain explicit status labels where proposals are not approved policy. |
| `legacy-integration/repository-map.md` | **ARCHIVE AS REFERENCE** | Historical migration context only. Target `docs/history/legacy-repository-map.md`. |

## Existing `sales_simulator_orion` Material to Keep as Implementation Evidence

These should not be replaced by conceptual documents; they demonstrate how the platform is actually implemented and tested:

- `docs/durable-learner-records.md`
- `docs/attributable-coaching-sessions.md`
- `docs/competency-evidence-deployment.md`
- `docs/competency-band-review-deployment.md`
- `docs/progression-review-deployment.md`
- `docs/scoped-reviewer-history.md`
- `docs/manager-coach-ui.md`
- `docs/auth-role-provisioning.md`
- `docs/realtime-voice-session.md`
- `docs/dealer-conversation-realism.md`
- `docs/orion-mvp-staging-pilot-readiness.md`

These implementation documents should cross-reference the canonical design files after migration.

## Major Overlap Areas

### 1. Learner identity and employment attribution

**Talent Success:** identity inventory + person/employment crosswalk + core data model.

**Simulator:** durable learner records + auth/role provisioning + scoped reviewer history.

**Action:** make the Talent Success material the canonical identity/governance model; keep simulator docs as implemented behavior and deployment history.

### 2. Training, coaching, competency evidence, and progression

**Talent Success:** conceptual eight-record training/progression model, competency framework, L1–L5 framework.

**Simulator:** working learner records, attributable coaching, competency evidence, B1–B5 review, L1–L5 progression review, manager/coach UI.

**Action:** one canonical model, several implementation/deployment documents. Do not maintain duplicate definitions of B1–B5 or L1–L5.

### 3. Business Central and executive reporting

**Talent Success:** read-only financial authority boundary, data contract, CFO/CEO reporting definitions, retention/time-to-productivity/training-ROI gates.

**Simulator:** actual Business Central API surface and application integration work.

**Action:** preserve BC as financial system of record; treat the migrated contract as the governance specification and the app APIs as implementation. Reconcile any current endpoint behavior that conflicts with the contract before calling the integration production-ready.

### 4. Orion pilot

**Talent Success:** original supervised pilot concept.

**Simulator:** current staging runbook and validated implementation.

**Action:** simulator runbook becomes current operational truth; original pilot document becomes historical/background material where still useful.

## New Canonical Documentation Structure

```text
docs/
  platform/
    vision.md
    architecture.md
    business-model.md
    roadmap.md
  architecture/
    core-data-model.md
    identity-and-record-model.md
    person-employment-crosswalk.md
  training/
    training-progression-record-model.md
    orion-sales-competencies.md
    orion-l1-l5.md
    implementation/
      durable-learner-records.md
      attributable-coaching-sessions.md
      competency-evidence-deployment.md
      competency-band-review-deployment.md
      progression-review-deployment.md
      scoped-reviewer-history.md
  reporting/
    orion-executive-dashboard.md
    orion-reporting-and-integration-plan.md
  integrations/
    business-central-data-contract.md
  orion/
    staging-pilot-readiness.md
    manager-coach-ui.md
    realtime-voice-session.md
    dealer-conversation-realism.md
  operating-model/
    fractional-team-operating-model.md
    fractional-team-governance.md
    compensation-governance-boundary.md
  compliance-funding/
    indiana-employer-training-grant-crosswalk.md
  history/
    talent-success-current-state-audit.md
    legacy-repository-map.md
```

The exact move paths can be adjusted if existing code or links depend on current locations. The first migration should favor low-risk copies + cross-references over large path moves.

## Indiana Employer Training Grant / Funding Workstream

Create a dedicated compliance/funding area rather than embedding grant assumptions into core training logic. The next document should be an Indiana Employer Training Grant requirements crosswalk with columns for:

- program requirement / evidence needed
- current official rule/source/date checked
- Genius Seeker canonical record/field
- Orion source system if external
- responsible owner
- evidence retention requirement
- current status: covered / partial / gap
- implementation action

Do not label the platform grant-compliant until the current Indiana program requirements have been verified against official sources and all gaps are closed.

## Proposed Migration Sequence

### Phase 0 — Freeze the boundary

- Treat `sales_simulator_orion` as the surviving implementation repository.
- Do not rename the repo yet.
- No production schema/data changes.
- Do not archive the Talent Success repo yet.

### Phase 1 — Copy unique platform assets

Copy unique architecture, reporting, integration-contract, competency, progression-framework, and operating-model documents into the canonical structure. Preserve source provenance in each migrated file.

### Phase 2 — Reconcile overlaps

For identity, training records, progression, pilot, and BC reporting, create canonical documents that distinguish:

- design requirement
- currently implemented behavior
- staging-validated behavior
- unresolved gap / leadership decision

### Phase 3 — Repair references

Update README and documentation links so there is one obvious entry point. Add a repository map showing canonical vs implementation documents.

### Phase 4 — Validate

Run tests/build/lint. Confirm no production env/config changes. Verify staging behavior unchanged. Review BC boundary and progression rules for semantic regressions.

### Phase 5 — Archive old repo

Only after review and validation:

- mark `geniusseeker-talent-success-platform` read-only/archive,
- update its README to point to the surviving repo,
- retain full Git history,
- do not delete it.

## Explicit Non-Goals for Consolidation PR

- No Supabase migration solely for documentation alignment.
- No learner data rewrite.
- No production deployment.
- No repository rename.
- No compensation-policy activation.
- No automatic grant-compliance claim.
- No change to Business Central financial authority.
- No change to human-approval boundaries for competency/progression.

## Acceptance Criteria for the Consolidation

1. One canonical home exists for architecture, identity, training/progression, reporting, BC governance, and operating-model definitions.
2. Existing staging implementation remains functional and tests/build/lint remain green.
3. Implementation docs point to canonical design docs instead of redefining the same rules.
4. Business Central remains the authoritative financial system.
5. AI does not become an approver for competency/progression through consolidation.
6. Historical documents remain available but are clearly labeled historical/superseded where applicable.
7. The Indiana training-funding crosswalk has a dedicated location and is clearly separated from unverified compliance claims.
8. The old Talent Success repo is archived only after migration review and validation.
