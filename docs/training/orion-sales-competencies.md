# Orion Sales Competency Framework — Canonical Index

**Status:** canonical index and governance boundary for the consolidated repository.  
**Detailed source:** `GeniusSeeker33/geniusseeker-talent-success-platform/data/competency-models/orion-sales-competencies.md` at source blob `b36daaab719d666821d2e84392bb8984337acfd5`.  
**Migration rule:** preserve that detailed source losslessly before the legacy repository is archived. Do not re-author or truncate the approved anchors during consolidation.

## Role in the Platform

The Orion sales competency framework defines versioned competencies identified by stable C01-C15 codes plus immutable identifiers. Each competency has versioned behavioral anchors across B1-B5 bands.

The framework is a **definition catalog**. It is not a learner score table and does not itself state what band a learner has demonstrated.

Learner evidence and human-reviewed conclusions belong in governed training/evidence records. See `training-progression-record-model.md`.

## Canonical Rules

- C01-C15 codes remain stable identifiers; competency definitions are versioned.
- B1-B5 are behavioral proficiency anchors, not L1-L5 progression levels.
- Evidence must pin the competency version and anchor/criteria version used at review time.
- AI may suggest observations/bands but cannot make a final approved competency or progression decision.
- Human review must distinguish observed gaps from missing opportunity, technical failure, unavailable evidence, and disputed evidence.
- Re-scoring existing evidence does not create a new independent observation.
- Framework changes are prospective/versioned; do not reinterpret historical evidence silently under a new rubric.

## Relationship to Current Implementation

Implemented/staging evidence in this repository includes:

- `../competency-evidence-deployment.md`
- `../competency-band-review-deployment.md`
- `../attributable-coaching-sessions.md`
- `../manager-coach-ui.md`

Those documents describe current application behavior. This file defines the canonical competency-governance boundary.

## Consolidation Note

The detailed 60k+ source framework is intentionally **not manually shortened or retyped** in this PR because doing so risks losing approved behavioral anchors and evidence rules. Until a lossless import is completed, the source blob above remains the frozen detailed reference. The old repository must not be archived until the exact framework content is present and verified in this repository.
