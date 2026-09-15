import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/talent.js';
import { attentionFor, parseTalentQuery } from '../api/_lib/talent-read.js';
import { talentFixture, id, now } from './fixtures/talent.mjs';
let fixture, handler;
before(async () => {
  fixture = await talentFixture();
  process.env.LEARNER_SUPABASE_URL = 'https://synthetic.invalid';
  process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY = 'synthetic-public';
  handler = createHandler({ withDatabase: fixture.withDatabase, now: () => now, makeClient: () => ({ auth: {
    getUser: async token => ({ data: { user: token === 'bad' ? null : { id: id(Number(token)), is_anonymous: token === '4' } } }),
  } }) });
});
after(async () => { await fixture?.db.close(); });
async function request(query = {}, token = '1', method = 'GET', target = handler) {
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await target({ method, headers: { authorization: token ? `Bearer ${token}` : '' }, query }, response);
  return response;
}
test('authenticated workspace list is scoped, distinct per person and sorted by latest activity', async () => {
  const res = await request({ workspace_id: id(10) });
  assert.equal(res.code, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.body.total, 4);
  assert.deepEqual(res.body.candidates.map(p => p.id), [id(102), id(101), id(100), id(104)]);
  assert.deepEqual(res.body.workspaces.map(w => w.id).sort(), [id(10), id(30)]);
  assert.equal(new Set(res.body.candidates.map(p => p.id)).size, 4);
  assert.ok(!JSON.stringify(res.body).includes('Private'));
});
test('foreign workspace and arbitrary person IDs cannot bypass membership or workspace scoping', async () => {
  assert.equal((await request({ workspace_id: id(20) })).code, 403);
  assert.equal((await request({ workspace_id: id(10), person_id: id(200) })).code, 404);
  assert.equal((await request({ workspace_id: id(20), person_id: id(100) }, '2')).code, 404);
  assert.equal((await request({}, '3')).code, 403);
});
test('multiple Join-Orion applications preserve history, independent lifecycle, provenance and latest candidate status', async () => {
  const { body } = await request({ workspace_id: id(10), person_id: id(100) });
  assert.equal(body.person.lifecycle_stage, 'candidate');
  assert.deepEqual(body.applications.map(a => a.id), [id(304), id(301), id(300)]);
  assert.equal(body.applications[2].status, 'rejected');
  assert.equal(body.applications[1].status, 'in_review');
  assert.equal(body.applications[2].source_id, 'application-300');
  assert.ok(body.applications.every(a => a.source_system === 'join-orion'));
  const list = await request({ workspace_id: id(10), q: 'Alex Morgan' });
  assert.equal(list.body.candidates[0].latest_application.id, id(301));
  assert.equal(list.body.candidates[0].latest_application.owner_name, 'Sam Rivera');
  assert.equal(list.body.candidates[0].lifecycle_stage, 'candidate');
});
test('timeline is newest first, deduplicates person/application association and includes application-only events', async () => {
  const { body } = await request({ workspace_id: id(10), person_id: id(100) });
  assert.deepEqual(body.activities.map(a => a.id), [id(502), id(503), id(501), id(504), id(500)]);
  assert.ok(body.activities.every(a => a.source_entity === 'candidate_activity'));
  assert.equal(body.activities[0].source_id, 'activity-502');
  assert.equal(body.documents[0].original_filename, 'Alex resume.pdf');
  assert.equal(body.consent.length, 1);
  assert.equal(body.consent[0].status, 'opted_out');
});
test('safe projections exclude payloads, private JSON, auth subjects, evidence and storage locations', async () => {
  for (const query of [{ workspace_id: id(10) }, { workspace_id: id(10), person_id: id(100) }]) {
    const serialized = JSON.stringify((await request(query)).body);
    for (const secret of ['payload_snapshot', 'SECRET', 'attributes', 'auth_user_id', 'private/path', 'external_url', 'storage_path', 'PRIVATE', 'secret.invalid']) assert.ok(!serialized.includes(secret), secret);
  }
});
test('same email, auth subject, lifecycle and learner person ID do not auto-link', async () => {
  for (const pid of [100, 102]) {
    const { body, code } = await request({ workspace_id: id(10), person_id: id(pid) });
    assert.equal(code, 200);
    assert.deepEqual(body.journey, { candidate: true, learner_linkage: 'not_verified', employment_linkage: 'not_verified' });
  }
});
test('attention reasons are deterministic and explain overdue/stale/submitted/unassigned conditions', async () => {
  const { body } = await request({ workspace_id: id(10), person_id: id(100) });
  assert.deepEqual(body.attention.map(a => a.code), ['stale_review', 'overdue_task']);
  assert.match(body.attention[0].text, /7 days/);
  assert.match(body.attention[1].text, /2026-09-10T10:00:00Z/);
  assert.equal(body.next_action.summary, 'Follow up with Alex');
  const submitted = await request({ workspace_id: id(10), person_id: id(102) });
  assert.deepEqual(submitted.body.attention.map(a => a.code), ['no_owner', 'submitted']);
  assert.deepEqual(attentionFor({ tasks: [{ id: '1', due_at: 'nonsense' }] }, now).next_action, null);
});
test('search covers name, preferred name, email and historical job references; filters and pagination are server applied', async () => {
  for (const q of ['Alex Morgan', 'alex@example.test', 'Sales Executive']) {
    const res = await request({ workspace_id: id(10), q });
    assert.ok(res.body.candidates.some(p => p.id === id(100)));
  }
  const res = await request({ workspace_id: id(10), stage: 'candidate', status: 'in_review', owner: id(4), source: 'join-orion' });
  assert.deepEqual(res.body.candidates.map(p => p.id), [id(100)]);
  const unassigned = await request({ workspace_id: id(10), owner: 'unassigned' });
  assert.equal(unassigned.body.total, 3);
  const page1 = await request({ workspace_id: id(10), page_size: '2' });
  const page2 = await request({ workspace_id: id(10), page_size: '2', page: '2' });
  assert.equal(page1.body.total, 4);
  assert.equal(new Set([...page1.body.candidates, ...page2.body.candidates].map(p => p.id)).size, 4);
  assert.equal((await request({ workspace_id: id(10), q: "%' OR 1=1 --" })).body.total, 0);
  assert.equal((await request({ workspace_id: id(10), source: 'foreign' })).body.total, 0);
});
test('candidate without applications and empty CRM remain useful states', async () => {
  const noApps = await request({ workspace_id: id(10), person_id: id(101) });
  assert.equal(noApps.code, 200);
  assert.deepEqual(noApps.body.applications, []);
  const empty = await request({ workspace_id: id(30) });
  assert.equal(empty.code, 200);
  assert.equal(empty.body.workspace_total, 0);
  assert.deepEqual(empty.body.candidates, []);
});
test('missing/invalid/anonymous sessions denied; write methods and malformed input rejected', async () => {
  for (const token of ['', 'bad', '4']) assert.equal((await request({}, token)).code, 401);
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal((await request({}, '1', method)).code, 405);
  for (const query of [{ page: '0' }, { page_size: '51' }, { workspace_id: 'bad' }, { person_id: id(100) }, { owner: 'bad' }, { stage: 'hired' }, { status: 'candidate' }, { q: ['a'] }, { source: 'x'.repeat(161) }, { unknown: 'x' }]) {
    assert.equal(parseTalentQuery(query), null);
    assert.equal((await request(query)).code, 400);
  }
});
test('database failures are generic and read transaction cannot write', async () => {
  const failing = createHandler({ makeClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: id(1) } } }) } }), withDatabase: async () => { throw new Error('SECRET credential'); } });
  const res = await request({}, '1', 'GET', failing);
  assert.equal(res.code, 503);
  assert.ok(!JSON.stringify(res.body).includes('SECRET'));
  await assert.rejects(fixture.withDatabase(id(1), query => query('delete from crm.people')),
    error => error.category === 'crm_query_failed' && ['25006', '42501'].includes(error.code));
});
