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

Document provenance is `join-orion / candidate_application_resumes / <application
id>`. Candidate 360 projects document type and filename but never storage path or
metadata. The source produces an empty `consents` array: submitting an application
is not marketing consent.

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

## Status and activity vocabulary

The safe categorical inspection observed/approved the following application
vocabulary and mappings:

| Source | CRM |
| --- | --- |
| `pending` | `submitted` |
| `reviewing` | `in_review` |
| `draft`, `submitted`, `in_review`, `qualified`, `approved`, `rejected`, `withdrawn`, `hired` | same semantic value |

The observed/approved activity mapping is:

| Source | CRM |
| --- | --- |
| `note_added` | `note` |
| `email_sent` | `email` |
| `interview_scheduled` | `interview` |
| `form_submission`, `status_change`, `note`, `call`, `email`, `meeting`, `interview`, `task`, `document` | same semantic value |

The adapter retains the original categorical value alongside its mapped value.
Any value not in these explicit maps flows unchanged into reconciliation, where it
is skipped and reported as `source_status` or `source_type`; it is never coerced.
The report contains counts and categorical ambiguity, not candidate row samples.

## Privacy and domain boundaries

The adapter selects only the columns required above. It does not select cover
letters, application notes, admin notes, referral/payment data, or job-posting
content. Protected payload snapshots and activity metadata are not included in
Candidate 360 list projections. Resume paths are neither printed in reconciliation
reports nor exposed by Talent APIs.

The import creates no Auth identity, learner binding, employment binding, score,
ranking, recommendation, or consent. Candidate 360 continues to show learner and
employment linkage as not verified until a separate governed crosswalk exists.
