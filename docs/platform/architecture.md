# Architecture

> Migrated from `GeniusSeeker33/geniusseeker-talent-success-platform/docs/architecture.md` during repository consolidation. This is platform-level design guidance; current implementation behavior remains documented separately in this repository.

## Product Layers

### 1. Talent Acquisition
Candidate intake, recruiter workflows, candidate profiles, job matching, Orion-specific applications, and future external placements.

### 2. Talent Development
Onboarding, structured curricula, remediation, confidence-building, communication training, and weekly live or virtual classes.

### 3. Sales Simulation
AI customer personas, scenario practice, call scoring, difficulty levels, coaching recommendations, and manager visibility.

### 4. Talent Progression
L1-L5 progression, competency requirements, certifications, training milestones, and role readiness.

### 5. Talent Marketplace
Candidate reuse, external placement opportunities, employer relationships, placement revenue, and talent network growth.

### 6. Performance Intelligence
Call blocks, successful conversations, sales outcomes, activity-to-result ratios, coaching history, and progress tracking.

### 7. Executive Reporting
Leadership dashboards for training ROI, hiring ROI, productivity, attrition, revenue contribution, and cohort performance.

### 8. Contributor Economy
Tracking internal contributors, approved hours, modules, deliverables, expertise, milestone bonuses, and future revenue participation.

### 9. Enterprise Integrations
Microsoft Business Central, RingCentral, Supabase, Orion recruiting properties, and other internal systems.

### 10. Marketing Command Center
Tenant-aware campaign planning, attribution records, and human approval governance. The implemented repository foundation scopes campaigns by workspace and prevents agent-attributed changes from approving or activating them. Publishing, cross-channel ingestion/reporting, and agent orchestration remain future work; see `docs/marketing/marketing-command-center.md` for the implementation boundary.

## Technical Direction
Use `geniusseeker-os` as the likely core product foundation. Keep specialized applications modular where appropriate, including the Orion sales simulator and Join-Orion front door.

Repository consolidation is now underway under the controlled plan in `docs/repository-consolidation-audit.md`; duplicate functionality, data ownership, and migration boundaries must still be reconciled before any implementation-level merge or schema change.
