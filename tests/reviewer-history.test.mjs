import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { fetchReviewerHistory, reviewAssessmentLabel } from "../src/lib/reviewerHistory.js";
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
test("scoped reviewer authorization against all applied migrations", async t => {
  const db = await PGlite.create();
  try {
    await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
    for (const file of ["20260905170811_durable_learner_records.sql","20260905175922_scoped_reviewer_history.sql","20260905181617_attributable_coaching_sessions.sql"]) {
      await db.exec(await readFile(new URL("../supabase/migrations/"+file,import.meta.url),"utf8"));
    }
    for (const n of [1,2,3,4,5,6]) await db.query("insert into auth.users values($1)",[id(n)]);
    async function asUser(n) {
      await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):""]);
      await db.exec(n?"set role authenticated":"set role anon");
    }
    async function binding(n, user, person, episode) {
      await db.exec("reset role");
      await db.query("insert into public.learner_bindings(id,auth_user_id,person_id,employment_episode_id,organization_scope,role_scope_ref,source_environment,source_project,identity_source_ref,employment_source_ref,verified_by,verification_evidence_ref) values($1,$2,$3,$4,'orion','pilot-rep','test','test-project','private/identity','private/hr',$5,'private/evidence')",[id(n),id(user),id(person),id(episode),id(3)]);
    }
    async function grant(n,user,b,role="manager") {
      await db.exec("reset role");
      await db.query("insert into learner_review.scopes(id,reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,expires_at) values($1,$2,$3,$4,$5,'restricted/approval',now()+interval '1 day')",[id(n),id(user),id(b),role,id(3)]);
    }
    async function attempt(n,kind,status="completed",score=null) {
      await db.query("select public.begin_learner_attempt($1,$2,'scenario-v1','medium')",[id(n),kind]);
      await db.query("select public.finish_learner_attempt($1,$2,$3)",[id(n),status,score]);
    }
    const history = async (scope=null,before=null,beforeId=null) =>
      (await db.query("select public.read_reviewer_history($1,$2,$3) as data",[scope?id(scope):null,before,beforeId])).rows[0].data;
    await binding(11,1,21,31); await binding(12,2,22,32);
    await asUser(1); await attempt(100,"written"); await attempt(101,"simulation","technical_failure");
    await asUser(2); await attempt(200,"simulation","completed",{overall:70,discovery:70,orderBuilding:70,objectionHandling:70,closing:70});
    await grant(401,4,11); await grant(601,6,12,"coach");

    await t.test("learner-only and unauthenticated access remain denied", async()=>{
      await asUser(1);
      assert.equal((await db.query("select * from public.learner_training_attempts")).rows.length,2);
      assert.equal((await db.query("select * from public.learner_simulation_sessions where training_attempt_id=$1",[id(200)])).rows.length,0);
      assert.deepEqual((await history()).scopes,[]);
      await assert.rejects(history(601),/Reviewer scope unavailable/);
      await asUser(null); await assert.rejects(history(),/permission denied/);
    });
    await t.test("manager and coach get only explicitly assigned episodes and minimized fields",async()=>{
      await asUser(4);
      const data=await history(401);
      assert.equal(data.scopes.length,1); assert.equal(data.scopes[0].employment_episode_id,id(31));
      assert.deepEqual(new Set(data.records.map(r=>r.id)),new Set([id(100),id(101)]));
      const failed=data.records.find(r=>r.id===id(101));
      assert.equal(failed.status,"technical_failure"); assert.equal(failed.ai_overall,null);
      assert.equal(failed.session.status,"technical_failure");
      assert.equal(failed.session.difficulty_ref,"medium");
      const text=JSON.stringify(data);
      for (const forbidden of ["auth_user_id","verification_evidence_ref","approval_ref","email","transcript","recording","private/"]) assert.ok(!text.includes(forbidden),forbidden);
      // Direct table access stays own-only, even for an authorized reviewer.
      assert.equal((await db.query("select * from public.learner_training_attempts")).rows.length,0);
      await assert.rejects(db.query("select * from learner_review.scopes"),/permission denied/);
      await assert.rejects(history(601),/Reviewer scope unavailable/);
      await asUser(6);
      const coach=await history(601);
      assert.equal(coach.scopes[0].reviewer_role,"coach"); assert.equal(coach.records[0].id,id(200));
      assert.equal(coach.records[0].assessment_status,"ai_unreviewed");
      assert.match(reviewAssessmentLabel(coach.records[0]),/unreviewed, supporting evidence only/);
      await asUser(5); assert.deepEqual((await history()).scopes,[]);
      await assert.rejects(history(401),/Reviewer scope unavailable/);
    });
    await t.test("reviewer scope grants no writes, mutation, reassignment or eligibility for practice",async()=>{
      await asUser(4);
      for (const sql of ["update public.learner_training_attempts set person_id='"+id(22)+"'",
        "delete from public.learner_simulation_sessions",
        "update public.learner_bindings set person_id='"+id(22)+"'",
        "insert into learner_review.scopes(id) values('"+id(999)+"')",
        "update learner_review.scopes set revoked_at=null"]) {
        await assert.rejects(db.query(sql),/permission denied/);
      }
      await assert.rejects(db.query("select public.finish_learner_attempt($1,'completed',null)",[id(100)]),/Verified learner enrollment/);
      await assert.rejects(db.query("select public.begin_learner_attempt($1,'written','x',null)",[id(999)]),/Verified learner enrollment/);
      // A reviewer who is also a verified learner still cannot finish an assigned learner's work.
      await binding(14,4,24,34); await asUser(4);
      await assert.rejects(db.query("select public.finish_learner_attempt($1,'completed',null)",[id(100)]),/Record unavailable/);
      await attempt(400,"written");
      assert.equal((await db.query("select * from public.learner_training_attempts")).rows[0].id,id(400));
    });
    await t.test("rehire never widens a prior episode grant",async()=>{
      await db.exec("reset role");
      await db.query("update public.learner_bindings set revoked_at=now(),revoked_by=$1,revocation_reason='rehire' where id=$2",[id(3),id(11)]);
      await binding(13,1,21,33); await asUser(1); await attempt(300,"written");
      await asUser(4); assert.equal((await history(401)).records.length,2);
      assert.equal((await history()).scopes.length,1);
      await grant(402,4,13); await asUser(4);
      const old=await history(401), next=await history(402);
      assert.equal(old.scopes.find(g=>g.id===id(401)).binding_retired,true);
      assert.equal(next.records.length,1); assert.equal(next.records[0].id,id(300));
      assert.deepEqual(new Set(next.scopes.map(g=>g.employment_episode_id)),new Set([id(31),id(33)]));
    });
    await t.test("revocation/expiry deny fresh reads and cursors without a refreshed JWT",async()=>{
      await db.exec("reset role");
      await assert.rejects(db.query("update learner_review.scopes set learner_binding_id=$1 where id=$2",[id(12),id(401)]),/immutable/);
      await db.query("update learner_review.scopes set revoked_at=now(),revoked_by=$1,revocation_reason='access removed' where reviewer_user_id=$2",[id(3),id(4)]);
      await asUser(4); assert.deepEqual((await history()).scopes,[]);
      await assert.rejects(history(401),/Reviewer scope unavailable/);
      await assert.rejects(history(401,new Date().toISOString(),id(100)),/Reviewer scope unavailable/);
      await db.exec("reset role");
      await db.query("insert into learner_review.scopes(reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,approved_at,expires_at) values($1,$2,'manager',$3,'expired',now()-interval '2 days',now()-interval '1 day')",[id(5),id(12),id(3)]);
      await asUser(5); assert.deepEqual((await history()).scopes,[]);
    });
    await t.test("bounded cursor pagination is deterministic, including equal timestamps",async()=>{
      await asUser(2);
      for(let i=0;i<52;i++) await attempt(1000+i,"written");
      await db.exec("reset role");
      await db.query("update public.learner_training_attempts set started_at='2026-01-01' where binding_id=$1",[id(12)]);
      await asUser(6);
      const page=await history(601); assert.equal(page.records.length,51);
      const last=page.records[49];
      const next=await history(601,last.started_at,last.id);
      assert.equal(next.records.length,3);
      assert.equal(new Set([...page.records.slice(0,50),...next.records].map(r=>r.id)).size,53);
      await assert.rejects(history(601,last.started_at,null),/Incomplete cursor/);
    });
  } finally { await db.close(); }
});
test("review history adapter and failure labels",async()=>{
  const requests=[];
  const client={rpc:async(name,args)=>{requests.push({name,args});return {data:{scopes:[],records:Array.from({length:51},(_,i)=>({id:i}))}};}};
  const page=await fetchReviewerHistory(client,"approved-id",{id:"last",started_at:"time"});
  assert.equal(page.records.length,50); assert.equal(page.hasMore,true);
  assert.deepEqual(requests[0].args,{p_scope_id:"approved-id",p_before:"time",p_before_id:"last"});
  await assert.rejects(fetchReviewerHistory({rpc:async()=>({error:{message:"denied"}})}),/unavailable/);
  assert.equal(reviewAssessmentLabel({status:"technical_failure",ai_overall:0,assessment_status:"ai_unreviewed"}),"Technical failure — unscored");
  assert.equal(reviewAssessmentLabel({status:"completed",assessment_status:"unscored",ai_overall:null}),"Unscored");
});
