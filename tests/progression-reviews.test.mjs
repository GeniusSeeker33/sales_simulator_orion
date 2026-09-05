import { progressionOutcomes, initialProgressionOutcome, parseProgressionRefs } from "../src/lib/progressionReviews.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const migrations=["20260905170811_durable_learner_records.sql","20260905175922_scoped_reviewer_history.sql","20260905181617_attributable_coaching_sessions.sql","20260905191217_human_reviewed_competency_evidence.sql","20260905192514_human_approved_competency_band_review.sql","20260905194609_human_approved_progression.sql"];
test("human progression decisions, official history and authorization",async t=>{
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
    await db.exec("reset role; create table public.employment_actions(action text); create table public.compensation_instructions(amount numeric);");
    await db.exec("insert into public.employment_actions values('unchanged'); insert into public.compensation_instructions values(123);");
    await asUser(6);await review(1500,{...reviewBody(),evidence:[{id:id(805),revision:1}],outcome:"B2"},602);
    const progression=async(scope=401)=>(await db.query("select public.read_progression_reviews($1) as data",[scope?id(scope):null])).rows[0].data;
    let head=null;let bandRefs=[];
    const packet=()=>({framework_version:"orion-sales/0.1-draft",competency_version:"orion-sales/0.1-draft",expected_history_id:head,
      outcome:"remain_L1",bands:bandRefs,supporting_evidence:[],rationale:"Human review of target-level context and requirements.",development_plan:"Arrange supported work and review the next evidence.",framework_requirements_confirmed:false,reviewed_at:new Date().toISOString()});
    const decide=(n,p=packet(),scope=401)=>db.query("select public.publish_progression_review($1,$2,$3)",[id(n),scope?id(scope):null,p]);
    await asUser(4);
    for(let n=1;n<=15;n++) {
      const code="C"+String(n).padStart(2,"0");
      await record(1200+n,{...finding(),competency_code:code});
      await review(1300+n,{...reviewBody(),competency_code:code,evidence:[{id:id(1200+n),revision:1}],outcome:"B5"});
      bandRefs.push({id:id(1300+n),revision:1});
    }
    await t.test("unknown level is unavailable; only private approved L1 initialization",async()=>{
      assert.equal((await progression()).current_level,null);
      await assert.rejects(decide(2000),/initial level confirmation/);
      await assert.rejects(db.query("select learner_progression.initialize($1,'ref','rationale')",[id(401)]),/permission denied/);
      await db.exec("reset role");await db.query("select learner_progression.initialize($1,'restricted/approved-enrollment','Human confirmed L1 learning enrollment.')",[id(401)]);
      await assert.rejects(db.query("select learner_progression.initialize($1,'ref','repeat')",[id(401)]),/already confirmed/);
      await asUser(4);const d=await progression();head=d.current_history_id;assert.equal(d.current_level,"L1");assert.equal(d.records.length,0);
      assert.equal(d.initial_confirmation.approved_by,id(4));assert.ok(!JSON.stringify(d).includes("restricted/"));
    });
    await t.test("anonymous, learner, out-of-scope denied; caller cannot forge level",async()=>{
      await asUser(null);await assert.rejects(decide(2000),/permission denied/);
      await asUser(1);await assert.rejects(decide(2000),/Reviewer scope/);await assert.rejects(decide(2000,packet(),null),/Reviewer scope/);
      await asUser(5);await assert.rejects(decide(2000),/Reviewer scope/);await assert.rejects(progression(401),/Reviewer scope/);
      await asUser(6);await assert.rejects(decide(2000,packet(),401),/Reviewer scope/);
      await asUser(4);await assert.rejects(decide(2000,{...packet(),current_level:"L4"}),/Unexpected progression field/);
    });
    await t.test("explicit choice, adjacent progression, rationale and remain/defer plan required",async()=>{
      await asUser(4);
      for(const outcome of [null,"","advance_L1_to_L3","remain_L2","advance_L2_to_L3"]) await assert.rejects(decide(2000,{...packet(),outcome}),/Explicit outcome/);
      await assert.rejects(decide(2000,{...packet(),rationale:""}),/check constraint/);
      for(const outcome of ["remain_L1","defer_insufficient_evidence"]) await assert.rejects(decide(2000,{...packet(),outcome,development_plan:""}),/check constraint/);
      await assert.rejects(decide(2000,{...packet(),outcome:"advance_L1_to_L2"}),/all 15 human band/);
      await assert.rejects(decide(2000,{...packet(),outcome:"advance_L1_to_L2",framework_requirements_confirmed:true,bands:bandRefs.slice(0,1)}),/all 15 human band/);
      await assert.rejects(decide(2000,{...packet(),expected_history_id:id(999)}),/history changed/);
    });
    await t.test("current same-episode versioned band sources only",async()=>{
      await asUser(4);
      for(const bands of [[{id:id(1301),revision:2}],[{id:id(100),revision:2}],[{id:id(1500),revision:1}]]) await assert.rejects(decide(2000,{...packet(),bands}),/Band unavailable/);
      await assert.rejects(decide(2000,{...packet(),framework_version:"other"}),/Unsupported framework/);
      await assert.rejects(decide(2000,{...packet(),competency_version:"other"}),/Unsupported framework/);
      await assert.rejects(decide(2000,{...packet(),bands:[bandRefs[0],bandRefs[0]]}),/one current review/);
      await review(1401,{...reviewBody(),outcome:"B5",evidence:[{id:id(1201),revision:1}],supersedes_id:id(1301),correction_reason:"Clarify rationale"});
      await assert.rejects(decide(2000),/stale\/superseded/);bandRefs[0]={id:id(1401),revision:2};
      await assert.rejects(decide(2000,{...packet(),supporting_evidence:[{id:id(100),revision:2}]}),/Supporting evidence unavailable/);
      await assert.rejects(decide(2000,{...packet(),supporting_evidence:[{id:id(802),revision:2}]}),/Supporting evidence unavailable/);
    });
    await t.test("remain/defer preserve official level and create no advancement",async()=>{
      await asUser(4);await decide(2000,{...packet(),bands:[]});
      await decide(2001,{...packet(),outcome:"defer_insufficient_evidence",bands:[],supporting_evidence:[{id:id(802),revision:1},{id:id(803),revision:1},{id:id(804),revision:1}]});
      const d=await progression();assert.equal(d.current_level,"L1");assert.equal(d.current_history_id,head);
      assert.equal(d.records.length,2);assert.ok(d.records.every(r=>r.level_event===null));
    });
    await t.test("approved advancement atomically appends official history; stale head and replay handled",async()=>{
      const p={...packet(),outcome:"advance_L1_to_L2",framework_requirements_confirmed:true};await decide(2010,p);await decide(2010,p);
      const d=await progression();const r=d.records[0];assert.equal(r.current_level,"L1");assert.equal(r.reviewer_user_id,id(4));assert.equal(r.person_id,id(21));assert.equal(r.employment_episode_id,id(31));
      assert.equal(r.level_event.level,"L2");assert.equal(r.level_event.event_kind,"advancement");assert.equal(r.level_event.previous_history_id,head);assert.equal(d.current_level,"L2");
      assert.equal(r.bands[0].rationale,undefined);assert.equal(r.bands[0].source_project,"test-project");
      await assert.rejects(decide(2011,p),/history changed/);await assert.rejects(decide(2010,{...p,rationale:"changed"}),/Submission ID conflict/);head=d.current_history_id;
    });
    await t.test("latest correction appends explicit retraction history, never overwrites",async()=>{
      const p={...packet(),outcome:"defer_insufficient_evidence",supersedes_id:id(2010),correction_reason:"Reconsidered work opportunity evidence."};
      await asUser(6);await assert.rejects(decide(2020,p,601),/Only original reviewer/);
      await asUser(4);await assert.rejects(decide(2020,{...p,correction_reason:""}),/Correction reason/);
      await decide(2020,p);let d=await progression();let r=d.records[0];assert.equal(d.current_level,"L1");assert.equal(r.current_level,"L1");assert.equal(r.revision,2);
      assert.equal(r.level_event.event_kind,"correction");assert.equal(r.level_event.previous_history_id,head);assert.equal(r.level_event.level,"L1");
      assert.equal(d.records.find(r=>r.id===id(2010)).level_event.level,"L2");assert.equal(d.records.find(r=>r.id===id(2010)).superseded_by,id(2020));head=d.current_history_id;
      await assert.rejects(decide(2021,{...packet(),supersedes_id:id(2010),correction_reason:"Old revision"}),/Only latest episode/);
      await decide(2021,{...packet(),outcome:"advance_L1_to_L2",framework_requirements_confirmed:true,supersedes_id:id(2020),correction_reason:"Current packet reviewed with opportunity supplied."});
      d=await progression();assert.equal(d.current_level,"L2");assert.equal(d.records[0].level_event.event_kind,"correction");head=d.current_history_id;
    });
    await t.test("all adjacent outcomes work; later decisions block earlier correction",async()=>{
      for(let level=2;level<=4;level++) {
        await decide(2030+level,{...packet(),outcome:`remain_L${level}`});
        assert.equal((await progression()).current_history_id,head);
        await decide(2040+level,{...packet(),outcome:`advance_L${level}_to_L${level+1}`,framework_requirements_confirmed:true});
        const d=await progression();assert.equal(d.current_level,`L${level+1}`);head=d.current_history_id;
      }
      await decide(2050,{...packet(),outcome:"remain_L5"});assert.equal((await progression()).current_level,"L5");
      await assert.rejects(decide(2051,{...packet(),outcome:"advance_L5_to_L6",framework_requirements_confirmed:true}),/Explicit outcome/);
      await assert.rejects(decide(2051,{...packet(),outcome:"defer_insufficient_evidence",supersedes_id:id(2044),correction_reason:"Older decision"}),/Only latest episode/);
    });
    await t.test("changed band sources flag prior decision without auto-lowering",async()=>{
      await review(1402,{...reviewBody(),competency_code:"C02",evidence:[{id:id(1202),revision:1}],outcome:"defer",supersedes_id:id(1302),correction_reason:"Need updated evidence"});
      const d=await progression();assert.equal(d.current_level,"L5");assert.equal(d.records[0].bands.find(b=>b.id===id(1302)).superseded_by,id(1402));
      await assert.rejects(decide(2052,{...packet(),outcome:"remain_L5"}),/stale\/superseded/);
      bandRefs[1]={id:id(1402),revision:2};
    });
    await t.test("learner sees own durable history, cannot alter or initialize",async()=>{
      await asUser(1);let d=await progression(null);assert.equal(d.current_level,"L5");assert.ok(d.records.length>0);assert.ok(d.records.every(r=>!r.can_correct));
      for(const sql of ["select * from learner_progression.reviews","update learner_progression.level_history set level='L1'","delete from learner_progression.reviews","insert into learner_progression.level_history(id) values('"+id(999)+"')"])
        await assert.rejects(db.query(sql),/permission denied/);
      await asUser(2);d=await progression(null);assert.equal(d.current_level,null);assert.equal(d.records.length,0);await assert.rejects(progression(401),/Reviewer scope/);
      await db.exec("reset role");await assert.rejects(db.query("update learner_progression.level_history set level='L1'"),/append-only/);await assert.rejects(db.query("delete from learner_progression.reviews"),/append-only/);
      await db.close();db=await PGlite.create(dir);await asUser(1);assert.equal((await progression(null)).current_level,"L5");
    });
    await t.test("revoked and expired scopes denied with same JWT",async()=>{
      await db.exec("reset role");await db.query("update learner_review.scopes set revoked_at=now(),revoked_by=$1,revocation_reason='revoked' where id=$2",[id(3),id(401)]);
      await asUser(4);await assert.rejects(progression(),/Reviewer scope/);await assert.rejects(decide(2060),/Reviewer scope/);
      await db.exec("reset role");await db.query("insert into learner_review.scopes(id,reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,approved_at,expires_at) values($1,$2,$3,'coach',$4,'expired',now()-interval '2 days',now()-interval '1 day')",[id(701),id(5),id(11),id(3)]);
      await asUser(5);await assert.rejects(progression(701),/Reviewer scope/);await assert.rejects(decide(2060,packet(),701),/Reviewer scope/);
    });
    await t.test("rehire starts unavailable, never inherits old level or evidence",async()=>{
      await db.exec("reset role");await db.query("update public.learner_bindings set revoked_at=now(),revoked_by=$1,revocation_reason='rehire' where id=$2",[id(3),id(11)]);
      await bind(13,1,21,33);await asUser(1);assert.equal((await progression(null)).current_level,null);assert.equal((await progression(null)).records.length,0);
      await grant(603,6,13);await asUser(6);assert.equal((await progression(601)).current_level,"L5");assert.equal((await progression(601)).can_create,false);
      await assert.rejects(decide(2070,packet(),601),/Active separate learner/);
      await assert.rejects(decide(2070,packet(),603),/initial level confirmation/);
      await db.exec("reset role");await db.query("select learner_progression.initialize($1,'restricted/new-enrollment','New episode L1 separately approved.')",[id(603)]);
      await asUser(6);head=(await progression(603)).current_history_id;
      await assert.rejects(decide(2070,packet(),603),/wrong episode/);
      await decide(2070,{...packet(),bands:[],outcome:"defer_insufficient_evidence"},603);
      await asUser(1);assert.equal((await progression(null)).current_level,"L1");assert.equal((await progression(null)).records[0].employment_episode_id,id(33));
    });
    await t.test("bounded history pagination and no employment/compensation side effects",async()=>{
      await asUser(6);await db.exec("begin");for(let n=2100;n<2152;n++) await decide(n,{...packet(),bands:[],outcome:"remain_L1"},603);await db.exec("commit");
      const first=await progression(603);assert.equal(first.records.length,51);
      const next=(await db.query("select public.read_progression_reviews($1,$2) as data",[id(603),first.records[49].sequence_no])).rows[0].data;
      const rows=[...first.records.slice(0,50),...next.records];assert.equal(rows.length,53);assert.equal(new Set(rows.map(r=>r.id)).size,53);
      await db.exec("reset role");assert.deepEqual((await db.query("select * from public.employment_actions")).rows,[{action:"unchanged"}]);assert.equal((await db.query("select amount::text from public.compensation_instructions")).rows[0].amount,"123");assert.deepEqual((await db.query("select level from public.progression_levels")).rows,[{level:"L1"}]);
      assert.deepEqual((await db.query("select band from public.competency_bands")).rows,[{band:"B2"}]);
      assert.equal((await db.query("select employment_episode_id from public.learner_bindings where id=$1",[id(13)])).rows[0].employment_episode_id,id(33));
    });
  } finally {
    await db.close();
    if (!resolve(dir).startsWith(resolve(tmpdir())+sep) || !resolve(dir).split(sep).at(-1).startsWith("orion-coaching-test-")) throw new Error("Unsafe cleanup path");
    await rm(dir,{recursive:true,force:true});
  }
});

test("progression form has no selected outcome and offers only adjacent choices",()=>{
  assert.equal(initialProgressionOutcome,"");
  assert.deepEqual(progressionOutcomes(null),[]);
  assert.deepEqual(progressionOutcomes("L1"),["remain_L1","advance_L1_to_L2","defer_insufficient_evidence"]);
  assert.deepEqual(progressionOutcomes("L5"),["remain_L5","defer_insufficient_evidence"]);
  assert.deepEqual(parseProgressionRefs(id(1301)+" 1"),[{id:id(1301),revision:1}]);
  assert.throws(()=>parseProgressionRefs(id(1301)+" 1 extra"));
});
