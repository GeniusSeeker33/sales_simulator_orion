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
canonical adapter contract and file adapter, not a speculative hosted reader.
No hosted data was accessed.

Before a production export adapter is approved, document its connection/project,
verified source DDL or API schema, authoritative identity and record-ID semantics,
status/activity vocabularies, timestamps/time zones, recruiter references,
document storage authorization, and consent evidence semantics. The legacy source
may still be cross-project; the target is the canonical Genius Seeker Supabase
project selected by the server-only `CRM_DATABASE_URL`.

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

## Future continuous integration

A future server-side API/queue adapter may implement the same `read()` contract
after the missing source facts are verified. It must retain explicit apply/replay
authorization, workspace pinning, stable cursors, immutable provenance, private
document authorization, reconciliation receipts, and the candidate/learner
boundary. The separately hosted dealer UI is not part of this Talent-side import.
