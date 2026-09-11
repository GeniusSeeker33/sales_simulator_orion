# Genius Seeker — Orion Platform

This repository is the canonical working home for the Genius Seeker platform documentation and the Orion implementation. It brings the broader talent-success architecture, governance, training, reporting, and operating-model definitions together with the runnable Orion sales simulator and its implementation evidence.

Start with the **[documentation map](docs/README.md)** to distinguish canonical design, implemented behavior, deployment evidence, and future work. The consolidation boundary and source-repository disposition are recorded in the **[repository consolidation audit](docs/repository-consolidation-audit.md)**.

## Current capabilities

- **Sales simulation:** text and realtime voice practice, customer personas, scenario difficulty, call scoring, coaching recommendations, and manager visibility.
- **Talent development and progression:** durable learner records, attributable coaching sessions, competency evidence and review, and the Orion L1–L5 progression framework.
- **Enterprise reporting and integrations:** governed Business Central and Orion reporting boundaries, with implementation-specific integrations retained in the application.
- **Marketing Command Center foundation:** tenant-aware marketing workspaces and campaigns, campaign attribution identifiers and event records, and role-based human approval controls. The current foundation supports campaign planning and governance; publishing, cross-channel ingestion/reporting, and agent orchestration are future work.

## Repository boundaries

- Canonical product and governance documentation lives under [`docs/`](docs/README.md).
- Application implementation lives under [`src/`](src/), with server functions under [`api/`](api/) and automated checks under [`tests/`](tests/).
- Supabase migrations are implementation artifacts. Their presence does not mean they have been applied to any environment.
- Microsoft Business Central remains the financial system of record; this application does not redefine financial authority.
- Human reviewers retain approval authority. AI or future marketing agents may prepare work but do not approve competency, progression, campaign activation, or publication.

## Local development

### Prerequisites

- Node.js and npm
- Vercel CLI for local API functions
- Environment values described in [`.env.example`](.env.example)

### Setup

```bash
npm install
cp .env.example .env
npm install -g vercel
vercel link
vercel dev
```

Do not commit secrets. Configure production environment values through the deployment provider rather than adding them to this repository.

### Validation

```bash
npm run lint
npm run build
npm run test:conversation
npm run test:realtime
npm run test:learner
npm run test:marketing
```

## Documentation entry points

| Area | Start here |
|---|---|
| Platform purpose and product direction | [Vision](docs/platform/vision.md) |
| Platform capabilities and system boundaries | [Architecture](docs/platform/architecture.md) |
| Delivery sequence and future phases | [Roadmap](docs/platform/roadmap.md) |
| Identity and canonical records | [Core data model](docs/architecture/core-data-model.md) |
| Training, competency, and progression | [Training and progression record model](docs/training/training-progression-record-model.md) |
| Marketing capability and governance | [Marketing Command Center foundation](docs/marketing/marketing-command-center.md) |
| Reporting and finance-system authority | [Orion reporting and integration plan](docs/reporting/orion-reporting-and-integration-plan.md) |
| Full canonical and implementation index | [Documentation map](docs/README.md) |

## Consolidation status

`sales_simulator_orion` is the surviving working repository identified by the consolidation plan. Documentation migration does not itself deploy schemas, rewrite production data, rename the repository, or archive the source Talent Success repository. Those actions require separate review and validation.
