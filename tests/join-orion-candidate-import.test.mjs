import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReconciliationReport, reconcileJoinOrionCandidates } from '../scripts/lib/join-orion-candidate-import.mjs';
import { JoinOrionSourceAdapter } from '../scripts/lib/join-orion-source-adapter.mjs';

const workspace = '00000000-0000-4000-8000-000000000010';
const foreign = '00000000-0000-4000-8000-000000000020';
const key = (entity, id) => `join-orion\u0000${entity}\u0000${id}`;
const application = (overrides = {}) => ({ source_id: 'app-1', source_identity_id: 'person-1', first_name: 'Ada', last_name: 'Lovelace',
  email: 'ada@example.test', status: 'submitted', job_ref: 'ROLE-1', submitted_at: '2026-01-01T12:00:00Z',
  source_created_at: '2026-01-01T11:00:00Z', source_updated_at: '2026-01-02T12:00:00Z', ...overrides });
const activity = (overrides = {}) => ({ source_id: 'activity-1', source_identity_id: 'person-1', application_source_id: 'app-1',
  type: 'form_submission', direction: 'inbound', summary: 'Applied', occurred_at: '2026-01-01T12:00:00Z', ...overrides });
const fixture = (overrides = {}) => ({ contract_version: 1, applications: [application()], activities: [activity()], documents: [], consents: [], ...overrides });

function memoryTarget(seed = {}) {
  const state = { provenance: new Set(seed.provenance ?? []), people: new Map(seed.people ?? []), applications: new Map(),
    writes: 0, foreignWrites: 0, fail: seed.fail };
  return { state,
    async getWorkspace(id) { return id === workspace ? { id, slug: 'orion', name: 'Orion' } : null; },
    async inspect(id) {
      const peopleByEmail = {}, peopleByProvenance = {};
      for (const [id, p] of state.people) {
        if (p.email) (peopleByEmail[p.email] ??= []).push(id);
        if (p.entity) peopleByProvenance[key(p.entity, p.sourceId)] = { id };
      }
      const applicationIds = Object.fromEntries([...state.applications].map(([id, a]) => [key('candidate_applications', a.sourceId), id]));
      return { workspace_id: id, provenance: new Set(state.provenance), people_by_email: peopleByEmail,
        people_by_provenance: peopleByProvenance, application_ids: applicationIds };
    },
    async apply({ workspaceId, operator, plan }) {
      assert.equal(workspaceId, workspace); assert.ok(operator);
      const next = { provenance: new Set(state.provenance), people: new Map(state.people), applications: new Map(state.applications) };
      let writes = 0;
      for (const p of plan.people) { next.provenance.add(key('candidate_applications', p.source_id)); next.people.set(`p-${p.source_id}`, { email: p.email?.toLowerCase(), entity: 'candidate_applications', sourceId: p.source_id }); writes++; }
      for (const a of plan.applications) { next.provenance.add(key('candidate_applications', a.source_id)); next.applications.set(`a-${a.source_id}`, { ...a, sourceId: a.source_id }); writes++; }
      for (const a of plan.activities) { next.provenance.add(key('candidate_activity', a.source_id)); writes++; }
      for (const d of plan.documents) { next.provenance.add(key(d.source_entity, d.source_id)); writes++; }
      for (const c of plan.consents) { next.provenance.add(key(c.source_entity, c.source_id)); writes++; }
      if (state.fail) throw new Error('simulated batch failure');
      Object.assign(state, next); state.writes += writes;
      return { writes, batches: [{ entity: 'all', attempted: writes, writes }] };
    } };
}
const run = (data, target, options = {}) => reconcileJoinOrionCandidates({ source: { read: async () => structuredClone(data) }, target,
  workspaceId: workspace, mode: options.mode ?? 'dry-run', operator: options.operator ?? null });

test('dry-run reports a complete plan and performs zero writes', async () => {
  const target = memoryTarget(); const report = await run(fixture(), target);
  assert.deepEqual(report.proposed, { people: 1, applications: 1, activities: 1, documents: 0, consents: 0 });
  assert.equal(report.writes_performed, 0); assert.equal(target.state.writes, 0);
  assert.match(formatReconciliationReport(report), /Mode: DRY RUN/); assert.equal(JSON.parse(JSON.stringify(report)).report_version, 1);
});

test('first apply imports records and the exact second import is idempotent', async () => {
  const target = memoryTarget();
  const first = await run(fixture(), target, { mode: 'apply', operator: 'ticket-44/alice' });
  assert.equal(first.writes_performed, 3);
  const second = await run(fixture(), target, { mode: 'apply', operator: 'ticket-44/alice' });
  assert.equal(second.writes_performed, 0); assert.equal(second.already_imported, 3); assert.equal(target.state.writes, 3);
  assert.deepEqual(second.already_imported_records.map(row => row.source_id).sort(), ['activity-1', 'app-1', 'person-1']);
});

test('multiple applications for one authoritative identity remain separate and preserve timestamps', async () => {
  const data = fixture({ applications: [application(), application({ source_id: 'app-2', status: 'in_review', submitted_at: '2026-02-01T12:00:00Z' })], activities: [] });
  const target = memoryTarget(); await run(data, target, { mode: 'apply', operator: 'bob' });
  assert.equal(target.state.people.size, 1); assert.equal(target.state.applications.size, 2);
  assert.equal(target.state.applications.get('a-app-1').source_created_at, '2026-01-01T11:00:00.000Z');
  assert.equal(target.state.applications.get('a-app-2').submitted_at, '2026-02-01T12:00:00.000Z');
});

test('application-scoped identity creates one person per application even when contact signals match', async () => {
  const scoped = sourceId => application({ source_id: sourceId, source_identity_id: undefined, identity_scope: 'application' });
  const data = fixture({ applications: [scoped('app-1'), scoped('app-2')], activities: [] });
  const target = memoryTarget(); const report = await run(data, target, { mode: 'apply', operator: 'ticket-46' });
  assert.equal(target.state.people.size, 2); assert.equal(target.state.applications.size, 2);
  assert.equal(report.inspected.identity_scope, 'application'); assert.equal(report.potential_duplicates.length, 2);
});

test('database source adapter maps verified fields, application activity, private resume metadata, and no consent', async () => {
  const statements = [];
  const adapter = new JoinOrionSourceAdapter(async sql => {
    statements.push(sql);
    if (sql.includes('candidate_applications')) return [{ id: 'app-db', first_name: 'A', last_name: 'B', email: 'a@b.test',
      phone: '555-1000', position_id: 'job-9', position_title: 'Sales Guide', status: 'pending',
      created_at: '2026-01-01T00:00:00Z', source: 'website', recruiter: 'Recruiter A', resume_path: 'private/app-db.pdf' }];
    return [{ id: 'act-db', candidate_id: 'app-db', activity_type: 'note_added', activity_note: 'Reviewed',
      created_by: 'Recruiter A', created_at: '2026-01-02T00:00:00Z' }];
  });
  const snapshot = await adapter.read();
  assert.equal(snapshot.applications[0].identity_scope, 'application');
  assert.equal(snapshot.applications[0].job_ref, 'job-9');
  assert.equal(snapshot.applications[0].payload.position_title, 'Sales Guide');
  assert.equal(snapshot.applications[0].status, 'submitted');
  assert.deepEqual(snapshot.source_vocabulary, { application_statuses: ['pending'], activity_types: ['note_added'] });
  assert.equal(snapshot.activities[0].application_source_id, 'app-db'); assert.equal(snapshot.activities[0].type, 'note');
  assert.equal(snapshot.documents[0].storage_path, 'private/app-db.pdf'); assert.deepEqual(snapshot.consents, []);
  assert.ok(statements.every(sql => !/dealer/i.test(sql)));
  const target = memoryTarget(); const report = await run(snapshot, target);
  assert.deepEqual(report.proposed, { people: 1, applications: 1, activities: 1, documents: 1, consents: 0 });
  assert.equal(report.writes_performed, 0); assert.equal(target.state.writes, 0);
  assert.deepEqual(report.inspected.source_vocabulary, snapshot.source_vocabulary);
  assert.equal(JSON.stringify(report).includes('private/app-db.pdf'), false);
});

test('distinct source identities sharing email enter human review and do not merge', async () => {
  const data = fixture({ applications: [application(), application({ source_id: 'app-2', source_identity_id: 'person-2', first_name: 'Grace' })], activities: [] });
  const target = memoryTarget(); const report = await run(data, target, { mode: 'apply', operator: 'carol' });
  assert.equal(target.state.people.size, 2); assert.equal(report.potential_duplicates.length, 2);
  assert.ok(report.potential_duplicates.every(item => item.recommended_action === 'review identity'));
});

test('matching email on unrelated CRM provenance is flagged without reuse', async () => {
  const target = memoryTarget({ people: [['existing', { email: 'ada@example.test', entity: 'other_source', sourceId: 'x' }]] });
  const report = await run(fixture(), target);
  assert.deepEqual(report.potential_duplicates[0].conflicting_crm_person_refs, ['existing']); assert.equal(report.proposed.people, 1);
});

test('invalid records and unknown statuses/types are not coerced', async () => {
  const data = fixture({ applications: [application({ source_id: null }), application({ source_id: 'unknown', status: 'invented' })],
    activities: [activity({ source_id: 'bad-time', occurred_at: 'never' }), activity({ source_id: 'unknown-type', type: 'ai_guess' })] });
  const report = await run(data, memoryTarget());
  assert.equal(report.invalid_records.length, 2); assert.equal(report.skipped_records.length, 2);
  assert.equal(report.proposed.applications, 0); assert.equal(report.proposed.activities, 0);
});

test('activity and application provenance are independent', async () => {
  const target = memoryTarget(); await run(fixture(), target, { mode: 'apply', operator: 'dana' });
  assert.ok(target.state.provenance.has(key('candidate_applications', 'app-1')));
  assert.ok(target.state.provenance.has(key('candidate_activity', 'activity-1')));
});

test('workspace isolation rejects missing and foreign workspace state', async () => {
  await assert.rejects(reconcileJoinOrionCandidates({ source: { read: async () => fixture() }, target: memoryTarget(), workspaceId: foreign }), /does not exist/);
  const target = memoryTarget(); target.inspect = async () => ({ workspace_id: foreign });
  await assert.rejects(run(fixture(), target), /foreign-workspace/); assert.equal(target.state.writes, 0);
});

test('apply requires explicit mode and operator and revalidates unchanged source', async () => {
  const target = memoryTarget(); await assert.rejects(run(fixture(), target, { mode: 'apply' }), /operator/);
  let reads = 0;
  await assert.rejects(reconcileJoinOrionCandidates({ source: { read: async () => (++reads === 1 ? fixture() : fixture({ activities: [] })) },
    target, workspaceId: workspace, mode: 'apply', operator: 'eve' }), /Source changed/);
  assert.equal(target.state.writes, 0);
});

test('failure rolls back the target batch', async () => {
  const target = memoryTarget({ fail: true });
  await assert.rejects(run(fixture(), target, { mode: 'apply', operator: 'frank' }), /simulated batch failure/);
  assert.equal(target.state.writes, 0); assert.equal(target.state.provenance.size, 0);
});

test('does not infer learner identity or blanket consent', async () => {
  const target = memoryTarget(); const report = await run(fixture(), target, { mode: 'apply', operator: 'gia' });
  assert.equal(report.proposed.consents, 0);
  assert.ok([...target.state.people.values()].every(person => !('auth_user_id' in person) && !('learner_id' in person)));
});

test('documents require an opaque path and verified entity; private URLs are rejected', async () => {
  const documents = [
    { source_id: 'doc-1', source_identity_id: 'person-1', source_entity: 'verified_candidate_documents', document_type: 'resume', storage_path: 'candidate/person-1/resume.pdf', original_filename: 'resume.pdf' },
    { source_id: 'doc-2', source_identity_id: 'person-1', source_entity: 'verified_candidate_documents', document_type: 'resume', storage_path: 'https://private.invalid/resume.pdf' },
  ];
  const report = await run(fixture({ documents }), memoryTarget());
  assert.equal(report.proposed.documents, 1); assert.equal(report.invalid_records.length, 1);
  assert.equal(JSON.stringify(report).includes('private.invalid'), false);
});

test('consent imports only with actual evidence and report counts remain consistent', async () => {
  const consents = [
    { source_id: 'c-1', source_identity_id: 'person-1', source_entity: 'verified_consents', channel: 'email', status: 'opted_in', purpose: 'recruiting', captured_at: '2026-01-01T12:00:00Z', evidence: { form_revision: '2' } },
    { source_id: 'c-2', source_identity_id: 'person-1', source_entity: 'verified_consents', channel: 'email', status: 'opted_in', purpose: 'marketing', captured_at: '2026-01-01T12:00:00Z', evidence: {} },
  ];
  const report = await run(fixture({ consents }), memoryTarget());
  assert.equal(report.inspected.source_consents, 2); assert.equal(report.proposed.consents, 1); assert.equal(report.invalid_records.length, 1);
  assert.match(report.run_id, /^join-orion-[a-f0-9]{20}-dry-run$/);
});
