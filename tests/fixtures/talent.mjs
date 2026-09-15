import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createTalentDatabase } from '../../api/_lib/talent-db.js';
export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const now = Date.parse('2026-09-14T12:00:00Z');
export async function talentFixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260913145543_unified_crm_foundation.sql', import.meta.url), 'utf8'));
  await db.query('insert into auth.users(id) values ($1),($2),($3),($4)', [id(1), id(2), id(3), id(4)]);
  await db.query(`insert into crm.workspaces(id,name,slug) values
    ($1,'Orion Talent','orion'),($2,'Foreign workspace','foreign'),($3,'Empty workspace','empty')`, [id(10), id(20), id(30)]);
  await db.query(`insert into crm.workspace_members(workspace_id,user_id,role) values
    ($1,$2,'viewer'),($3,$4,'manager'),($5,$2,'viewer')`, [id(10), id(1), id(20), id(2), id(30)]);
  const people = [
    [100, 10, 'Alex', 'Morgan', 'candidate', 'alex@example.test', 'candidate_applications'],
    [101, 10, 'Jordan', 'Lee', 'applicant', 'jordan@example.test', 'candidate_applications'],
    [102, 10, 'Taylor', 'Chen', 'learner', 'alex@example.test', 'candidate_applications'],
    [103, 10, 'Dealer', 'Only', 'lead', 'dealer@example.test', 'dealer_applications'],
    [104, 10, 'Lead', 'Applicant', 'lead', null, 'people'],
    [200, 20, 'Private', 'Candidate', 'candidate', 'foreign@example.test', 'candidate_applications'],
  ];
  for (const [pid, wid, first, last, lifecycle, email, source] of people) await db.query(`insert into crm.people
    (id,workspace_id,first_name,last_name,preferred_name,email,phone,lifecycle_stage,source_system,source_entity,source_id,created_at,attributes,auth_user_id)
    values ($1,$2,$3,$4,$3,$5,'555-0100',$6,'join-orion',$7,$8,'2026-08-01','{"private_note":"DO NOT EXPOSE"}',$9)`,
  [id(pid), id(wid), first, last, email, lifecycle, source, `candidate-${pid}`, pid === 102 ? id(1) : null]);
  await db.query(`insert into crm.people(workspace_id,first_name,last_name,auth_user_id,source_system,source_entity,source_id)
    values ($1,'Sam','Rivera',$2,'crm','workspace_profile','recruiter-4')`, [id(10), id(4)]);
  const apps = [
    [300, 10, 100, 'rejected', 'Sales Executive', 4, '2026-08-01', 'candidate'],
    [301, 10, 100, 'in_review', 'Production Assistant', 4, '2026-09-01', 'candidate'],
    [302, 10, 102, 'submitted', 'Operations Associate', null, '2026-09-12', 'candidate'],
    [303, 10, 104, 'submitted', 'Support Specialist', null, '2026-08-12', 'candidate'],
    [304, 10, 100, 'approved', 'Historical dealer intake', null, '2026-09-13', 'ffl_dealer'],
    [400, 20, 200, 'hired', 'Private job', 2, '2026-09-13', 'candidate'],
  ];
  for (const [aid, wid, pid, status, job, assigned, created, type] of apps) await db.query(`insert into crm.applications
    (id,workspace_id,person_id,application_type,status,job_ref,assigned_to,submitted_at,created_at,source_system,source_entity,source_id,payload_snapshot)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$8,'join-orion','candidate_applications',$9,'{"ssn":"SECRET SNAPSHOT","resume_url":"https://secret.invalid"}')`,
  [id(aid), id(wid), id(pid), type, status, job, assigned ? id(assigned) : null, created, `application-${aid}`]);
  // An older application imported later must not become the current application.
  await db.query('update crm.applications set created_at = $1 where id = $2', ['2026-09-14', id(300)]);
  const activities = [
    [500, 100, null, 'form_submission', 'Application received', '2026-09-01T10:00:00Z', {}],
    [501, null, 301, 'interview', 'Interview scheduled', '2026-09-02T10:00:00Z', {}],
    [502, 100, 301, 'task', 'Follow up with Alex', '2026-09-03T10:00:00Z', { due_at: '2026-09-10T10:00:00Z', status: 'open', secret: 'SECRET METADATA' }],
    [503, 100, null, 'task', 'Already done', '2026-09-03T09:00:00Z', { due_at: '2026-09-01T10:00:00Z', status: 'completed' }],
    [504, 100, null, 'task', 'Invalid due date', '2026-09-02T09:00:00Z', { due_at: '2026-02-30T10:00:00Z' }],
    [505, 102, null, 'note', 'Recent relationship note', '2026-09-13T10:00:00Z', {}],
    // Conflict: belongs to Jordan, never silently reassigned to Alex through application.
    [506, 101, 301, 'note', 'Explicit person wins', '2026-09-04T10:00:00Z', {}],
  ];
  for (const [aid, person, app, type, summary, occurred, metadata] of activities) await db.query(`insert into crm.activities
    (id,workspace_id,person_id,application_id,activity_type,summary,occurred_at,metadata,source_system,source_entity,source_id)
    values ($1,$2,$3,$4,$5,$6,$7,$8,'join-orion','candidate_activity',$9)`,
  [id(aid), id(10), person ? id(person) : null, app ? id(app) : null, type, summary, occurred, JSON.stringify(metadata), `activity-${aid}`]);
  await db.query(`insert into crm.documents(id,workspace_id,application_id,document_type,original_filename,storage_path,external_url,metadata,source_system,source_entity,source_id)
    values ($1,$2,$3,'resume','Alex resume.pdf','private/path','https://secret.invalid','{"token":"PRIVATE"}','join-orion','candidate_documents','resume-100')`, [id(600), id(10), id(301)]);
  await db.query(`insert into crm.consent_records(workspace_id,person_id,channel,purpose,status,captured_at,evidence,source_system,source_entity,source_id)
    values ($1,$2,'email','Recruiting','opted_in','2026-08-01','{"private":"PRIVATE"}','join-orion','consents','consent-old'),
      ($1,$2,'email','Recruiting','opted_out','2026-09-01','{}','join-orion','consents','consent-current')`, [id(10), id(100)]);
  // Same Auth subject/email and a verified learner binding STILL provide no CRM crosswalk.
  await db.exec(`create table public.learner_bindings (auth_user_id uuid, person_id uuid, verified_at timestamptz);
    revoke all on public.learner_bindings from authenticated;`);
  await db.query('insert into public.learner_bindings values ($1,$2,now())', [id(1), id(102)]);
  // Use the production role/context wrapper, replacing only the wire driver.
  const makePool = () => ({ begin: (_mode, read) => db.transaction(async tx => {
    await tx.exec('set transaction isolation level repeatable read read only');
    return read({ unsafe: async (text, values = []) => (await tx.query(text, values)).rows });
  }) });
  const withDatabase = createTalentDatabase({ makePool,
    environment: () => ({ CRM_DATABASE_URL: 'postgresql://postgres:synthetic@localhost/test' }) });
  return { db, withDatabase, makePool };
}
