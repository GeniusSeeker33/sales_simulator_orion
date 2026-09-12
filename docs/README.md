# Genius Seeker / Orion Documentation Map

This map is the canonical entry point for documentation in the surviving Genius Seeker / Orion repository. Use it to find the governing design for a concept and then the corresponding implementation or deployment evidence. A document marked **canonical** defines intended platform boundaries; a document marked **implementation evidence** describes behavior that exists in this repository. Strategic or future material is not a claim that a feature is deployed.

## Platform

| Document | Role |
|---|---|
| [Vision](platform/vision.md) | **Canonical:** product purpose, users, and long-term direction. |
| [Architecture](platform/architecture.md) | **Canonical:** platform capability layers and technical direction. |
| [Business model](platform/business-model.md) | **Canonical:** commercial model and governance context. |
| [Roadmap](platform/roadmap.md) | **Strategic:** delivery phases; consult implementation documents before treating an item as available. |
| [Repository consolidation audit](repository-consolidation-audit.md) | **Governance:** repository disposition, migration boundaries, and consolidation acceptance criteria. |

## Architecture and identity

| Document | Role |
|---|---|
| [Core data model](architecture/core-data-model.md) | **Canonical:** major records and ownership boundaries. |
| [Person and employment crosswalk](architecture/person-employment-crosswalk.md) | **Canonical:** identity, employment episodes, and attribution across systems. |
| [Durable learner records](durable-learner-records.md) | **Implementation evidence:** current learner-record behavior. |
| [Authentication and role provisioning](auth-role-provisioning.md) | **Implementation evidence:** current access and role provisioning. |

## Training, coaching, and progression

| Document | Role |
|---|---|
| [Training and progression record model](training/training-progression-record-model.md) | **Canonical:** training, coaching, evidence, review, and progression records. |
| [Orion sales competencies](training/orion-sales-competencies.md) | **Canonical:** versioned competency framework. |
| [Orion L1–L5 framework](training/orion-l1-l5.md) | **Canonical:** progression-level requirements. |
| [Sales Academy to production-level transition](orion-sales-academy-production-level-transition.md) | **Supporting operational analysis:** separates Academy/ramp status, individual competency evidence, overall B1–B5 behavioral review, and approved L1–L5 progression. |
| [Anthony AE checklist competency map](anthony-ae-checklist-competency-map.md) | **Supporting operational analysis:** maps checklist work to potential evidence opportunities without defining a competing competency framework or scoring rule. |
| [Attributable coaching sessions](attributable-coaching-sessions.md) | **Implementation evidence:** coaching attribution and records. |
| [Competency evidence deployment](competency-evidence-deployment.md) | **Implementation evidence:** competency evidence behavior. |
| [Competency-band review deployment](competency-band-review-deployment.md) | **Implementation evidence:** human review of competency bands. |
| [Progression review deployment](progression-review-deployment.md) | **Implementation evidence:** human review of L1–L5 progression. |
| [Scoped reviewer history](scoped-reviewer-history.md) | **Implementation evidence:** reviewer scope and history. |
| [Manager and coach UI](manager-coach-ui.md) | **Implementation evidence:** manager/coach workflows. |

## Orion simulation and pilot operations

| Document | Role |
|---|---|
| [MVP staging pilot readiness](orion-mvp-staging-pilot-readiness.md) | **Operational:** current staging checks and pilot runbook. |
| [Realtime voice session](realtime-voice-session.md) | **Implementation evidence:** realtime voice behavior and boundaries. |
| [Dealer conversation realism](dealer-conversation-realism.md) | **Implementation evidence:** scenario and conversation behavior. |

## Marketing Command Center

| Document | Role |
|---|---|
| [Marketing Command Center foundation](marketing/marketing-command-center.md) | **Architecture and implementation status:** tenant-aware campaign planning, attribution records, human approval governance, and explicit future boundaries. |

The Marketing Command Center is an additional Genius Seeker / Orion capability area, not a claim of end-to-end marketing automation. The repository currently contains a governed campaign-planning foundation. Publishing, cross-channel ingestion/reporting, and agent orchestration remain future work.

## Reporting and integrations

| Document | Role |
|---|---|
| [Orion reporting and integration plan](reporting/orion-reporting-and-integration-plan.md) | **Canonical:** reporting definitions, ownership, and source-of-truth boundaries. |
| [Business Central data contract](integrations/business-central-data-contract.md) | **Canonical:** read-only financial integration and governance contract. |

Business Central remains authoritative for financial data. Application endpoints and UI are implementation surfaces, not replacements for that authority.

## Operating model and funding

| Document | Role |
|---|---|
| [Fractional-team operating model](operating-model/fractional-team-operating-model.md) | **Canonical/proposed:** contributor roles and delivery model, subject to stated approvals. |
| [Fractional-team governance](operating-model/fractional-team-governance.md) | **Canonical/proposed:** accountability and governance controls, subject to stated approvals. |
| [Indiana employer training grant crosswalk](compliance-funding/indiana-employer-training-grant-crosswalk.md) | **Planning evidence:** requirements crosswalk; it does not assert grant compliance. |

## Documentation rules

1. Link to a canonical document rather than redefining its terminology in an implementation note.
2. Label planned, proposed, or future behavior explicitly.
3. Treat migrations and deployment notes as evidence of repository implementation, not proof of production deployment.
4. Preserve Business Central's financial authority and human approval boundaries.
5. Update this map whenever a new canonical capability or architecture area is added.
