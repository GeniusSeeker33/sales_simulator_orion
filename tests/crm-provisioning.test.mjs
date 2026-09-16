import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { provisionOrionWorkspace } from '../scripts/provision-crm-workspace.mjs';

const migrationUrl = new URL('../supabase/migrations/20260913145543_unified_crm_foundation.sql', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  await db.exec(await readFile(migrationUrl, 'utf8'));
  return db;
}

const queryFor = (db) => (statement, parameters = []) => db.query(statement, parameters);
const provision = (db, userIdentifier = 'operator@example.com', options = {}) =>
  provisionOrionWorkspace(queryFor(db), { userIdentifier, performedBy: 'test-change-123', ...options });

async function addUser(db, userId = id(1), email = 'operator@example.com') {
  await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, email]);
}

test('creates the canonical Orion workspace on the first run', async () => {
  const db = await setup();
  await addUser(db);
  const result = await provision(db);
  assert.equal(result.workspace.name, 'Orion');
  assert.equal(result.workspace.slug, 'orion');
  assert.equal(result.workspace.created, true);
  assert.equal((await db.query('select * from crm.workspaces')).rows.length, 1);
  await db.close();
});

test('an idempotent rerun does not duplicate workspace or membership', async () => {
  const db = await setup();
  await addUser(db);
  const first = await provision(db);
  const second = await provision(db);
  assert.equal(second.workspace.id, first.workspace.id);
  assert.equal(second.workspace.created, false);
  assert.equal(second.membership.created, false);
  assert.equal((await db.query('select * from crm.workspaces')).rows.length, 1);
  assert.equal((await db.query('select * from crm.workspace_members')).rows.length, 1);
  await db.close();
});

test('grants the first explicitly identified Auth user admin membership', async () => {
  const db = await setup();
  await addUser(db);
  const result = await provision(db, id(1));
  const memberships = await db.query('select workspace_id, user_id, role from crm.workspace_members');
  assert.deepEqual(memberships.rows, [{ workspace_id: result.workspace.id, user_id: id(1), role: 'admin' }]);
  assert.equal(result.membership.created, true);
  await db.close();
});

test('the membership primary key protects against duplicates', async () => {
  const db = await setup();
  await addUser(db);
  const result = await provision(db);
  await assert.rejects(
    db.query("insert into crm.workspace_members(workspace_id, user_id, role) values ($1, $2, 'admin')", [result.workspace.id, id(1)]),
    /unique|duplicate/i,
  );
  await db.close();
});

test('rejects an identifier that does not resolve to an Auth user', async () => {
  const db = await setup();
  await assert.rejects(provision(db, 'missing@example.com'), /No Supabase Auth user matches/);
  assert.equal((await db.query('select * from crm.workspaces')).rows.length, 0);
  await db.close();
});

test('does not attach the user to another workspace', async () => {
  const db = await setup();
  await addUser(db);
  await db.query("insert into crm.workspaces(id, name, slug) values ($1, 'Foreign', 'foreign')", [id(20)]);
  const result = await provision(db);
  const memberships = await db.query('select workspace_id from crm.workspace_members');
  assert.deepEqual(memberships.rows, [{ workspace_id: result.workspace.id }]);
  assert.notEqual(result.workspace.id, id(20));
  await db.close();
});

test('preserves an existing role rather than silently overwriting it', async () => {
  const db = await setup();
  await addUser(db);
  await db.query("insert into crm.workspaces(id, name, slug) values ($1, 'Orion', 'orion')", [id(10)]);
  await db.query("insert into crm.workspace_members(workspace_id, user_id, role) values ($1, $2, 'manager')", [id(10), id(1)]);
  const result = await provision(db);
  assert.equal(result.membership.role, 'manager');
  assert.equal(result.membership.requestedRole, 'admin');
  assert.equal(result.membership.existingRolePreserved, true);
  assert.equal((await db.query('select role from crm.workspace_members')).rows[0].role, 'manager');
  await db.close();
});
