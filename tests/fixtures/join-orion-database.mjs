const statuses = ['new', 'screened', 'interviewing', 'hired'];
const activityTypes = ['advanced', 'interview', 'notes_updated', 'phone_call', 'referral_submission', 'status_updated'];

/** Synthetic rows with the exact value types and columns returned by postgres.js. */
export const joinOrionDatabaseRows = () => {
  const applications = Array.from({ length: 15 }, (_, index) => ({
    id: `00000000-0000-4000-8001-${String(index + 1).padStart(12, '0')}`,
    first_name: index < 2 ? 'Alex' : `Candidate${index + 1}`,
    last_name: index < 2 ? 'Example' : 'Synthetic',
    email: index < 2 ? 'duplicate@example.test' : `candidate${index + 1}@example.test`,
    phone: index < 2 ? '+1 (555) 010-1000' : `+1 555 010-${String(1000 + index)}`,
    position_id: `10000000-0000-4000-8000-${String((index % 3) + 1).padStart(12, '0')}`,
    position_title: 'Synthetic role', status: statuses[index % statuses.length],
    created_at: new Date(Date.UTC(2026, 7, index + 1, 12)), source: 'synthetic-fixture',
    recruiter: 'Fixture recruiter', resume_path: index < 5 ? `private/resumes/application-${index + 1}.pdf` : null,
  }));
  const activities = Array.from({ length: 9 }, (_, index) => ({
    id: `20000000-0000-4000-8002-${String(index + 1).padStart(12, '0')}`,
    candidate_id: applications[index].id, activity_type: activityTypes[index % activityTypes.length],
    activity_note: index === 0 ? 'Candidate advanced after review.' : null,
    created_by: 'Fixture recruiter', created_at: new Date(Date.UTC(2026, 7, index + 2, 12)),
  }));
  return { applications, activities };
};
