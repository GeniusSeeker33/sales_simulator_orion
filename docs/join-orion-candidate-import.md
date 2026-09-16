# Join-Orion candidate import and reconciliation

## Safety and source-of-truth assumptions

This is an operator-run, server-only, workspace-scoped import. It is not an API
endpoint, browser feature, synchronization service, deployment, or destructive
mirror. It defaults to **dry-run** and cannot write unless `--apply` is present.
The source is authoritative only for records whose IDs and semantics an approved
adapter has verified. Source deletion never deletes CRM history.

The repository does **not** contain Join-Orion credentials, DDL, an API contract,
or verified column names. It verifies only the legacy entity names
`candidate_applications` and `candidate_activity`. The migration map names
`job_postings` only as a source for `job_ref`. Candidate document and consent
entities remain unverified. Consequently, this PR deliberately supplies a
canonical adapter contract, file adapter, and safe database inspector—not a
speculative hosted reader.
No hosted data was accessed.

Before a production export adapter is approved, document its connection/project,
verified source DDL or API schema, authoritative identity and record-ID semantics,
status/activity vocabularies, timestamps/time zones, recruiter references,
document storage authorization, and consent evidence semantics. The legacy source
may still be cross-project; the target is the canonical Genius Seeker Supabase
project selected by the server-only `CRM_DATABASE_URL`.

## Repository source discovery (2026-09-16)

### Verified source facts

* Repository history through merged PR #44 contains no source DDL, generated
  database types, source API response, candidate fixture copied from production,
  or server-side Join-Orion source client.
* `candidate_applications` and `candidate_activity` are legacy **entity names**
  used by the CRM provenance model. They do not verify columns in a live source.
  `job_postings` is documented only as a possible origin for `job_ref`.
* The browser Supabase client contains the historical project reference
  `shwdkkiinqhacwerukch` as a fallback. The same client supports newsletter and
  dealer-inquiry code, so repository evidence does not establish that this is
  the current candidate source or that candidate tables remain there.
* No authoritative candidate/person identity field, activity vocabulary,
  application status vocabulary, recruiter field, document field, storage
  bucket, or consent-evidence field is verified by repository evidence.
* The canonical CRM is configured separately with server-only
  `CRM_DATABASE_URL`. Browser variables are not an acceptable source connection.

### Not available / unresolved

The source schemas, current tables/views, exact columns/types/constraints,
authoritative application and identity semantics, and every source-to-canonical
field mapping remain unresolved. In particular, an application ID must not be
treated as a person identity and email must not be promoted to
`source_identity_id`. Until an operator reviews an inspection report and commits
an approved mapping, the direct database adapter is intentionally not enabled.
The protected JSON adapter remains the only import input.

## Privacy-preserving source inspection

Set the two distinct database connections in a trusted operator shell:

```sh
export JOIN_ORION_DATABASE_URL='postgresql://...'
export JOIN_ORION_DATABASE_CA_CERT='-----BEGIN CERTIFICATE-----...'
export CRM_DATABASE_URL='postgresql://...'
export CRM_DATABASE_CA_CERT='-----BEGIN CERTIFICATE-----...'
npm run inspect:join-orion-source > join-orion-source-metadata.json
```

`JOIN_ORION_DATABASE_CA_CERT` is optional when the platform certificate chain is
already trusted. The command reads PostgreSQL catalogues only. It reports relevant
schemas, tables/views, columns, PostgreSQL types, nullability, key constraints,
estimated row counts, PostgreSQL enum labels, possible categorical fields, and
the presence (not values) of document/storage and consent/evidence columns. It
does not query candidate
rows or emit distinct values, names, emails, phones, addresses, resumes, free
text, notes, or application content. There is deliberately no sampling flag.

The command compares `pg_control_system().system_identifier` plus database name
for source and target, rather than guessing from hostnames. It refuses an
unverifiable identity or a source that resolves to the CRM target. Keep the JSON
report protected: although it contains no candidate rows, schema metadata may be
operationally sensitive. Submit a redacted/approved report to define the verified
adapter mapping in a follow-up change.

## Canonical source adapter contract

The path in `JOIN_ORION_EXPORT_FILE` must be a protected JSON file (never committed)
with this explicit shape. Empty arrays are required when an entity is unsupported.

```json
{
  "contract_version": 1,
  "applications": [{
    "source_id": "authoritative application ID",
    "source_identity_id": "authoritative person ID",
    "first_name": "Ada", "last_name": "Example", "preferred_name": "",
    "email": "ada@example.test", "phone": null,
    "status": "submitted", "job_ref": "ROLE-1",
    "submitted_at": "2026-01-01T12:00:00Z",
    "source_created_at": "2026-01-01T12:00:00Z",
    "source_updated_at": "2026-01-02T12:00:00Z",
    "owner_ref": null, "payload": {}
  }],
  "activities": [{
    "source_id": "authoritative activity ID", "source_identity_id": "authoritative person ID",
    "application_source_id": "authoritative application ID", "type": "form_submission",
    "direction": "inbound", "summary": "Application submitted",
    "occurred_at": "2026-01-01T12:00:00Z", "metadata": {}
  }],
  "documents": [],
  "consents": []
}
```

This contract does not claim those property names exist in Join-Orion. An approved
adapter must translate verified source fields into it. A document additionally
requires `source_entity`, `document_type`, and an opaque, non-URL `storage_path`;
optional fields are `application_source_id`, `original_filename`, and `metadata`.
The importer stores metadata/reference only and never copies binaries or accepts a
private URL. Candidate 360 does not project storage paths.

A consent additionally requires `source_entity`, `channel`, `status`, `purpose`,
`captured_at`, and a non-empty `evidence` object. No record is created for absent
evidence. Application submission is not marketing consent.

## Mapping

| Canonical record | CRM target | Provenance |
| --- | --- | --- |
| Distinct `source_identity_id` | `crm.people` (`applicant`) | `join-orion / candidate_applications / source_identity_id` |
| Application | `crm.applications` (`candidate`) | `join-orion / candidate_applications / source_id` |
| Activity | `crm.activities` | `join-orion / candidate_activity / source_id` |
| Verified document metadata | `crm.documents` | `join-orion / verified source_entity / source_id` |
| Verified consent evidence | `crm.consent_records` | `join-orion / verified source_entity / source_id` |

Source created/updated times and owner references are retained in the application
snapshot; submission and activity occurrence timestamps populate their native CRM
columns. `job_ref` is the only jobs mapping. Recruiter source references are not
converted to Auth users without a governed crosswalk.

### Status and activity mappings

Accepted application statuses are: `draft`, `submitted`, `in_review`, `qualified`,
`approved`, `rejected`, `withdrawn`, and `hired`. Unknown values are skipped and
reported, never coerced. Accepted activity types are `form_submission`, `note`,
`call`, `email`, `meeting`, `interview`, `status_change`, `task`, and `document`.
Unknown values are likewise skipped and reported. These explicit same-name maps
must be updated only after source semantics are verified.

## Identity and privacy boundaries

Only an authoritative `source_identity_id` joins source applications to one CRM
person. Email, name, phone, address, resume, browser/session data, and similarity
never merge people. Shared source emails and unrelated CRM email matches enter the
machine-readable `potential_duplicates` queue with evidence and a human action
category; the tool never recommends automatic merge. Conflicting fields for one
source identity enter `identity_conflicts`.

The import creates no Auth identity, learner binding, employment binding, scoring,
ranking, recommendation, or sensitive-characteristic inference. Candidate 360
therefore continues to report no verified learner/employment linkage unless a
separate governed crosswalk exists.

## Operator procedure

Set `CRM_DATABASE_URL`, optional `CRM_DATABASE_CA_CERT`, `CRM_WORKSPACE_ID`, and
`JOIN_ORION_EXPORT_FILE` only in the trusted operator environment. Never use a
`VITE_` variable. First retain and review both report forms:

```sh
npm run import:join-orion-candidates
npm run import:join-orion-candidates -- --json
```

Both commands perform zero writes. The report includes a deterministic content/run
identifier, workspace, inspected/proposed/existing/update counts, invalid/skipped
records, ambiguity queues, batches, and writes. Resolve invalid mappings and human
reconciliation items; archive the JSON according to the approved audit policy.

Apply requires both an explicit flag and an attributable operator/ticket value:

```sh
export CRM_IMPORT_OPERATOR='change-1234/alice'
npm run import:join-orion-candidates -- --apply --json
```

Apply reads the protected export twice and aborts before writes if it changed. It
locks the workspace import and performs people, applications, activities,
documents, and consent in one database transaction. Any failure rolls back the
whole run, so no orphan relationship is silently retained. The receipt reports
per-entity batch attempts/writes. Composite CRM provenance uniqueness makes reruns
restartable and idempotent; separate application source IDs remain separate, and
the importer performs no updates or deletes. If future volume requires bounded
batches, preserve each person's dependent records in the same transaction and
report every committed/failed batch explicitly.

## Direct adapter gate and future continuous integration

A `JoinOrionSourceAdapter.read()` database mapping cannot be truthfully
implemented from current repository evidence. Therefore
`npm run import:join-orion-candidates` continues to require the protected JSON
file and cannot accidentally interpret unknown source columns. After the operator
inspection verifies the missing facts, a server-side database/API adapter may
implement the same `read()` contract and make database-backed dry-run available.
It must retain explicit apply/replay
authorization, workspace pinning, stable cursors, immutable provenance, private
document authorization, reconciliation receipts, and the candidate/learner
boundary. The separately hosted dealer UI is not part of this Talent-side import.
