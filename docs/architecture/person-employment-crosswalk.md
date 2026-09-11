# Person / Employment Crosswalk

**Status:** canonical identity and attribution boundary for the consolidated Genius Seeker repository.  
**Source provenance:** reconciles the Talent Success person/employment crosswalk design with the durable learner implementation in this repository.  
**No schema or production changes are authorized by this document.**

## Why This Exists

Reliable training, retention, grant evidence, coaching, progression, call attribution, and sales reporting all depend on answering one question correctly: **which verified person, in which verified employment period, does this source record belong to?**

Names, email addresses, browser sessions, rep codes, extensions, current account owners, and display names are not sufficient historical identity evidence.

## Canonical Records

### `person`
One human across the platform.

Minimum rule:
- immutable opaque `person_id`
- never recycled
- no email/name/phone used as the primary identity

### `person_external_identity`
Maps a scoped external account/profile/issuer subject to a person after verification.

Preserve:
- source system + environment/project
- issuer/account/tenant where applicable
- original source identifier
- verification evidence/reviewer/time
- unresolved/disputed state when identity cannot be confirmed

### `employment_episode`
Represents one approved employment period for a person at an organization.

A rehire creates a new `employment_episode_id` for the same `person_id`. Historical evidence remains tied to the episode in which it occurred unless an explicit reviewed reuse rule applies.

### `application_person_link`
Links an application record to a verified person without turning the ATS application into the person master.

### `employment_alias`
Effective-dated mapping from a source employee/user/salesperson/extension/other operational identifier to an employment episode.

This is critical for historical RingCentral, Business Central, and operational attribution. A current salesperson or extension assignment must never be used to silently relabel old records.

## Learner Context

Canonical learner context is:

`person_id + employment_episode_id + organization_scope + role_scope_ref`

The simulator's `learner_bindings` implementation securely derives this context from an authenticated user. Learners cannot submit a different person or episode to rewrite attribution. See `../durable-learner-records.md`.

## Matching Rules

A record may be admitted to governed learner/reporting history only when the relevant identity mapping is verified.

Allowed evidence can include:
- authoritative HR/employment record reference
- approved source user/account identifier
- effective-dated salesperson/extension assignment
- reviewed recruiting-to-employment linkage
- authorized correction/reconciliation case

Not sufficient by itself:
- same name
- same email string
- browser/local-storage identity
- assigned dealer rep
- current salesperson owner
- similar phone/extension
- AI inference

Unresolved is a valid state. Do not fabricate mappings to complete a dashboard.

## Effective Dates and Rehire

Employment/alias mappings are time-bound. Preserve `[effective_from, effective_to)` when known.

- rehire = same person, new episode
- recycled extension/rep code = new dated alias assignment
- historical record keeps historical episode
- ambiguous overlap = unresolved until reviewed
- correction = new traceable mapping/revision, not silent reassignment

## Source Namespace Requirement

Every external reference must be qualified enough to avoid collisions. Preserve, where applicable:

- source system
- environment/project/database
- tenant/account/company/organization
- entity/table/resource type
- original record ID
- source revision and/or occurrence timestamp

An ID without its namespace is not sufficient identity evidence.

## Business Central Attribution

For employee-level financial reporting, the fully scoped BC salesperson identifier must resolve through an effective-dated mapping to `person_id + employment_episode_id`.

Finance/HR/Sales Operations must approve the attribution basis (for example, document salesperson versus originating order assignment). Unknown or disputed mappings block the affected employee/pilot metric but do not erase valid company-level financial facts.

See `../integrations/business-central-data-contract.md`.

## RingCentral Attribution

RingCentral remains authoritative for call/session/event facts. Extensions or user IDs must be mapped to the correct employment episode for the event date. A connected call does not automatically equal a successful communication.

## Training / Grant Evidence Chain

This crosswalk supports a defensible chain:

`person -> employment episode -> training assignment/attempt -> coaching/assessment/evidence -> human review -> progression -> retention/outcome`

That chain is useful for training ROI and potential reimbursement evidence, but program eligibility must still be checked against current official rules.

## Privacy / Access

Identity and employment evidence is restricted. Store references to authoritative records rather than copying unnecessary personal data. Access to an identity mapping does not itself grant access to private coaching, HR, financial, or recruiting content.

## Guardrails

- Never create dummy people to absorb unattributed records.
- Never use a current account owner to infer historical ownership.
- Never rewrite a rehire into the original episode.
- Never count missing mappings as zero performance.
- Never allow AI to resolve an identity dispute by itself.
