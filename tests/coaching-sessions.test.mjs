import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { coachingCall, readCoaching } from "../src/lib/coachingRecords.js";
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const migrations=["20260905170811_durable_learner_records.sql","20260905175922_scoped_reviewer_history.sql","20260905181617_attributable_coaching_sessions.sql","20260905191217_human_reviewed_competency_evidence.sql"];
test("coaching authorization, attribution, evidence, responses and corrections",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"orion-coaching-test-"));
  let db=await PGlite.create(dir);
  try {
    await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
    for(const m of migrations) await db.exec(await readFile(new URL("../supabase/migrations/"+m,import.meta.url),"utf8"));
    for(const n of [1,2,3,4,5,6]) await db.query("insert into auth.users values($1)",[id(n)]);
    const asUser=async n=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):""]);await db.exec(n?"set role authenticated":"set role anon");};
    const bind=async(n,user,person,episode)=>{
      await db.exec("reset role");
      await db.query("insert into public.learner_bindings(id,auth_user_id,person_id,employment_episode_id,organization_scope,role_scope_ref,source_environment,source_project,identity_source_ref,employment_source_ref,verified_by,verification_evidence_ref) values($1,$2,$3,$4,'orion','pilot-rep','staging','test-project','restricted/identity','restricted/hr',$5,'restricted/verification')",[id(n),id(user),id(person),id(episode),id(3)]);
    };
    const grant=async(n,user,b,role="coach")=>{await db.exec("reset role");await db.query("insert into learner_review.scopes(id,reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,expires_at) values($1,$2,$3,$5,$4,'restricted/approval',now()+interval '1 day')",[id(n),id(user),id(b),id(3),role]);};
    const makeAttempt=async(n,kind,status)=>{
      await db.query("select public.begin_learner_attempt($1,$2,'scenario-v1','medium')",[id(n),kind]);
      if(status) await db.query("select public.finish_learner_attempt($1,$2,null)",[id(n),status]);
    };
    const list=async(scope=null)=>(await db.query("select public.read_coaching_sessions($1) as data",[scope?id(scope):null])).rows[0].data;
    const body=()=>({occurred_at:"2026-01-01T10:00:00Z",targets:["C01","C03"],
      evidence:[{kind:"attempt",id:id(100),revision:2}],observed_behavior:"Asked a relevant clarifying question.",
      strengths:"Checked the stated need.",development_opportunity:"Allow more response time.",next_action:"Practice one follow-up question.",
      follow_up_on:"2026-01-10",progress_status:"follow_up_pending"});
    const publish=(n,p=body(),scope=401)=>db.query("select public.publish_coaching_session($1,$2,$3)",[id(n),scope?id(scope):null,p]);
    const respond=(n,session=500,ack=true,comment=null)=>db.query("select public.respond_to_coaching($1,$2,$3,$4)",[id(n),id(session),ack,comment]);
    await bind(11,1,21,31);await bind(12,2,22,32);
    await asUser(1);await makeAttempt(100,"written","completed");await makeAttempt(101,"simulation","technical_failure");await makeAttempt(102,"simulation");
    const sim=(await db.query("select id from public.learner_simulation_sessions where training_attempt_id=$1",[id(101)])).rows[0].id;
    await asUser(2);await makeAttempt(200,"written","completed");
    await grant(401,4,11);await grant(601,6,11);await grant(602,6,12,"manager");
    // Sentinels establish that even existing band/level state is untouched.
    await db.exec("create table public.competency_bands(person_id uuid,band text);create table public.progression_levels(person_id uuid,level text);");
    await db.query("insert into public.competency_bands values($1,'B2');",[id(21)]);
    await db.query("insert into public.progression_levels values($1,'L1');",[id(21)]);

    await t.test("ordinary learners, anonymous and out-of-scope reviewers cannot publish",async()=>{
      await asUser(null);await assert.rejects(publish(500),/permission denied/);
      await asUser(1);await assert.rejects(publish(500),/Reviewer scope unavailable/);
      await assert.rejects(publish(500,body(),null),/Reviewer scope required/);
      await asUser(5);await assert.rejects(publish(500),/Reviewer scope unavailable/);
      await asUser(4);await assert.rejects(publish(500,body(),602),/Reviewer scope unavailable/);
    });
    await t.test("coach creates attributable durable session with exact evidence and version",async()=>{
      await asUser(4);
      const p={...body(),evidence:[...body().evidence,{kind:"simulation",id:sim,revision:2}]};
      await publish(500,p);await publish(500,p); // idempotent, not a second session
      const data=await list(401);assert.equal(data.records.length,1);
      const c=data.records[0];assert.equal(c.person_id,id(21));assert.equal(c.employment_episode_id,id(31));
      assert.equal(c.coach_user_id,id(4));assert.equal(c.revision,1);assert.equal(c.competency_version,"orion-sales/0.1-draft");
      assert.equal(c.evidence[1].id,sim);assert.equal(c.evidence[1].revision,2);assert.equal(c.evidence[1].status,"technical_failure");
      assert.equal(c.evidence[1].source_project,"test-project");
      assert.equal(c.can_correct,true);
      await assert.rejects(publish(500,{...p,next_action:"Different"}),/Submission ID conflict/);
      await db.exec("reset role");
      const stored=(await db.query("select * from learner_coaching.sessions where id=$1",[id(500)])).rows[0];
      assert.equal(stored.author_scope_id,id(401));assert.equal(stored.source_environment,"staging");
      assert.equal(stored.learner_binding_id,id(11));assert.equal(stored.status,"completed");
    });
    await t.test("own learner and other assigned reviewers can read; others cannot",async()=>{
      await asUser(1);assert.equal((await list()).records[0].id,id(500));
      await asUser(2);assert.deepEqual((await list()).records,[]);
      await asUser(5);await assert.rejects(list(401),/Reviewer scope unavailable/);
      await asUser(6);const c=(await list(601)).records[0];
      assert.equal(c.id,id(500));assert.equal(c.can_correct,false);
      assert.ok(!JSON.stringify(c).includes("restricted/"));
      await assert.rejects(db.query("select * from learner_coaching.sessions"),/permission denied/);
    });
    await t.test("evidence must be terminal, exact revision, same learner episode; content cannot smuggle fields",async()=>{
      await asUser(4);
      for(const evidence of [
        [{kind:"attempt",id:id(200),revision:2}],
        [{kind:"attempt",id:id(100),revision:1}],
        [{kind:"attempt",id:id(102),revision:1}],
        [{kind:"attempt",id:id(999),revision:2}],
      ]) await assert.rejects(publish(510,{...body(),evidence}),/Evidence unavailable/);
      await assert.rejects(publish(510,{...body(),targets:["C99"]}),/Invalid competency/);
      await assert.rejects(publish(510,{...body(),targets:[]}),/Invalid competency/);
      await assert.rejects(publish(510,{...body(),transcript:"must not store"}),/Unexpected coaching field/);
      await assert.rejects(publish(510,{...body(),person_id:id(22)}),/Unexpected coaching field/);
      await assert.rejects(publish(510,{...body(),level:"L5"}),/Unexpected coaching field/);
      await assert.rejects(publish(510,{...body(),evidence:[...body().evidence,...body().evidence]}),/Duplicate evidence/);
    });
    await t.test("learner responses are append-only and cannot change coach fields",async()=>{
      await asUser(4);await assert.rejects(respond(700),/Learner access unavailable/);
      await asUser(2);await assert.rejects(respond(700),/Coaching record unavailable/);
      await asUser(1);
      const before=(await list()).records[0];
      await respond(700,500,true,"Received; I disagree with the observation.");
      await respond(700,500,true,"Received; I disagree with the observation.");
      await respond(701,500,false,"Please consider the limited practice opportunity.");
      const after=(await list()).records[0];assert.equal(after.responses.length,2);
      for(const key of ["observed_behavior","strengths","development_opportunity","next_action","coach_user_id","revision","evidence"]) assert.deepEqual(after[key],before[key]);
      assert.ok(after.responses[0].acknowledged_at);assert.equal(after.responses[1].acknowledged_at,null);
      for(const sql of ["update learner_coaching.sessions set next_action='changed'","delete from learner_coaching.responses","insert into learner_coaching.sessions(id) values('"+id(900)+"')"])
        await assert.rejects(db.query(sql),/permission denied/);
      await db.exec("reset role");
      await assert.rejects(db.query("update learner_coaching.sessions set next_action='changed'"),/append-only/);
      await assert.rejects(db.query("delete from learner_coaching.responses"),/append-only/);
    });
    await t.test("only original coach can append a reasoned correction to latest version",async()=>{
      const corrected={...body(),supersedes_id:id(500),correction_reason:"Clarify the context.",observed_behavior:"Asked a clarifying question with prompting."};
      await asUser(6);await assert.rejects(publish(501,corrected,601),/Only original coach/);
      await asUser(4);await assert.rejects(publish(501,{...corrected,correction_reason:""}),/Correction reason/);
      await publish(501,corrected);
      const rows=(await list(401)).records;
      const old=rows.find(c=>c.id===id(500)), next=rows.find(c=>c.id===id(501));
      assert.equal(old.observed_behavior,body().observed_behavior);assert.equal(old.superseded_by,id(501));
      assert.equal(old.responses.length,2);assert.equal(next.responses.length,0);
      assert.equal(next.revision,2);assert.equal(next.supersedes_id,id(500));
      await assert.rejects(publish(502,corrected),/latest version/);
      await asUser(1);await assert.rejects(respond(702),/latest coaching version/);
      await respond(702,501,true,"Received the correction.");
    });
    await t.test("coaching and learner responses survive database restart",async()=>{
      await db.close(); db=await PGlite.create(dir); await asUser(1);
      const rows=(await list()).records;
      assert.equal(rows.length,2); assert.equal(rows.find(c=>c.id===id(501)).responses.length,1);
      assert.equal(rows.find(c=>c.id===id(500)).responses.length,2);
    });
    await t.test("revocation blocks reads and new writes with the same authenticated subject",async()=>{
      await db.exec("reset role");
      await db.query("update learner_review.scopes set revoked_at=now(),revoked_by=$1,revocation_reason='revoked' where id=$2",[id(3),id(401)]);
      await asUser(4);await assert.rejects(list(401),/Reviewer scope unavailable/);
      await assert.rejects(publish(503),/Reviewer scope unavailable/);
      await asUser(6);assert.equal((await list(601)).records.length,2);
    });
    await t.test("rehire does not transfer coaching, evidence or response permissions",async()=>{
      await db.exec("reset role");await db.query("update public.learner_bindings set revoked_at=now(),revoked_by=$1,revocation_reason='rehire' where id=$2",[id(3),id(11)]);
      await bind(13,1,21,33);await asUser(1);await makeAttempt(300,"written","completed");
      assert.deepEqual((await list()).records,[]);await assert.rejects(respond(703,501),/Coaching record unavailable/);
      await grant(603,6,13);await asUser(6);
      assert.equal((await list(601)).records.length,2);assert.equal((await list(601)).can_create,false);
      await assert.rejects(publish(504,body(),601),/Active separate learner binding/);
      await assert.rejects(publish(504,body(),603),/Evidence unavailable/);
      await publish(504,{...body(),evidence:[{kind:"attempt",id:id(300),revision:2}]},603);
      assert.equal((await list(603)).records[0].employment_episode_id,id(33));
      await assert.rejects(publish(505,{...body(),supersedes_id:id(501),correction_reason:"Not same episode",evidence:[{kind:"attempt",id:id(300),revision:2}]},603),/Only original coach/);
      await asUser(1);assert.equal((await list()).records[0].id,id(504));
    });
    await t.test("manager authorization also supports coaching, while expired grants do not",async()=>{
      await asUser(6);
      await publish(550,{...body(),evidence:[{kind:"attempt",id:id(200),revision:2}]},602);
      await asUser(2);assert.equal((await list()).records[0].coach_user_id,id(6));
      await db.exec("reset role");
      await db.query("insert into learner_review.scopes(id,reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,approved_at,expires_at) values($1,$2,$3,'coach',$4,'expired',now()-interval '2 days',now()-interval '1 day')",[id(701),id(5),id(12),id(3)]);
      await asUser(5);await assert.rejects(list(701),/Reviewer scope unavailable/);
      await assert.rejects(publish(551,{...body(),evidence:[{kind:"attempt",id:id(200),revision:2}]},701),/Reviewer scope unavailable/);
    });
    await t.test("coaching never changes band/level state or existing attempts",async()=>{
      await db.exec("reset role");
      assert.deepEqual((await db.query("select band from public.competency_bands")).rows,[{band:"B2"}]);
      assert.deepEqual((await db.query("select level from public.progression_levels")).rows,[{level:"L1"}]);
      assert.equal((await db.query("select ai_score from public.learner_training_attempts where id=$1",[id(101)])).rows[0].ai_score,null);
      assert.equal((await db.query("select revision from public.learner_training_attempts where id=$1",[id(100)])).rows[0].revision,2);
    });
  } finally {
    await db.close();
    if (!resolve(dir).startsWith(resolve(tmpdir())+sep) || !resolve(dir).split(sep).at(-1).startsWith("orion-coaching-test-")) throw new Error("Unsafe cleanup path");
    await rm(dir,{recursive:true,force:true});
  }
});
test("coaching client exposes bounded pages and propagates unavailable writes",async()=>{
  const args=[];
  const client={rpc:async(name,input)=>{args.push({name,input});return {data:{records:Array.from({length:51},(_,id)=>({id})),can_create:false}};}};
  const result=await readCoaching(client,"scope",{id:"cursor",created_at:"date"});
  assert.equal(result.records.length,50);assert.equal(result.hasMore,true);
  assert.deepEqual(args[0].input,{p_scope:"scope",p_before:"date",p_before_id:"cursor"});
  await assert.rejects(coachingCall({rpc:async()=>({error:{}})},"publish_coaching_session",{}),/not confirmed/);
});
