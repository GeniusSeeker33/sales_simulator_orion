# Genius Seeker Documentation Map

This repository is the surviving working repository for the Orion implementation of Genius Seeker. The running application and staging-tested behavior remain authoritative for implementation; the canonical documents below define platform meaning, governance, reporting boundaries, and future direction.

## Start Here

### Platform
- [Vision](platform/vision.md)
- [Architecture](platform/architecture.md)
- [Business model](platform/business-model.md)
- [Roadmap](platform/roadmap.md)

### Identity and Data Architecture
- [Core data model](architecture/core-data-model.md)
- [Person / employment crosswalk](architecture/person-employment-crosswalk.md)

### Training and Progression
- [Training / progression record model](training/training-progression-record-model.md)
- [Orion sales competency framework index](training/orion-sales-competencies.md)
- [Orion L1-L5 framework index](training/orion-l1-l5.md)

The detailed C01-C15 competency and L1-L5 source frameworks are not considered losslessly migrated until their full source content is imported and verified. Do not archive `geniusseeker-talent-success-platform` before that gate is complete.

### Reporting and Enterprise Integration
- [Orion reporting and integration plan](reporting/orion-reporting-and-integration-plan.md)
- [Business Central data contract](integrations/business-central-data-contract.md)

Microsoft Business Central remains authoritative for financial facts. RingCentral remains authoritative for telephony events. Genius Seeker links verified development evidence and approved source-derived reporting; it does not become a competing financial ledger.

### Operating Model
- [Fractional contributor operating model](operating-model/fractional-team-operating-model.md)
- [Fractional team governance](operating-model/fractional-team-governance.md)

### Compliance / Funding
- [Indiana Employer Training Grant crosswalk workspace](compliance-funding/indiana-employer-training-grant-crosswalk.md)

The funding crosswalk is a verification workspace, not a grant-compliance claim.

## Current Implementation Evidence

These documents describe staging-tested or implementation-specific behavior. They complement rather than replace the canonical design documents:

- [Durable learner records](durable-learner-records.md)
- [Attributable coaching sessions](attributable-coaching-sessions.md)
- [Competency evidence deployment](competency-evidence-deployment.md)
- [Competency band review deployment](competency-band-review-deployment.md)
- [Progression review deployment](progression-review-deployment.md)
- [Scoped reviewer history](scoped-reviewer-history.md)
- [Manager / coach UI](manager-coach-ui.md)
- [Auth / role provisioning](auth-role-provisioning.md)
- [Realtime voice session](realtime-voice-session.md)
- [Dealer conversation realism](dealer-conversation-realism.md)
- [Orion MVP staging / pilot readiness](orion-mvp-staging-pilot-readiness.md)

## Canonical Rules

1. A verified person and employment episode anchor learner records.
2. B1-B5 competency bands and L1-L5 progression levels are separate concepts.
3. AI can support practice and review but cannot approve progression.
4. Only authorized human review creates approved progression history.
5. Missing, disputed, stale, or incomplete data is unavailable—not zero and not inferred.
6. Business Central retains financial authority.
7. Existing staging behavior is not rewritten solely to match older conceptual names.
8. No repository archive, production migration, compensation activation, or grant-compliance claim is implied by documentation consolidation.

## Consolidation Status

- Phase 1: platform/reporting/integration/operating-model documentation migrated.
- Phase 2: identity/core-data/training/progression canonical documentation migrated and reconciled.
- Phase 3: repository entry points and cross-reference cleanup in progress.
- Remaining archive gate: lossless import + verification of the full C01-C15 competency framework and full L1-L5 framework, followed by validation and final repository review.
