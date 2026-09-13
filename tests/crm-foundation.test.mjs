import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../supabase/migrations/20260913145543_unified_crm_foundation.sql', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await db.exec(await readFile(migrationUrl, 'utf8'));
  return db;
}

async function asUser(db, user) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
}

test('CRM tables enable RLS and deny anonymous access', async () => {
  const db = await setup();
  const tables = await db.query(`
    select relname, relrowsecurity
    from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where nspname = 'crm' and relkind = 'r'
  `);
  assert.equal(tables.rows.length, 10);
  assert.ok(tables.rows.every((row) => row.relrowsecurity));
  await asUser(db, null);
  await assert.rejects(db.query('select * from crm.people'), /permission denied/);
  await db.close();
});

test('workspace members can read only their workspace records', async () => {
  const db = await setup();
  await db.exec('reset role');
  await db.query('insert into auth.users(id) values ($1),($2)', [id(1), id(2)]);
  await db.query("insert into crm.workspaces(id,name,slug) values ($1,'Orion','orion'),($2,'Other','other')", [id(10), id(20)]);
  await db.query("insert into crm.workspace_members(workspace_id,user_id,role) values ($1,$2,'admin')", [id(10), id(1)]);
  await db.query(`insert into crm.people(workspace_id,first_name,email,source_system,source_entity,source_id)
    values ($1,'Visible','visible@example.com','test','people','visible'),
           ($2,'Hidden','hidden@example.com','test','people','hidden')`, [id(10), id(20)]);
  await asUser(db, id(1));
  const people = await db.query('select first_name from crm.people order by first_name');
  assert.deepEqual(people.rows, [{ first_name: 'Visible' }]);
  await asUser(db, id(2));
  assert.equal((await db.query('select * from crm.people')).rows.length, 0);
  await db.close();
});

test('legacy source references prevent duplicate imports', async () => {
  const db = await setup();
  await db.exec('reset role');
  await db.query("insert into crm.workspaces(id,name,slug) values ($1,'Orion','orion')", [id(10)]);
  const insert = `insert into crm.people(workspace_id,first_name,source_system,source_entity,source_id)
    values ($1,'Desiree','join-orion','candidate_applications','legacy-1')`;
  await db.query(insert, [id(10)]);
  await assert.rejects(db.query(insert, [id(10)]), /unique|duplicate/i);
  await db.close();
});

test('applications require a person or organization relationship', async () => {
  const db = await setup();
  await db.exec('reset role');
  await db.query("insert into crm.workspaces(id,name,slug) values ($1,'Orion','orion')", [id(10)]);
  await assert.rejects(db.query(`insert into crm.applications
    (workspace_id,application_type,source_system,source_entity,source_id)
    values ($1,'candidate','join-orion','candidate_applications','legacy-1')`, [id(10)]), /check constraint/i);
  await db.close();
});

test('relationships cannot cross CRM workspace boundaries', async () => {
  const db = await setup();
  await db.exec('reset role');
  await db.query("insert into crm.workspaces(id,name,slug) values ($1,'Orion','orion'),($2,'Other','other')", [id(10), id(20)]);
  await db.query(`insert into crm.people(id,workspace_id,first_name,source_system,source_entity,source_id)
    values ($1,$2,'Other person','test','people','other-person')`, [id(30), id(20)]);
  await assert.rejects(db.query(`insert into crm.applications
    (workspace_id,application_type,person_id,source_system,source_entity,source_id)
    values ($1,'candidate',$2,'join-orion','candidate_applications','legacy-cross-workspace')`, [id(10), id(30)]), /foreign key/i);
  await db.close();
});
