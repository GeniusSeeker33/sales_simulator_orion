# Indiana Employer Training Grant Crosswalk

**Status:** requirements verification pending. This document is a controlled workspace, not a claim that Genius Seeker or Orion is grant-compliant or that any expense is reimbursable.

## Purpose

Map current official Indiana Employer Training Grant requirements to the evidence Genius Seeker can capture and to the external Orion systems that remain authoritative for employment, payroll, financial, or other facts.

Before any row is marked `covered`, the current program rule must be verified against an official Indiana source and dated.

## Crosswalk

| Program requirement / evidence needed | Official rule/source/date checked | Genius Seeker canonical record / field | Orion / external source | Responsible owner | Evidence retention requirement | Status | Implementation action |
|---|---|---|---|---|---|---|---|
| Employer eligibility | TBD | Organization scope / program configuration | Orion legal/Finance records | Finance / program owner | TBD | unverified | Verify current official rule |
| Employee eligibility | TBD | `person_id`, `employment_episode_id`, role scope | Authoritative HR/employment source | HR / program owner | TBD | partial | Verify rule and required employment attributes |
| Approved training assignment | TBD | `training_assignment` | Training lead approval | Training lead | TBD | partial | Map eligible activity categories |
| Training participation / completion | TBD | `training_attempt`, completion review | Trainer / learning evidence | Training lead | TBD | partial | Confirm acceptable proof and dates |
| Training dates / duration | TBD | assignment/attempt/session timestamps | Trainer records | Training lead | TBD | partial | Confirm required granularity |
| Trainer/provider evidence | TBD | coach/trainer/contributor references | Contracts / invoices if required | Program owner / Finance | TBD | partial | Verify provider requirements |
| Training cost | TBD | program cost reference only | Finance / AP / Business Central | Finance | TBD | gap | Define authoritative cost source and reconciliation |
| Employee retention milestone | TBD | employment episode link + reporting checkpoint | Authoritative HR/employment source | HR | TBD | partial | Verify required retention period and evidence |
| Wage/payroll evidence | TBD | reference only; do not duplicate payroll payload | Payroll/HR/Finance | HR / Finance | TBD | external | Verify whether required and permitted evidence |
| Reimbursement request package | TBD | traceable evidence packet / export design | Finance submission records | Finance / program owner | TBD | gap | Define approved export and sign-off workflow |
| Audit / correction history | TBD | immutable IDs, revisions, source refs, reviewer/time | Source systems as applicable | Program owner / Finance | TBD | partial | Verify audit retention period |

## Design Principles

- Business Central/Finance remains authoritative for financial facts.
- The designated HR/employment source remains authoritative for hire, status, exit and rehire facts.
- Genius Seeker should preserve attributable training evidence, exact dates, versions, reviewers, source references and correction history.
- Missing or disputed evidence is `unavailable`, never silently treated as zero or complete.
- No reimbursement, tax, accounting, payroll or legal conclusion is automated by the platform.
- Grant-specific logic remains separated from the core training model so program rules can change without rewriting learner history.

## Next Step

Verify the current Indiana program rules from official sources, then fill this crosswalk row by row and identify only the true implementation gaps.
