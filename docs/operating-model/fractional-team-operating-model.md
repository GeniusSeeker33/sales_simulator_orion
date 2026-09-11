# Fractional Contributor Operating Model

> Migrated from `GeniusSeeker33/geniusseeker-talent-success-platform/contributors/operating-model.md` during repository consolidation. Status remains proposed design; migration does not appoint contributors or activate compensation, IP, tax, payroll, or revenue-sharing policy.

## Operating Rules

- Logging time, committing code, accepting a deliverable or meeting a milestone creates **no equity, IP ownership, royalties or revenue rights**.
- Compensation comes from a separate approved agreement. Reference its approved method/terms; do not calculate payment here. Payroll/contractor payment processing and any future revenue-participation mechanism remain separate governed systems.
- Written IP terms must be referenced from an agreement, never inferred from GitHub activity or time. “Module owner” means operational responsibility, not legal ownership.
- Every active contribution links to an approved project **and** work item. Scope changes require renewed approval. Work approval is not permission to deploy or change production.
- Planned authorized hours, actual reported time, reviewed approved hours, accepted deliverables and observed outcomes are separate facts. None substitutes for another.
- A person may have several role assignments. Employee, contractor or other participation status is determined outside this software by authorized people; no classification rules or inferred employment records are introduced.

## Shared Fields and Identity

All seven conceptual records have immutable opaque UUIDs, `organization_scope`, source references, creation/update actor/times, revision and record status, correction reason and optional same-entity supersession. Preserve decided revisions; corrections do not silently replace prior facts.

Approval records pin the target revision and verified reviewer identity/authority at decision time. No self-approval. If a lead is also the contributor, leadership appoints another qualified reviewer. Missing reviewers block approval, not factual time recording.

Use the canonical immutable `person_id`. A draft contributor profile may be unresolved, but active assignments/submissions require a verified person. An optional verified employment-episode reference is permitted for employees; external contributors do not need fabricated episodes.

Access is organization/project-scoped. Contributors see their own time, submissions and decisions; assigned reviewers see necessary records. Project members see approved shared deliverables, not everyone's agreements/time. Agreement/IP/compensation references and review disputes require restricted access, retention policy and access auditing.

## Roles Supported

| Role code | Work scope examples |
|---|---|
| trainer | Facilitation, curriculum and coaching deliverables |
| virtual_trainer | Remote delivery and virtual-learning preparation |
| business_analyst | Requirements and process analysis |
| product_owner | Priorities, scope and acceptance coordination |
| ai_workflow_designer | AI workflow/prompt evaluation and documented safeguards |
| software_developer | Approved implementation and technical documentation |
| qa_operational_tester | Test evidence and operational validation |
| reporting_data_specialist | Data definitions, mapping and reporting validation |
| finance_controls_advisor | Control design and reconciliation requirements |
| subject_matter_expert | Domain/content validation |

Roles describe approved work, not worker classification, legal ownership or blanket access. Each assignment specifies project, dates, responsibilities and authority limits.

## Conceptual Records

1. `contributor_profile` — participation identity, verified person, sponsor, agreement references and participation status.
2. `contributor_role_assignment` — one person's approved role, responsibilities, authority limits and period on a project.
3. `contribution_project` — approved work container with objective, scope, sponsor, owner, reviewers and planning envelope.
4. `contribution_work_item` — bounded reviewable work with acceptance criteria, planned hours, deliverable references and expected value.
5. `contribution_time_entry` — reported work time, kept separate from reviewed approved time and separate from payment determination.
6. `contribution_review` — attributable human decision on a pinned record revision with authority/conflict checks and rationale.
7. `contribution_milestone` — planned checkpoint linking accepted deliverables and, where required, verified outcomes.

## Approval Workflow

1. Sponsor confirms participant identity and written terms through restricted agreement references.
2. Approve project, roles, work-item criteria and planned hours before substantive work.
3. Contributor records actual time and versioned deliverables separately; logs do not self-approve.
4. Authorized reviewer decides time and deliverable acceptance separately, explaining discrepancies and required revisions.
5. Milestone reviewer checks accepted work and any required outcome evidence; hours alone cannot prove value.
6. Notify contributor and allow correction/reconsideration by an authorized independent reviewer. Preserve original reports/decisions.
7. Hand off approved operational records to the separate agreement-governed compensation process only if authorized. No entitlement, payroll calculation, ownership allocation or revenue formula runs here.

## Open Leadership / Legal / Finance Decisions

- Name project sponsors, delegated approvers, independent reviewers and conflict/reconsideration rules.
- Confirm written compensation and IP agreements before substantial work; authorized legal/HR advisers determine participant classification outside software.
- Choose the authoritative contributor registry, verify legacy aliases, and approve access/retention and external-project boundaries.
- Define planning limits, out-of-scope work handling, review cadence and acceptable time evidence.
- Approve deliverable/outcome criteria, maintenance responsibilities and client-sensitive artifact handling.
- Decide the authorized handoff to separate payroll/contractor payment administration. Any future revenue participation requires its own reviewed agreement and design; no formula or rights are created here.

**Stop point:** operating-model design only. No production code, schemas, compensation policy, or worker-classification logic is activated by this document.
