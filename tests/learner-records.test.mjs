import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { evaluatePractice } from "../src/lib/evaluatePractice.js";
import { loadTrainingResults, addTrainingResult } from "../src/lib/trainingStore.js";
import { loadSimulatorResults, addSimulatorResult } from "../src/lib/simulatorResultsStore.js";

const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const score = { overall: 60, discovery: 55, orderBuilding: 60, objectionHandling: 70, closing: 55 };
test("real PostgreSQL migration: ownership, attribution, durability, lifecycle and rehire", async t => {
  const dir = await mkdtemp(join(tmpdir(), "orion-record-test-"));
  let db = await PGlite.create(dir);
  try {
    // Supabase's auth schema/JWT helper are the only stubbed infrastructure.
    await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
    await db.exec(await readFile(new URL("../supabase/migrations/20260905170811_durable_learner_records.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/20260905175922_scoped_reviewer_history.sql", import.meta.url), "utf8"));
    for (const n of [1,2,3,4]) await db.query("insert into auth.users values ($1)", [id(n)]);
    for (const n of [1,2]) await db.query("insert into public.learner_bindings(id,auth_user_id,person_id,employment_episode_id,organization_scope,role_scope_ref,source_environment,source_project,identity_source_ref,employment_source_ref,verified_by,verification_evidence_ref) values($1,$2,$3,$4,'orion','pilot-rep','test','isolated-test','identity/verified','hr/verified',$5,'case/test')",[id(10+n),id(n),id(20+n),id(30+n),id(3)]);
    const asUser = async n => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n ? id(n) : ""]);
      await db.exec(n ? "set role authenticated" : "set role anon");
    };
    const begin = (n,kind="simulation") => db.query("select public.begin_learner_attempt($1,$2,'scenario-v1','medium')",[id(n),kind]);
    const finish = (n,status,ai=null) => db.query("select public.finish_learner_attempt($1,$2,$3)",[id(n),status,ai]);

    await t.test("anonymous and unbound users cannot save", async () => {
      await asUser(null); await assert.rejects(begin(100), /permission denied/);
      await assert.rejects(db.query("select * from public.learner_training_attempts"), /permission denied/);
      await asUser(4); await assert.rejects(begin(100), /Verified learner enrollment/);
    });
    await t.test("A and B get server-derived person and episode for both record types", async () => {
      await asUser(1); await begin(100); await begin(100); await begin(101,"written");
      await finish(101,"completed"); await finish(100,"completed",score);
      const a = (await db.query("select * from public.learner_training_attempts order by id")).rows;
      assert.equal(a.length,2); assert.equal(a[0].auth_user_id,id(1)); assert.equal(a[0].person_id,id(21));
      assert.equal(a[0].employment_episode_id,id(31)); assert.equal(a[0].source_environment,"test");
      assert.equal(a[0].source_project,"isolated-test"); assert.equal(a[0].assessment_status,"ai_unreviewed");
      assert.equal(a[1].ai_score,null);
      const sessions=(await db.query("select * from public.learner_simulation_sessions")).rows;
      assert.equal(sessions.length,1); assert.equal(sessions[0].person_id,id(21)); assert.equal(sessions[0].employment_episode_id,id(31));
      await asUser(2); await begin(200); await finish(200,"completed",score);
      assert.equal((await db.query("select count(*)::int as n from public.learner_training_attempts")).rows[0].n,1);
      assert.equal((await db.query("select * from public.learner_training_attempts where id=$1",[id(100)])).rows.length,0);
      assert.equal((await db.query("select * from public.learner_simulation_sessions where training_attempt_id=$1",[id(100)])).rows.length,0);
    });
    await t.test("forged IDs, direct writes, cross-user finish and terminal rewrites are denied", async () => {
      await asUser(2); await assert.rejects(begin(100), /Record conflict/);
      await assert.rejects(finish(100,"technical_failure"), /Record unavailable/);
      await assert.rejects(db.query("update public.learner_bindings set person_id=$1",[id(22)]),/permission denied/);
      await assert.rejects(db.query("delete from public.learner_training_attempts"),/permission denied/);
      await assert.rejects(db.query("insert into public.learner_training_attempts(id) values($1)",[id(500)]),/permission denied/);
      await assert.rejects(db.query("update public.learner_simulation_sessions set person_id=$1",[id(22)]),/permission denied/);
      await asUser(1); await finish(100,"completed",score);
      await assert.rejects(finish(100,"completed",{...score,overall:99}),/Terminal record is immutable/);
    });
    await t.test("provider failure and missing opportunity never become zero competence", async () => {
      await asUser(1); await begin(102);
      await assert.rejects(finish(102,"technical_failure",score),/Failure must be unscored/);
      await assert.rejects(finish(102,"completed",{}),/Invalid AI suggestion/);
      await assert.rejects(finish(102,"completed",{...score,overall:null}),/Invalid AI suggestion/);
      await finish(102,"technical_failure");
      const a=(await db.query("select * from public.learner_training_attempts where id=$1",[id(102)])).rows[0];
      assert.equal(a.ai_score,null); assert.equal(a.assessment_status,"unscored");
      assert.equal((await db.query("select status from public.learner_simulation_sessions where training_attempt_id=$1",[id(102)])).rows[0].status,"technical_failure");
      await begin(103); await finish(103,"abandoned");
      await begin(104); // browser close/refresh: stays in progress, never guessed complete
    });
    await t.test("records survive closing and reopening the database with a new learner session", async () => {
      await db.close(); db=await PGlite.create(dir); await asUser(1);
      const rows=(await db.query("select * from public.learner_training_attempts order by id")).rows;
      assert.equal(rows.length,5); assert.equal(rows[0].id,id(100)); assert.equal(rows[4].status,"in_progress");
      await asUser(2); assert.equal((await db.query("select * from public.learner_training_attempts")).rows.length,1);
    });
    await t.test("revocation blocks old access; rehire preserves original episode and person",async()=>{
      await db.exec("reset role");
      await assert.rejects(db.query("update public.learner_bindings set person_id=$1 where id=$2",[id(99),id(11)]),/Bindings are immutable/);
      await db.query("update public.learner_bindings set revoked_at=now(),revoked_by=$1,revocation_reason='rehire' where id=$2",[id(3),id(11)]);
      await asUser(1);
      assert.equal((await db.query("select * from public.learner_training_attempts")).rows.length,0);
      await assert.rejects(begin(105),/Verified learner enrollment/);
      await db.exec("reset role");
      await db.query("insert into public.learner_bindings(id,auth_user_id,person_id,employment_episode_id,organization_scope,role_scope_ref,source_environment,source_project,identity_source_ref,employment_source_ref,verified_by,verification_evidence_ref,supersedes_id) values($1,$2,$3,$4,'orion','pilot-rep','test','isolated-test','identity/verified','hr/rehire',$5,'case/rehire',$6)",[id(12+10),id(1),id(21),id(32+10),id(3),id(11)]);
      await asUser(1); await begin(105);
      assert.equal((await db.query("select employment_episode_id from public.learner_training_attempts")).rows[0].employment_episode_id,id(42));
      await db.exec("reset role");
      assert.equal((await db.query("select employment_episode_id from public.learner_training_attempts where id=$1",[id(100)])).rows[0].employment_episode_id,id(31));
    });
  } finally { await db.close(); if (!resolve(dir).startsWith(resolve(tmpdir()) + sep) || !resolve(dir).split(sep).at(-1).startsWith("orion-record-test-")) throw new Error("Unsafe test cleanup path"); await rm(dir,{recursive:true,force:true}); }
});

test("provider errors, malformed scores, and no opportunity are unscored",async()=>{
  const transcript=[{speaker:"Sales Rep",text:"Hello"}];
  for (const request of [
    async()=>{throw new Error("offline");},
    async()=>({ok:false}),
    async()=>({ok:true,json:async()=>({overall:0})}),
    async()=>({ok:true,json:async()=>({...score,closing:"0"})}),
    async()=>({ok:true,json:async()=>({...score,closing:101})}),
  ]) assert.deepEqual(await evaluatePractice(transcript,request),{status:"technical_failure",score:null,feedback:""});
  assert.equal((await evaluatePractice([],()=>{throw new Error("must not run");})).status,"abandoned");
  assert.equal((await evaluatePractice(transcript,()=>{throw new Error("must not run");},true)).score,null);
  assert.deepEqual((await evaluatePractice(transcript,async()=>({ok:true,json:async()=>score}))).score,score);
});
test("legacy unattributed browser records are never loaded, rewritten or imported",()=>{
  const legacy=new Map([["simulatorResults",'[{"assignedRep":"R1","score":88}]'],["sales-simulator-orion-training-results-v1",'[{"email":"dealer@example.invalid","totalScore":99}]']]);
  const before=[...legacy];
  globalThis.localStorage={getItem:k=>legacy.get(k),setItem:(k,v)=>legacy.set(k,v),removeItem:k=>legacy.delete(k)};
  assert.deepEqual(loadTrainingResults(),[]); assert.deepEqual(loadSimulatorResults(),[]);
  assert.throws(()=>addTrainingResult({}),/quarantined/); assert.throws(()=>addSimulatorResult({}),/quarantined/);
  assert.deepEqual([...legacy],before);
  delete globalThis.localStorage;
});

