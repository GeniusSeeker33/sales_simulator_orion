// All interpolated SQL below consists of fixed, developer-owned fragments.
// Request values are exclusively bound parameters. No raw JSON columns leave SQL.
const provenance = alias => `${alias}.source_system, ${alias}.source_entity, ${alias}.source_id`;
const personFields = `p.id, p.first_name, p.last_name, p.preferred_name, p.email,
  p.phone, p.lifecycle_stage, p.created_at, ${provenance('p')}`;
const applicationFields = `a.id, a.person_id, a.application_type, a.status, a.job_ref,
  a.assigned_to, a.submitted_at, a.created_at, ${provenance('a')},
  (select nullif(trim(concat_ws(' ', recruiter.first_name, recruiter.last_name)), '')
    from crm.people recruiter where recruiter.workspace_id = a.workspace_id
    and recruiter.auth_user_id = a.assigned_to) as owner_name`;
const relevant = `(p.lifecycle_stage in ('applicant', 'candidate') or exists (
  select 1 from crm.applications c where c.workspace_id = p.workspace_id
  and c.person_id = p.id and c.application_type = 'candidate') or
  (p.lifecycle_stage in ('learner', 'employee') and p.source_system = 'join-orion'
    and p.source_entity = 'candidate_applications'))`;
// A row attached only to an application belongs in its person's history too.
// Conflicting explicit person attribution is never silently reassigned.
const related = alias => `(${alias}.person_id = p.id or (${alias}.person_id is null and exists (
  select 1 from crm.applications linked where linked.workspace_id = p.workspace_id
  and linked.person_id = p.id and linked.id = ${alias}.application_id)))`;
const taskFields = `jsonb_build_object('id', t.id, 'summary', t.summary,
  'due_at', case when jsonb_typeof(t.metadata->'due_at') = 'string' then t.metadata->>'due_at' end,
  'status', case when jsonb_typeof(t.metadata->'status') = 'string' then t.metadata->>'status' end,
  'completed_at', case when jsonb_typeof(t.metadata->'completed_at') = 'string' then t.metadata->>'completed_at' end)`;

export const TALENT_STAGES = ['lead', 'applicant', 'candidate', 'learner', 'employee', 'alumni', 'inactive'];
export const APPLICATION_STATUSES = ['draft', 'submitted', 'in_review', 'qualified', 'approved', 'rejected', 'withdrawn', 'hired', 'activated'];
export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function parseTalentQuery(query = {}) {
  const allowed = ['workspace_id', 'person_id', 'q', 'stage', 'status', 'owner', 'source', 'page', 'page_size'];
  if (Object.keys(query).some(key => !allowed.includes(key) || typeof query[key] !== 'string')) return null;
  const { workspace_id, person_id, q = '', stage = '', status = '', owner = '', source = '' } = query;
  if (workspace_id !== undefined && !isUuid(workspace_id) || person_id !== undefined && !isUuid(person_id)) return null;
  if (person_id && !workspace_id || q.length > 200 || source.length > 160) return null;
  if (stage && !TALENT_STAGES.includes(stage) || status && !APPLICATION_STATUSES.includes(status)) return null;
  if (owner && owner !== 'unassigned' && !isUuid(owner)) return null;
  const page = query.page ?? '1', pageSize = query.page_size ?? '25';
  if (!/^[1-9]\d{0,4}$/.test(page) || !/^[1-9]\d?$/.test(pageSize) || Number(pageSize) > 50) return null;
  return { workspace_id, person_id, q: q.trim(), stage, status, owner, source, page: Number(page), page_size: Number(pageSize) };
}

function dueTime(value) {
  // Explicit timezone only; malformed or impossible calendar dates are ignored.
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value.slice(0, 10) ? time : NaN;
}

export function attentionFor(row, now) {
  const reasons = [];
  const application = row.latest_application;
  if (!application?.assigned_to) reasons.push({ code: 'no_owner', text: application ? 'No recruiter is assigned to the latest candidate application.' : 'No candidate application exists to record a recruiter assignment.' });
  if (application?.status === 'submitted') reasons.push({ code: 'submitted', text: 'Latest candidate application is still submitted; review has not been recorded as a status change.' });
  const last = row.latest_activity_at || application?.submitted_at || application?.created_at || row.created_at;
  if (application?.status === 'in_review' && Date.parse(last) < now - 7 * 86400000) {
    reasons.push({ code: 'stale_review', text: 'Latest candidate application is in review with no recorded activity in the last 7 days.' });
  }
  const tasks = (row.tasks || []).filter(t => !['completed', 'done', 'cancelled'].includes(t.status) && !t.completed_at && Number.isFinite(dueTime(t.due_at)))
    .sort((a, b) => dueTime(a.due_at) - dueTime(b.due_at) || a.id.localeCompare(b.id));
  for (const task of tasks.filter(t => dueTime(t.due_at) < now)) reasons.push({ code: 'overdue_task', text: `Task “${task.summary}” was due ${task.due_at}.`, activity_id: task.id });
  return { attention: reasons, next_action: tasks[0] ? { summary: tasks[0].summary, due_at: tasks[0].due_at } : null };
}

export async function readTalent(query, human, options, now = Date.now()) {
  const workspaces = await query(`select w.id, w.name, m.role from crm.workspaces w
    join crm.workspace_members m on m.workspace_id = w.id where m.user_id = $1 order by w.name, w.id`, [human], 'workspace_lookup');
  const workspace = options.workspace_id ? workspaces.find(w => w.id === options.workspace_id) : workspaces[0];
  // "Missing" means not visible to this user, never a privileged existence probe.
  if (!workspace) return { status: 403, body: { error: 'CRM workspace membership required.' },
    diagnostic: workspaces.length ? 'crm_workspace_missing' : 'crm_membership_missing' };
  const workspaceId = workspace.id;
  if (options.person_id) {
    const [person] = await query(`select ${personFields} from crm.people p
      where p.workspace_id = $1 and p.id = $2 and ${relevant}`, [workspaceId, options.person_id]);
    if (!person) return { status: 404, body: { error: 'Candidate not found in this workspace.' } };
    const applications = await query(`select ${applicationFields} from crm.applications a
      where a.workspace_id = $1 and a.person_id = $2
      order by coalesce(a.submitted_at, a.created_at) desc, a.created_at desc, a.id desc`, [workspaceId, person.id]);
    const activities = await query(`select t.id, t.application_id, t.activity_type, t.direction, t.summary,
      t.occurred_at, ${provenance('t')}, ${taskFields} as task
      from crm.activities t join crm.people p on p.workspace_id = t.workspace_id and p.id = $2
      where t.workspace_id = $1 and ${related('t')} order by t.occurred_at desc, t.id desc`, [workspaceId, person.id]);
    const documents = await query(`select d.id, d.application_id, d.document_type, d.original_filename,
      d.created_at, ${provenance('d')} from crm.documents d
      join crm.people p on p.workspace_id = d.workspace_id and p.id = $2
      where d.workspace_id = $1 and ${related('d')} order by d.created_at desc, d.id desc`, [workspaceId, person.id]);
    const consent = await query(`select distinct on (c.channel, c.purpose) c.id, c.channel, c.purpose,
      c.status, c.captured_at, ${provenance('c')} from crm.consent_records c
      where c.workspace_id = $1 and c.person_id = $2 order by c.channel, c.purpose, c.captured_at desc, c.id desc`, [workspaceId, person.id]);
    const latest = applications.find(a => a.application_type === 'candidate') || null;
    const attention = attentionFor({ ...person, latest_application: latest, latest_activity_at: activities[0]?.occurred_at,
      tasks: activities.filter(a => a.activity_type === 'task').map(a => a.task) }, now);
    return { status: 200, body: { workspaces, workspace, person, applications, activities: activities.map(a => {
      const { task, ...activity } = a;
      return a.activity_type === 'task' ? { ...activity, task } : activity;
    }), documents, consent, ...attention,
    journey: { candidate: true, learner_linkage: 'not_verified', employment_linkage: 'not_verified' } } };
  }
  const params = [workspaceId, options.q, options.stage, options.status, options.owner, options.source];
  const candidateCte = `with candidates as (
    select ${personFields}, latest.application as latest_application, latest.assigned_to,
      latest.status as application_status, activity.latest_activity_at,
      coalesce(activity.latest_activity_at, latest.submitted_at, p.created_at) as sort_at
    from crm.people p
    left join lateral (select to_jsonb(safe_application) as application, safe_application.* from (
      select ${applicationFields} from crm.applications a where a.workspace_id = p.workspace_id
      and a.person_id = p.id and a.application_type = 'candidate'
      order by coalesce(a.submitted_at, a.created_at) desc, a.created_at desc, a.id desc limit 1) safe_application) latest on true
    left join lateral (select max(t.occurred_at) as latest_activity_at from crm.activities t
      where t.workspace_id = p.workspace_id and ${related('t')}) activity on true
    where p.workspace_id = $1 and ${relevant}
  ), filtered as (select * from candidates c where
    ($2 = '' or strpos(lower(concat_ws(' ', c.first_name, c.last_name, c.preferred_name, c.email)), lower($2)) > 0
      or exists (select 1 from crm.applications a where a.workspace_id = $1 and a.person_id = c.id
        and strpos(lower(coalesce(a.job_ref, '')), lower($2)) > 0))
    and ($3 = '' or c.lifecycle_stage = $3)
    and ($4 = '' or c.application_status = $4)
    and ($5 = '' or ($5 = 'unassigned' and c.assigned_to is null) or c.assigned_to::text = $5)
    and ($6 = '' or c.source_system = $6 or exists (select 1 from crm.applications a
      where a.workspace_id = $1 and a.person_id = c.id and a.source_system = $6)))`;
  const [counts] = await query(`${candidateCte} select (select count(*)::int from candidates) as workspace_total,
    (select count(*)::int from filtered) as total`, params);
  const rows = await query(`${candidateCte} select f.*,
    (select coalesce(jsonb_agg(${taskFields}), '[]') from crm.activities t
      join crm.people p on p.workspace_id = t.workspace_id and p.id = f.id
      where t.workspace_id = $1 and t.activity_type = 'task' and ${related('t')}) as tasks
    from filtered f order by f.sort_at desc, f.id desc limit $7 offset $8`,
  [...params, options.page_size, (options.page - 1) * options.page_size]);
  const candidates = rows.map(row => {
    const { tasks: _tasks, sort_at: _sort, assigned_to: _owner, application_status: _status, ...candidate } = row;
    return { ...candidate, ...attentionFor(row, now) };
  });
  const sources = await query(`select distinct source_system from (
    select p.source_system from crm.people p where p.workspace_id = $1 and ${relevant}
    union select a.source_system from crm.applications a join crm.people p on p.workspace_id = a.workspace_id and p.id = a.person_id
      where a.workspace_id = $1 and ${relevant}) s order by source_system`, [workspaceId]);
  const owners = await query(`select distinct a.assigned_to as id,
    nullif(trim(concat_ws(' ', recruiter.first_name, recruiter.last_name)), '') as name
    from crm.applications a left join crm.people recruiter
    on recruiter.workspace_id = a.workspace_id and recruiter.auth_user_id = a.assigned_to
    where a.workspace_id = $1 and a.application_type = 'candidate' and a.assigned_to is not null order by id`, [workspaceId]);
  return { status: 200, body: { workspaces, workspace, candidates, ...counts,
    page: options.page, page_size: options.page_size, sources: sources.map(s => s.source_system), owners } };
}
