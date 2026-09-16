# Join-Orion candidate import and reconciliation

## Safety and verified source boundary

This is an operator-run, server-only, workspace-scoped import. It defaults to
**dry-run** and cannot write without `--apply`. The Join-Orion source and CRM
 target are separate PostgreSQL/Supabase databases. Source deletion never deletes
CRM history, and the adapter never queries dealer tables.

The verified source consists only of:

* `public.candidate_applications` (about 15 rows), whose UUID `id` is an
  authoritative **application** ID and whose nullable `position_id` references
  `job_postings.id`;
* `public.candidate_activity` (about 9 rows), whose UUID `id` is authoritative and
  whose nullable `candidate_id` references an application—not a canonical person;
* `public.job_postings` (about 13 rows). The adapter does not read this table
  because the application already contains both `position_id` and
  `position_title` and Talent does not create a jobs domain.

There is no verified person table or cross-application person ID. There is also no
verified candidate consent evidence. `resume_path` is the only verified resume
metadata. Cover letters, notes, admin notes, referral fields, and other unnecessary
free text are deliberately not selected by the database adapter.

## Inputs and operation

The default source is the verified database adapter:

```sh
export JOIN_ORION_DATABASE_URL='postgresql://...'
export JOIN_ORION_DATABASE_CA_CERT='-----BEGIN CERTIFICATE-----...' # optional
export CRM_DATABASE_URL='postgresql://...'
export CRM_DATABASE_CA_CERT='-----BEGIN CERTIFICATE-----...'       # optional
export CRM_WORKSPACE_ID='...'
npm run import:join-orion-candidates
npm run import:join-orion-candidates -- --json
```

Both commands above are dry runs and perform zero CRM writes. Connections require
TLS certificate validation. No `VITE_` variable is accepted. A protected canonical
JSON export remains supported by setting `JOIN_ORION_EXPORT_FILE`; when it is set,
it takes precedence over the database input.

Apply is a separate, attributable operator action:

```sh
export CRM_IMPORT_OPERATOR='change-1234/alice'
npm run import:join-orion-candidates -- --apply --json
```

Do not run apply until the dry-run report and reconciliation queues have been
reviewed. Apply rereads the source, takes a workspace advisory lock, and inserts
all records in one target transaction. Provenance uniqueness makes exact reruns
idempotent. The import never updates or deletes existing CRM history.

## Verified mapping

| Join-Orion source | Canonical / CRM target | Treatment |
| --- | --- | --- |
| `candidate_applications.id` | application `source_id`; application-scoped person provenance | One initial CRM person per application; never presented as a source person ID |
| `first_name`, `last_name`, `email`, `phone` | `crm.people` | Contact fields only; matching values never authorize an automatic merge |
| `status` | `crm.applications.status` | Explicit vocabulary map below; unknown values are skipped and reported |
| `created_at` | `submitted_at`, source created timestamp | Preserved with timezone |
| `source` | protected application snapshot | Source context, not a person identity |
| `recruiter` | protected `source_owner_ref` | Not converted to an Auth user without a governed crosswalk |
| `position_id` | `job_ref` | Stable reference when present; no jobs domain is created |
| `position_title` | protected application snapshot | Retained as source context |
| `resume_path` | `crm.documents.storage_path` metadata/reference | Opaque private reference only; no binary fetch and no URL conversion |
| `candidate_activity.id` | activity `source_id` | Independent authoritative provenance |
| `candidate_activity.candidate_id` | application relationship | Resolves activity to the application-scoped CRM person/application |
| `activity_note` | activity summary | Visible only in the authorized Candidate 360 detail activity boundary |
| `created_by` | protected activity metadata | Source actor text, not an Auth identity |
| `candidate_activity.created_at` | `occurred_at` | Preserved with timezone |

Document provenance is `join-orion / candidate_application_resumes /
candidate_applications/<application id>/resume_path`. The final component is a
stable importer provenance key derived from the authoritative application UUID
and verified field name; it is **not** represented as a document ID supplied by
Join-Orion. Candidate 360 projects document type and filename but never storage
path or metadata. The path stays opaque, HTTP/HTTPS values are rejected, and the
importer never fetches a binary. The source produces an empty `consents` array:
submitting an application is not marketing consent.

## Identity and reconciliation

Database records declare `identity_scope: "application"`. The importer uses the
application ID as the scoped internal correlation key but does **not** manufacture
or claim an authoritative `source_identity_id`. Every application may therefore
create its own CRM person and all historical applications remain separate.
Normalized email, phone, and name matches among application-scoped people enter
`potential_duplicates` for human review. Email matches against unrelated CRM
provenance are also reported. These signals never cause reuse or merge.

The protected JSON adapter still accepts the version 1 contract introduced in PR
#44, including a genuine `source_identity_id` when its producer has an authoritative
identity source. It may instead use `identity_scope: "application"` and relate
activities/documents with `application_source_id`.

### Human duplicate reconciliation report

An authorized operator can turn the same read-only source snapshot into connected
review cases. This command has no apply mode, does not connect to CRM, does not
fetch resume binaries, and cannot write either database:

```sh
npm run reconcile:join-orion-candidates
npm run reconcile:join-orion-candidates -- --json
npm run reconcile:join-orion-candidates -- --redacted
```

Use only a trusted local/operator terminal for the default output; it contains the
minimum contact fields needed for identity review. `--redacted` masks email and
phone values for safer sharing. Names remain visible because they are themselves
one of the review signals; operators must still handle the output as candidate
data. This is server-side tooling only and has no HTTP or Candidate 360 route.

Applications are connected when any normalized email, phone, or full-name signal
matches. Transitive links stay in one case, while each pair shows exactly which
signals match. Unconnected applications are counted but omitted from cases. Case
IDs are deterministic from the sorted source application UUIDs. Hashes and
normalized values support comparison only and never become identity keys.

**Matching contact information is evidence for human review, not authoritative
identity proof.** The report supplies no probability, score, recommendation, or
automatic decision. Its JSON output includes a worksheet template with `case_id`,
`source_application_ids`, `decision`, `reviewed_by`, `reviewed_at`, and `reason`.
The decision begins unset and may be recorded as `same_person`, `keep_separate`,
or `needs_more_review` outside this read-only command.

A future, separately governed import/identity-crosswalk process may accept a
reviewed worksheet. That process must preserve every historical application,
allow several applications to belong to one CRM person, preserve source
provenance, record the human reviewer, decision, and time, and remain reversible
and auditable where feasible. This report does not implement that mutation.

## Status and activity vocabulary

The safe categorical inspection observed/approved the following application
vocabulary and mappings:

| Source | CRM |
| --- | --- |
| `new` | `submitted` |
| `screened` | `in_review` |
| `interviewing` | `in_review` |
| `hired` | `hired` |
| `pending` | `submitted` |
| `reviewing` | `in_review` |
| `draft`, `submitted`, `in_review`, `qualified`, `approved`, `rejected`, `withdrawn`, `hired` | same semantic value |

The observed/approved activity mapping is:

| Source | CRM |
| --- | --- |
| `interview` | `interview` |
| `phone_call` | `call` |
| `notes_updated` | `note` |
| `status_updated` | `status_change` |
| `referral_submission` | `form_submission` |
| `advanced` | `status_change` |
| `note_added` | `note` |
| `email_sent` | `email` |
| `interview_scheduled` | `interview` |
| `form_submission`, `status_change`, `note`, `call`, `email`, `meeting`, `interview`, `task`, `document` | same semantic value |

The adapter retains the original categorical value alongside its mapped value.
Any value not in these explicit maps flows unchanged into reconciliation, where it
is skipped and reported as `source_status` or `source_type`; it is never coerced.
The report contains counts and categorical ambiguity, not candidate row samples.

For activity summaries, a non-empty `activity_note` is used verbatim after outer
whitespace is removed. If it is absent, the adapter emits only a deterministic,
neutral label for the verified type (for example, `Status updated`). It does not
invent an event narrative. The original type remains in protected activity
metadata regardless of which summary path is used.

## First hosted dry-run diagnosis

The initial hosted dry run inspected 15 applications, 9 activities, and 5 resume
references but rejected all 29 canonical records. PostgreSQL `timestamptz` values
arrive from postgres.js as JavaScript `Date` objects, while canonical timestamp
validation accepted only strings. Consequently every application lacked a
validator-recognized `submitted_at`, and every activity lacked a recognized
`occurred_at`. Because application validation populates the application-to-person
correlation map, those 15 timestamp failures then left all five derived resume
records without a resolvable application-scoped identity. The resume fields
themselves were present; their failures were downstream identity-resolution
failures. Canonical validation now accepts valid `Date` objects from the database
adapter as well as ISO strings from the JSON adapter, without relaxing any ID,
name, summary, timestamp, type, relationship, or path requirement.

## Privacy and domain boundaries

The adapter selects only the columns required above. It does not select cover
letters, application notes, admin notes, referral/payment data, or job-posting
content. Protected payload snapshots and activity metadata are not included in
Candidate 360 list projections. Resume paths are neither printed in reconciliation
reports nor exposed by Talent APIs.

The import creates no Auth identity, learner binding, employment binding, score,
ranking, recommendation, or consent. Candidate 360 continues to show learner and
employment linkage as not verified until a separate governed crosswalk exists.
