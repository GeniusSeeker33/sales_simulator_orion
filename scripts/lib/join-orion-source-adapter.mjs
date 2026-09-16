export const JOIN_ORION_STATUS_VOCABULARY = Object.freeze({
  draft: 'draft',
  pending: 'submitted',
  submitted: 'submitted',
  reviewing: 'in_review',
  in_review: 'in_review',
  qualified: 'qualified',
  approved: 'approved',
  hired: 'hired',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
  new: 'submitted',
  screened: 'in_review',
  interviewing: 'in_review',
});

export const JOIN_ORION_ACTIVITY_VOCABULARY = Object.freeze({
  form_submission: 'form_submission',
  status_change: 'status_change',
  note: 'note',
  note_added: 'note',
  call: 'call',
  email: 'email',
  email_sent: 'email',
  meeting: 'meeting',
  interview: 'interview',
  interview_scheduled: 'interview',
  task: 'task',
  document: 'document',
  phone_call: 'call',
  notes_updated: 'note',
  status_updated: 'status_change',
  referral_submission: 'form_submission',
  advanced: 'status_change',
});

export const JOIN_ORION_ACTIVITY_LABELS = Object.freeze({
  interview: 'Interview',
  phone_call: 'Phone call',
  notes_updated: 'Notes updated',
  status_updated: 'Status updated',
  referral_submission: 'Referral submission',
  advanced: 'Advanced',
});

export const resumeProvenanceKey = applicationId => `candidate_applications/${applicationId}/resume_path`;

const rows = result => Array.isArray(result) ? result : result?.rows ?? [];
const value = input => input == null ? null : String(input);

/** Database-backed, read-only adapter for the verified Join-Orion candidate schema. */
export class JoinOrionSourceAdapter {
  constructor(query) {
    if (typeof query !== 'function') throw new Error('JoinOrionSourceAdapter requires a query function');
    this.query = query;
  }

  async read() {
    const applications = rows(await this.query(`select id::text, first_name, last_name, email, phone,
      position_id::text, position_title, status, created_at, source, recruiter, resume_path
      from public.candidate_applications order by created_at, id`));
    const activity = rows(await this.query(`select id::text, candidate_id::text, activity_type,
      activity_note, created_by, created_at from public.candidate_activity order by created_at, id`));

    return {
      contract_version: 1,
      source_vocabulary: {
        application_statuses: [...new Set(applications.map(row => row.status))].filter(value => value != null).sort(),
        activity_types: [...new Set(activity.map(row => row.activity_type))].filter(value => value != null).sort(),
      },
      applications: applications.map(row => ({
        source_id: value(row.id), identity_scope: 'application', first_name: row.first_name,
        last_name: row.last_name, email: row.email, phone: row.phone,
        status: JOIN_ORION_STATUS_VOCABULARY[row.status] ?? row.status,
        source_status: row.status, job_ref: value(row.position_id), submitted_at: row.created_at,
        source_created_at: row.created_at, source_updated_at: null, owner_ref: row.recruiter,
        payload: { position_title: row.position_title, application_source: row.source, source_status: row.status },
      })),
      activities: activity.map(row => ({
        source_id: value(row.id), identity_scope: 'application', application_source_id: value(row.candidate_id),
        type: JOIN_ORION_ACTIVITY_VOCABULARY[row.activity_type] ?? row.activity_type,
        source_type: row.activity_type, direction: 'internal',
        summary: typeof row.activity_note === 'string' && row.activity_note.trim()
          ? row.activity_note.trim()
          : JOIN_ORION_ACTIVITY_LABELS[row.activity_type] ?? String(row.activity_type).replaceAll('_', ' ').replace(/^./, char => char.toUpperCase()),
        occurred_at: row.created_at,
        metadata: { created_by: row.created_by, source_activity_type: row.activity_type },
      })),
      documents: applications.filter(row => row.resume_path).map(row => ({
        source_id: resumeProvenanceKey(value(row.id)), identity_scope: 'application', application_source_id: value(row.id),
        source_entity: 'candidate_application_resumes', document_type: 'resume',
        storage_path: row.resume_path, original_filename: null,
        metadata: { source_field: 'candidate_applications.resume_path' },
      })),
      consents: [],
    };
  }
}

export const createJoinOrionSourceAdapter = query => new JoinOrionSourceAdapter(query);
