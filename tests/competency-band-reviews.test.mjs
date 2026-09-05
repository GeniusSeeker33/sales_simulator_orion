import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const migrations=["20260905170811_durable_learner_records.sql","20260905175922_scoped_reviewer_history.sql","20260905181617_attributable_coaching_sessions.sql","20260905191217_human_reviewed_competency_evidence.sql","20260905192514_human_approved_competency_band_review.sql","20260905194609_human_approved_progression.sql"];
test("human-approved band reviews and exact episode authorization",async t=>{
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
    const body=()=>({occurred_at:"2026-01-01T10:00:00Z",targets:["C01","C03"],
      evidence:[{kind:"attempt",id:id(100),revision:2}],observed_behavior:"Asked a relevant clarifying question.",
      strengths:"Checked the stated need.",development_opportunity:"Allow more response time.",next_action:"Practice one follow-up question.",
      follow_up_on:"2026-01-10",progress_status:"follow_up_pending"});
    const publish=(n,p=body(),scope=401)=>db.query("select public.publish_coaching_session($1,$2,$3)",[id(n),scope?id(scope):null,p]);
    await bind(11,1,21,31);await bind(12,2,22,32);
    await asUser(1);await makeAttempt(100,"written","completed");await makeAttempt(101,"simulation","technical_failure");await makeAttempt(102,"simulation");
    const sim=(await db.query("select id from public.learner_simulation_sessions where training_attempt_id=$1",[id(101)])).rows[0].id;
    await asUser(2);await makeAttempt(200,"written","completed");
    await grant(401,4,11);await grant(601,6,11);await grant(602,6,12,"manager");
    // Sentinels establish that even existing band/level state is untouched.
    await db.exec("create table public.competency_bands(person_id uuid,band text);create table public.progression_levels(person_id uuid,level text);");
    await db.query("insert into public.competency_bands values($1,'B2');",[id(21)]);
    await db.query("insert into public.progression_levels values($1,'L1');",[id(21)]);

    const finding=()=>({competency_version:"orion-sales/0.1-draft",competency_code:"C01",source_type:"ai_practice",
      evidence:{kind:"attempt",id:id(100),revision:2},observed_behavior:"Asked a relevant question.",finding:"supports",evidence_date:"2026-01-01"});
    const record=(n,p=finding(),scope=401)=>db.query("select public.publish_competency_evidence($1,$2,$3)",[id(n),scope?id(scope):null,p]);
    const evidence=async(scope=null)=>(await db.query("select public.read_competency_evidence($1) as data",[scope?id(scope):null])).rows[0].data;
    const reviewBody=()=>({competency_version:"orion-sales/0.1-draft",competency_code:"C01",outcome:"B2",
      evidence:[{id:id(800),revision:1}],rationale:"Human judgment against the versioned behavioral anchors.",reviewed_at:new Date().toISOString()});
    const review=(n,p=reviewBody(),scope=401)=>db.query("select public.publish_competency_band_review($1,$2,$3)",[id(n),scope?id(scope):null,p]);
    const reviews=async(scope=null)=>(await db.query("select public.read_competency_band_reviews($1) as data",[scope?id(scope):null])).rows[0].data;
    await asUser(4);await record(800);await record(801,{...finding(),competency_code:"C02"});
    await record(802,{...finding(),finding:"technical_failure",evidence:{kind:"simulation",id:sim,revision:2}});
    await record(803,{...finding(),finding:"disputed"});await record(804,{...finding(),finding:"insufficient_opportunity"});
    await asUser(6);await record(805,{...finding(),evidence:{kind:"attempt",id:id(200),revision:2}},602);
    await t.test("authorized reviewer explicitly publishes an attributable durable band decision",async()=>{
      await asUser(4);const p=reviewBody();await review(1000,p);await review(1000,p);
      const r=(await reviews(401)).records[0];assert.equal(r.outcome,"B2");assert.equal(r.person_id,id(21));assert.equal(r.employment_episode_id,id(31));
      assert.equal(r.learner_binding_id,id(11));assert.equal(r.reviewer_user_id,id(4));assert.equal(r.status,"completed");assert.equal(r.revision,1);
      assert.equal(r.evidence[0].id,id(800));assert.equal(r.evidence[0].revision,1);assert.equal(r.evidence[0].source_project,"test-project");
      assert.equal(r.evidence[0].observed_behavior,undefined);assert.equal((await reviews(401)).records.length,1);
      await assert.rejects(review(1000,{...p,outcome:"B3"}),/Submission ID conflict/);
      await assert.rejects(review(1001,{...p,outcome:""}),/check constraint/);
      await assert.rejects(review(1001,{...p,rationale:"   "}),/check constraint/);
    });
    await t.test("anonymous, learners and out-of-scope reviewers denied publication",async()=>{
      await asUser(null);await assert.rejects(review(1001),/permission denied/);
      await asUser(1);await assert.rejects(review(1001),/Reviewer scope/);await assert.rejects(review(1001,reviewBody(),null),/Reviewer scope/);
      await asUser(5);await assert.rejects(review(1001),/Reviewer scope/);await assert.rejects(reviews(401),/Reviewer scope/);
      await asUser(6);await assert.rejects(review(1001,reviewBody(),602),/wrong episode/);
      assert.equal((await reviews(601)).records[0].id,id(1000));
    });
    await t.test("only exact current same-competency/version human evidence accepted",async()=>{
      await asUser(4);
      for(const e of [[{id:id(800),revision:2}],[{id:id(805),revision:1}],[{id:id(100),revision:2}],[{id:sim,revision:2}]])
        await assert.rejects(review(1001,{...reviewBody(),evidence:e}),/Evidence unavailable/);
      await assert.rejects(review(1001,{...reviewBody(),evidence:[{id:id(801),revision:1}]}),/match competency and version/);
      await assert.rejects(review(1001,{...reviewBody(),competency_version:"orion-sales/other"}),/Unsupported competency/);
      await assert.rejects(review(1001,{...reviewBody(),evidence:[{id:id(800),revision:1},{id:id(800),revision:1}]}),/Duplicate evidence/);
      for(const key of ["ai_score","coaching_narrative","transcript","person_id","level"])
        await assert.rejects(review(1001,{...reviewBody(),[key]:"forbidden"}),/Unexpected review field/);
    });
    await t.test("defer is explicit, non-scored states cannot alone support any band",async()=>{
      await asUser(4);
      await review(1010,{...reviewBody(),outcome:"defer",evidence:[],rationale:"No evidence available."});
      const refs=[802,803,804].map(n=>({id:id(n),revision:1}));
      await review(1011,{...reviewBody(),outcome:"defer",evidence:refs});
      for(const outcome of ["B1","B2","B3","B4","B5"]) await assert.rejects(review(1012,{...reviewBody(),outcome,evidence:refs}),/non-scored/);
      await assert.rejects(review(1012,{...reviewBody(),evidence:[]}),/non-scored/);
      await review(1012,{...reviewBody(),outcome:"B4",evidence:[...reviewBody().evidence,...refs],rationale:"B4 based on substantive observation; excluded non-scored context from proficiency judgment."});
      const rows=(await reviews(401)).records;assert.equal(rows.find(r=>r.id===id(1010)).outcome,"defer");assert.equal(rows.find(r=>r.id===id(1012)).outcome,"B4");
    });
    await t.test("superseded evidence rejected; existing review keeps snapshot and warns",async()=>{
      await asUser(4);await record(810,{...finding(),supersedes_id:id(800),correction_reason:"Clarify",finding:"does_not_yet_support"});
      await assert.rejects(review(1020),/stale\/superseded/);
      const r=(await reviews(401)).records.find(r=>r.id===id(1000));assert.equal(r.evidence[0].revision,1);assert.equal(r.evidence[0].finding,"supports");assert.equal(r.evidence[0].superseded_by,id(810));assert.equal(r.outcome,"B2");
      await review(1020,{...reviewBody(),evidence:[{id:id(810),revision:2}],outcome:"defer"});
    });
    await t.test("only original scoped reviewer appends reasoned same-competency correction",async()=>{
      const p={...reviewBody(),evidence:[{id:id(810),revision:2}],supersedes_id:id(1000),correction_reason:"Reconsider corrected evidence",outcome:"defer"};
      await asUser(6);await assert.rejects(review(1030,p,601),/Only original reviewer/);
      await asUser(4);await assert.rejects(review(1030,{...p,correction_reason:""}),/Correction reason/);
      await assert.rejects(review(1030,{...p,competency_code:"C02",evidence:[{id:id(801),revision:1}]}),/retain competency/);
      await review(1030,p);await assert.rejects(review(1031,p),/latest review/);
      const rows=(await reviews(401)).records;assert.equal(rows.find(r=>r.id===id(1000)).outcome,"B2");assert.equal(rows.find(r=>r.id===id(1000)).superseded_by,id(1030));
      assert.equal(rows.find(r=>r.id===id(1030)).revision,2);assert.equal(rows.find(r=>r.id===id(1030)).outcome,"defer");
    });
    await t.test("learner own-episode read-only, other learner cannot read or edit",async()=>{
      await asUser(1);assert.equal((await reviews()).records.length,6);
      for(const sql of ["select * from learner_band.reviews","update learner_band.reviews set outcome='B5'","delete from learner_band.reviews","insert into learner_band.reviews(id) values('"+id(999)+"')"])
        await assert.rejects(db.query(sql),/permission denied/);
      await asUser(2);assert.deepEqual((await reviews()).records,[]);await assert.rejects(reviews(401),/Reviewer scope/);
      await db.exec("reset role");await assert.rejects(db.query("update learner_band.reviews set outcome='B5'"),/append-only/);await assert.rejects(db.query("delete from learner_band.reviews"),/append-only/);
    });
    await t.test("durable review history survives database restart",async()=>{
      await db.close();db=await PGlite.create(dir);await asUser(1);assert.equal((await reviews()).records.length,6);
    });
    await t.test("revoked/expired reviewers denied with same authenticated subject",async()=>{
      await db.exec("reset role");await db.query("update learner_review.scopes set revoked_at=now(),revoked_by=$1,revocation_reason='revoked' where id=$2",[id(3),id(401)]);
      await asUser(4);await assert.rejects(reviews(401),/Reviewer scope/);await assert.rejects(review(1040),/Reviewer scope/);
      await db.exec("reset role");await db.query("insert into learner_review.scopes(id,reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,approved_at,expires_at) values($1,$2,$3,'coach',$4,'expired',now()-interval '2 days',now()-interval '1 day')",[id(701),id(5),id(11),id(3)]);
      await asUser(5);await assert.rejects(reviews(701),/Reviewer scope/);await assert.rejects(review(1040,reviewBody(),701),/Reviewer scope/);
    });
    await t.test("rehire has no inherited band and rejects old evidence/corrections",async()=>{
      await db.exec("reset role");await db.query("update public.learner_bindings set revoked_at=now(),revoked_by=$1,revocation_reason='rehire' where id=$2",[id(3),id(11)]);
      await bind(13,1,21,33);await asUser(1);await makeAttempt(300,"written","completed");assert.deepEqual((await reviews()).records,[]);
      await grant(603,6,13);await asUser(6);assert.equal((await reviews(601)).records.length,6);assert.equal((await reviews(601)).can_create,false);
      await assert.rejects(review(1050,reviewBody(),601),/Active separate learner/);await assert.rejects(review(1050,reviewBody(),603),/wrong episode/);
      await record(850,{...finding(),evidence:{kind:"attempt",id:id(300),revision:2}},603);
      await review(1050,{...reviewBody(),evidence:[{id:id(850),revision:1}]},603);
      await assert.rejects(review(1051,{...reviewBody(),evidence:[{id:id(850),revision:1}],supersedes_id:id(1000),correction_reason:"Wrong episode"},603),/Only original reviewer/);
      await asUser(1);assert.equal((await reviews()).records[0].employment_episode_id,id(33));
    });
    await t.test("bounded deterministic pagination, no L1-L5 or aggregate state changes",async()=>{
      await asUser(6);await db.exec("begin");
      for(let n=1100;n<1152;n++) await review(n,{...reviewBody(),outcome:"defer",evidence:[]},603);
      await db.exec("commit");const first=await reviews(603);assert.equal(first.records.length,51);const last=first.records[49];
      const next=(await db.query("select public.read_competency_band_reviews($1,$2,$3) as data",[id(603),last.created_at,last.id])).rows[0].data;
      const seen=[...first.records.slice(0,50),...next.records];assert.equal(seen.length,53);assert.equal(new Set(seen.map(r=>r.id)).size,53);
      await db.exec("reset role");assert.deepEqual((await db.query("select level from public.progression_levels")).rows,[{level:"L1"}]);
      assert.deepEqual((await db.query("select band from public.competency_bands")).rows,[{band:"B2"}]);
      assert.equal((await db.query("select finding from learner_competency.evidence where id=$1",[id(802)])).rows[0].finding,"technical_failure");
    });
  } finally {
    await db.close();
    if (!resolve(dir).startsWith(resolve(tmpdir())+sep) || !resolve(dir).split(sep).at(-1).startsWith("orion-coaching-test-")) throw new Error("Unsafe cleanup path");
    await rm(dir,{recursive:true,force:true});
  }
});
