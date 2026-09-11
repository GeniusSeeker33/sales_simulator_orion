# Genius Seeker — Orion Implementation

This repository contains the working Orion implementation of **Genius Seeker**, a talent-success platform that combines recruiting, training, AI-supported sales practice, human coaching, competency evidence, progression, executive reporting, and enterprise integration.

The original Orion sales simulator remains an important product module, but the repository now represents a broader talent and development operating system.

## Documentation

Start with the [Genius Seeker documentation map](docs/README.md).

Key canonical areas:

- [Platform vision and architecture](docs/platform/)
- [Identity and core data architecture](docs/architecture/)
- [Training, competency, and progression](docs/training/)
- [Executive reporting](docs/reporting/)
- [Business Central governance](docs/integrations/)
- [Fractional-team operating model](docs/operating-model/)
- [Training funding / compliance workspace](docs/compliance-funding/)

Existing implementation documents under `docs/` remain the source for staging-tested behavior. Canonical design documents define meaning and governance; they do not silently rewrite deployed schema or behavior.

## Current Product Capabilities

- AI dealer/customer simulation with text and realtime voice practice
- Durable learner-attributed practice records
- Human coaching workflows
- Human-reviewed competency evidence and B1-B5 bands
- Human-approved L1-L5 progression
- Manager / coach learner history
- Orion employee and training workflows
- Executive/reporting architecture
- Microsoft Business Central and RingCentral integration boundaries
- Newsletter and internal engagement capabilities

## Non-Negotiable Governance Boundaries

- AI may support practice and assessment but does **not** approve progression.
- Business Central remains authoritative for financial/accounting facts.
- RingCentral remains authoritative for telephony events.
- Missing or disputed data is not treated as zero or silently inferred.
- Production schema/data changes require separately reviewed migrations.
- The Indiana training-funding workspace is not a grant-compliance claim until current official requirements are verified.

## Local Development

### Install dependencies

```bash
npm install
```

### Configure environment

Use `.env.example` as the configuration reference. Keep server secrets server-side; do not place service-role or secret keys in browser-exposed variables.

### Run locally with API functions

```bash
npm install -g vercel
vercel link
vercel dev
```

### Validation

Use the repository's current test/build commands before merging implementation changes. Documentation-only consolidation does not itself authorize deployment or production migration.

## Repository Consolidation

The architecture/governance repository `geniusseeker-talent-success-platform` is being consolidated into this working repository in controlled phases. It must remain available until the full C01-C15 competency framework and L1-L5 framework have been imported losslessly, verified, and the final archive gate is approved.
