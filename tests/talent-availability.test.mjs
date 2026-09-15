import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { createTalentDatabase, validateCrmUrl } from '../api/_lib/talent-db.js';
import { TalentFailure, logTalentDiagnostic } from '../api/_lib/talent-diagnostics.js';
import { createHandler } from '../api/talent.js';
import { talentFixture, id } from './fixtures/talent.mjs';

const uri = 'postgresql://postgres.projectref:p%40ss%3Aword@pooler.example.test:6543/postgres';
const secret = 'DO-NOT-LOG-password-token-candidate';
const rawError = code => Object.assign(new Error(secret), { code, detail: secret, query: secret, parameters: [secret], cause: new Error(secret) });
const environment = () => ({ CRM_DATABASE_URL: uri });
let fixture;
before(async () => {
  fixture = await talentFixture();
  process.env.LEARNER_SUPABASE_URL = 'https://synthetic.invalid';
  process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY = 'synthetic';
});
after(async () => { await fixture?.db.close(); });

function fakePool({ failAt, code = '42501', context } = {}) {
  const calls = [];
  let options, creations = 0;
  return {
    calls, get options() { return options; }, get creations() { return creations; },
    makePool: (_url, opts) => {
      options = opts; creations++;
      if (failAt === 'create') throw rawError(code);
      return { begin: async (mode, read) => {
        calls.push({ mode });
        if (failAt === 'begin') throw rawError(code);
        const result = await read({ unsafe: async (text, parameters) => {
          calls.push({ text, parameters });
          if (text.includes(failAt)) throw rawError(code);
          if (text.includes('as role_ok')) return [context || { role_ok: true, subject_ok: true, read_only: true }];
          if (text.includes('from crm.workspaces')) return [{ id: id(10), name: 'Synthetic CRM', role: 'viewer' }];
          return [];
        } });
        if (failAt === 'commit') throw rawError(code);
        return result;
      } };
    },
  };
}
async function invoke(withDatabase, { token = 'valid', auth, query = {}, envMissing = false } = {}) {
  const events = [];
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const handler = createHandler({ withDatabase, log: event => events.push(event), makeClient: () => ({ auth: {
    getUser: auth || (async () => ({ data: { user: { id: id(1) } } })),
  } }) });
  const saved = process.env.LEARNER_SUPABASE_URL;
  if (envMissing) delete process.env.LEARNER_SUPABASE_URL;
  try { await handler({ method: 'GET', query, headers: { authorization: token ? `Bearer ${token}` : '' } }, response); }
  finally { process.env.LEARNER_SUPABASE_URL = saved; }
  return { ...response, events };
}

test('missing/malformed database configuration is categorized without exposing input or opening a pool', async () => {
  for (const [value, category] of [[undefined, 'crm_not_configured'], ['', 'crm_not_configured'],
    [secret, 'crm_configuration_invalid'], ['https://user:password@host/db', 'crm_configuration_invalid'],
    ['postgresql://postgres:p%ZZ@host/db', 'crm_configuration_invalid'], [`${uri}#${secret}`, 'crm_configuration_invalid'],
    ['postgresql://postgres:password@host', 'crm_configuration_invalid'], [` ${uri}`, 'crm_configuration_invalid']]) {
    const pool = fakePool();
    const response = await invoke(createTalentDatabase({ makePool: pool.makePool, environment: () => ({ CRM_DATABASE_URL: value }) }));
    assert.equal(response.code, 503);
    assert.equal(response.events[0].category, category);
    assert.equal(pool.creations, 0);
    assert.ok(!JSON.stringify(response).includes(secret));
    assert.ok(!JSON.stringify(response).includes('postgresql://'));
  }
  assert.equal(validateCrmUrl(uri), uri);
});
test('driver keeps verified TLS, optional PEM CA, and transaction-pooler-safe options', async () => {
  for (const ca of [undefined, 'SYNTHETIC-PEM']) {
    const pool = fakePool();
    const database = createTalentDatabase({ makePool: pool.makePool, environment: () => ({ CRM_DATABASE_URL: uri, CRM_DATABASE_CA_CERT: ca }) });
    await database(id(1), async () => 'ok');
    await database(id(2), async () => 'ok');
    assert.equal(pool.creations, 1);
    assert.deepEqual(pool.options.ssl, { rejectUnauthorized: true, ...(ca ? { ca } : {}) });
    assert.equal(pool.options.prepare, false);
    assert.equal(pool.options.connect_timeout, 10);
    assert.equal(typeof pool.options.onnotice, 'function');
    assert.equal(pool.calls[0].mode, 'isolation level repeatable read read only');
    assert.equal(pool.calls[1].text, 'set local role authenticated');
    assert.ok(pool.calls.some(c => c.text?.includes('request.jwt.claims') && JSON.parse(c.parameters[0]).sub === id(2)));
  }
  // Exercise the installed parser without connecting: URL flags cannot weaken our explicit TLS option.
  const driver = postgres(`${uri}?sslmode=require`, { ssl: { rejectUnauthorized: true }, prepare: false });
  assert.equal(driver.options.ssl.rejectUnauthorized, true);
  assert.equal(driver.options.user, 'postgres.projectref');
  assert.equal(driver.options.pass, 'p@ss:word');
  await driver.end();
});
test('every connection/role/context/query/commit failure logs only an allowlisted category, stage and code', async () => {
  const cases = [
    ['create', 'unknown', 'crm_configuration_invalid', 'configuration'],
    ['begin', 'SELF_SIGNED_CERT_IN_CHAIN', 'crm_connection_failed', 'transaction_begin'],
    ['begin', '28P01', 'crm_connection_failed', 'transaction_begin'],
    ['begin', 'CONNECT_TIMEOUT', 'crm_connection_failed', 'transaction_begin'],
    ['set local role', '42501', 'crm_role_assumption_failed', 'role_assumption'],
    ['request.jwt.claim.sub', '42501', 'crm_auth_context_failed', 'auth_context'],
    ['request.jwt.claims', '42501', 'crm_auth_context_failed', 'auth_context'],
    ['statement_timeout', '42501', 'crm_auth_context_failed', 'auth_context'],
    ['as role_ok', '42883', 'crm_auth_context_failed', 'auth_context'],
    ['from crm.workspaces', '42P01', 'crm_query_failed', 'workspace_lookup'],
    ['from crm.workspaces', '42501', 'crm_query_failed', 'workspace_lookup'],
    ['from crm.workspaces', 'ECONNRESET', 'crm_connection_failed', 'workspace_lookup'],
    ['from crm.people', '57014', 'crm_query_failed', 'candidate_read'],
    ['commit', 'ECONNRESET', 'crm_connection_failed', 'transaction_commit'],
  ];
  for (const [failAt, code, category, stage] of cases) {
    const pool = fakePool({ failAt, code });
    const response = await invoke(createTalentDatabase({ makePool: pool.makePool, environment }));
    assert.equal(response.code, 503, failAt);
    assert.equal(response.events.length, 1);
    assert.equal(response.events[0].category, category);
    assert.equal(response.events[0].stage, stage);
    assert.ok(!JSON.stringify(response).includes(secret));
    assert.ok(!JSON.stringify(response).includes(uri));
    assert.deepEqual(Object.keys(response.events[0]).sort(), code === 'unknown' ? ['category', 'event', 'stage'] : ['category', 'code', 'event', 'stage']);
  }
});
test('incorrect database role, null/wrong Auth UID, or writable context fails closed before CRM reads', async () => {
  for (const field of ['role_ok', 'subject_ok', 'read_only']) {
    const pool = fakePool({ context: { role_ok: true, subject_ok: true, read_only: true, [field]: null } });
    const response = await invoke(createTalentDatabase({ makePool: pool.makePool, environment }));
    assert.equal(response.code, 503);
    assert.equal(response.events[0].category, 'crm_auth_context_failed');
    assert.ok(!pool.calls.some(c => c.text?.includes('crm.workspaces')));
  }
});
test('real CRM RLS distinguishes missing authorization (403), missing candidate (404), and empty authorized workspace (200)', async () => {
  const noMembership = await invoke(fixture.withDatabase, { auth: async () => ({ data: { user: { id: id(3) } } }) });
  assert.equal(noMembership.code, 403);
  assert.equal(noMembership.events[0].category, 'crm_membership_missing');
  for (const workspace_id of [id(20), id(999)]) {
    const result = await invoke(fixture.withDatabase, { query: { workspace_id } });
    assert.equal(result.code, 403);
    assert.equal(result.events[0].category, 'crm_workspace_missing');
    assert.deepEqual(result.body, noMembership.body);
    assert.ok(!JSON.stringify(result.events).includes(workspace_id));
  }
  const missing = await invoke(fixture.withDatabase, { query: { workspace_id: id(10), person_id: id(200) } });
  assert.equal(missing.code, 404);
  assert.deepEqual(missing.events, []);
  const empty = await invoke(fixture.withDatabase, { query: { workspace_id: id(30) } });
  assert.equal(empty.code, 200);
  assert.deepEqual(empty.body.candidates, []);
  assert.deepEqual(empty.events, []);
});
test('actual role/context wrapper resets identity on commit and rollback and retains read-only enforcement', async () => {
  for (const user of [id(1), id(2), id(1)]) {
    const result = await fixture.withDatabase(user, query => query('select current_user as role, auth.uid() as uid'));
    assert.deepEqual(result, [{ role: 'authenticated', uid: user }]);
    const outside = (await fixture.db.query('select current_user as role, auth.uid() as uid')).rows[0];
    assert.notEqual(outside.role, 'authenticated');
    assert.equal(outside.uid, null);
  }
  await assert.rejects(fixture.withDatabase(id(1), query => query('delete from crm.people')), error => error.category === 'crm_query_failed');
  assert.equal((await fixture.db.query('select auth.uid() as uid')).rows[0].uid, null);
});
test('an ungranted database login cannot assume authenticated; no privileged fallback executes', async () => {
  const { db } = await talentFixture();
  await db.exec('create role no_crm_assumption nologin; set session authorization no_crm_assumption');
  let read = false;
  const withDatabase = createTalentDatabase({ environment, makePool: () => ({ begin: (_mode, callback) => db.transaction(async tx => {
    await tx.exec('set transaction read only');
    return callback({ unsafe: async (text, values = []) => (await tx.query(text, values)).rows });
  }) }) });
  try {
    await assert.rejects(withDatabase(id(1), async () => { read = true; }), error => error.category === 'crm_role_assumption_failed' && error.code === '42501');
  } finally {
    // A separate test database emulates a physical connection with this login.
    await db.close();
  }
  assert.equal(read, false);
});
test('a non-superuser connection role granted authenticated can use the production wrapper with RLS', async () => {
  const { db } = await talentFixture();
  await db.exec('create role granted_crm_login nologin noinherit; grant authenticated to granted_crm_login; set session authorization granted_crm_login');
  const database = createTalentDatabase({ environment, makePool: () => ({ begin: (_mode, callback) => db.transaction(async tx => {
    await tx.exec('set transaction read only');
    return callback({ unsafe: async (text, values = []) => (await tx.query(text, values)).rows });
  }) }) });
  try {
    const people = await database(id(1), query => query('select workspace_id from crm.people'));
    assert.ok(people.length > 0);
    assert.ok(people.every(person => person.workspace_id === id(10)));
  } finally { await db.close(); }
});
test('auth setup/transport failures are 503, while invalid or missing credentials stay 401', async () => {
  let databaseCalls = 0;
  const database = async () => { databaseCalls++; };
  assert.equal((await invoke(database, { envMissing: true })).events[0].category, 'auth_not_configured');
  for (const auth of [async () => { throw rawError('ECONNRESET'); },
    async () => ({ error: { status: 503, message: secret } }),
    async () => ({ error: { name: 'AuthRetryableFetchError', message: secret } })]) {
    const response = await invoke(database, { auth });
    assert.equal(response.code, 503);
    assert.equal(response.events[0].category, 'auth_verification_failed');
    assert.ok(!JSON.stringify(response).includes(secret));
  }
  assert.equal((await invoke(database, { token: '' })).code, 401);
  assert.equal((await invoke(database, { auth: async () => ({ error: { status: 401 } }) })).code, 401);
  assert.equal(databaseCalls, 0);
});
test('diagnostic serialization rejects arbitrary error fields/codes and logger failures cannot change control flow', () => {
  const events = [];
  logTalentDiagnostic(event => events.push(event), rawError(secret));
  logTalentDiagnostic(event => events.push(event), new TalentFailure(secret, secret, rawError(secret)));
  assert.ok(!JSON.stringify(events).includes(secret));
  assert.doesNotThrow(() => logTalentDiagnostic(() => { throw rawError(secret); }, rawError(secret)));
});
