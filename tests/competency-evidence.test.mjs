import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const migrations=["20260905170811_durable_learner_records.sql","20260905175922_scoped_reviewer_history.sql","20260905181617_attributable_coaching_sessions.sql","20260905191217_human_reviewed_competency_evidence.sql","20260905192514_human_approved_competency_band_review.sql","20260905194609_human_approved_progression.sql"];
test("competency evidence authorization, source validation and immutable findings",async t=>{
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
    await t.test("authorized reviewer publishes exact version, derived identity, and idempotent record",async()=>{
      await asUser(4);await record(800);await record(800);
      const r=(await evidence(401)).records[0];assert.equal(r.person_id,id(21));assert.equal(r.employment_episode_id,id(31));
      assert.equal(r.learner_binding_id,id(11));assert.equal(r.reviewer_user_id,id(4));assert.equal(r.competency_code,"C01");
      assert.equal(r.evidence.revision,2);assert.equal(r.evidence.source_project,"test-project");assert.equal(r.finding,"supports");
      assert.equal((await evidence(401)).records.length,1);
      await assert.rejects(record(800,{...finding(),finding:"disputed"}),/Submission ID conflict/);
    });
    await t.test("anonymous, learner, wrong and out-of-scope reviewers cannot publish or read another episode",async()=>{
      await asUser(null);await assert.rejects(record(801),/permission denied/);
      await asUser(1);await assert.rejects(record(801),/Reviewer scope/);await assert.rejects(record(801,finding(),null),/Reviewer scope/);
      assert.equal((await evidence()).records[0].id,id(800));
      await asUser(2);assert.deepEqual((await evidence()).records,[]);await assert.rejects(evidence(401),/Reviewer scope/);
      await asUser(5);await assert.rejects(record(801),/Reviewer scope/);await assert.rejects(evidence(401),/Reviewer scope/);
      await asUser(6);assert.equal((await evidence(601)).records[0].id,id(800));assert.equal((await evidence(601)).records[0].can_correct,false);
      await assert.rejects(record(801,finding(),602),/wrong episode/);
    });
    await t.test("reject stale, nonterminal, wrong-episode sources and unsupported fields/version/code",async()=>{
      await asUser(4);
      for(const e of [{kind:"attempt",id:id(100),revision:1},{kind:"attempt",id:id(102),revision:1},{kind:"attempt",id:id(200),revision:2}])
        await assert.rejects(record(801,{...finding(),evidence:e}),/Source unavailable/);
      await assert.rejects(record(801,{...finding(),competency_version:"made-up"}),/Unsupported competency/);
      await assert.rejects(record(801,{...finding(),competency_code:"C16"}),/check constraint/);
      await assert.rejects(record(801,{...finding(),source_type:"real_world_work"}),/No governed real-world/);
      for(const key of ["ai_feedback","transcript","score","band","level","person_id"])
        await assert.rejects(record(801,{...finding(),[key]:"forbidden"}),/Unexpected evidence field/);
    });
    await t.test("failure, disputed, insufficient opportunity remain non-scored evidence",async()=>{
      await asUser(4);
      const failed={...finding(),evidence:{kind:"simulation",id:sim,revision:2}};
      for(const f of ["supports","does_not_yet_support"]) await assert.rejects(record(801,{...failed,finding:f}),/Unscored source/);
      for(const [i,f] of ["technical_failure","disputed","insufficient_opportunity"].entries()) await record(810+i,{...failed,finding:f});
      const records=(await evidence(401)).records;
      for(const f of ["technical_failure","disputed","insufficient_opportunity"]) {
        const r=records.find(r=>r.finding===f);assert.ok(r);assert.equal(r.evidence.status,"technical_failure");
        for(const key of ["score","ai_score","band","level","ai_feedback"]) assert.equal(r[key],undefined);
      }
    });
    await t.test("coaching evidence preserves references, rejects corrected revisions and target mismatch",async()=>{
      await asUser(4);await publish(500);
      const p={...finding(),source_type:"human_coaching",evidence:{kind:"coaching",id:id(500),revision:1}};
      await record(820,p);
      const r=(await evidence(401)).records.find(r=>r.id===id(820));assert.equal(r.evidence.underlying_evidence[0].id,id(100));
      assert.equal(r.evidence.observed_behavior,undefined);assert.equal(r.evidence.next_action,undefined);
      await assert.rejects(record(821,{...p,competency_code:"C02"}),/match coaching target/);
      await assert.rejects(record(821,{...p,evidence:{...p.evidence,revision:2}}),/stale revision/);
      await publish(501,{...body(),supersedes_id:id(500),correction_reason:"Clarify"});
      await assert.rejects(record(821,p),/stale revision/);
      assert.equal((await evidence(401)).records.find(r=>r.id===id(820)).source_superseded_by,id(501));
      await record(821,{...p,evidence:{kind:"coaching",id:id(501),revision:2}});
    });
    await t.test("correction is reasoned, original-author only, append-only and latest-version only",async()=>{
      const p={...finding(),supersedes_id:id(800),correction_reason:"Opportunity was limited",finding:"insufficient_opportunity"};
      await asUser(6);await assert.rejects(record(830,p,601),/Only original reviewer/);
      await asUser(4);await assert.rejects(record(830,{...p,correction_reason:""}),/Correction reason/);
      await record(830,p);await assert.rejects(record(831,p),/latest version/);
      const rows=(await evidence(401)).records;assert.equal(rows.find(r=>r.id===id(800)).finding,"supports");
      assert.equal(rows.find(r=>r.id===id(800)).superseded_by,id(830));assert.equal(rows.find(r=>r.id===id(830)).revision,2);
      await asUser(1);assert.equal((await evidence()).records.length,7);
      for(const sql of ["select * from learner_competency.evidence","update learner_competency.evidence set finding='supports'","delete from learner_competency.evidence","insert into learner_competency.evidence(id) values('"+id(999)+"')"])
        await assert.rejects(db.query(sql),/permission denied/);
      await db.exec("reset role");await assert.rejects(db.query("update learner_competency.evidence set finding='supports'"),/append-only/);
      await assert.rejects(db.query("delete from learner_competency.evidence"),/append-only/);
    });
    await t.test("durable findings survive restart",async()=>{
      await db.close();db=await PGlite.create(dir);await asUser(1);assert.equal((await evidence()).records.length,7);
    });
    await t.test("revoked and expired reviewers denied future reads and writes",async()=>{
      await db.exec("reset role");await db.query("update learner_review.scopes set revoked_at=now(),revoked_by=$1,revocation_reason='revoked' where id=$2",[id(3),id(401)]);
      await asUser(4);await assert.rejects(evidence(401),/Reviewer scope/);await assert.rejects(record(840),/Reviewer scope/);
      await db.exec("reset role");await db.query("insert into learner_review.scopes(id,reviewer_user_id,learner_binding_id,reviewer_role,approved_by,approval_ref,approved_at,expires_at) values($1,$2,$3,'coach',$4,'expired',now()-interval '2 days',now()-interval '1 day')",[id(701),id(5),id(11),id(3)]);
      await asUser(5);await assert.rejects(evidence(701),/Reviewer scope/);await assert.rejects(record(840,finding(),701),/Reviewer scope/);
    });
    await t.test("rehire separates records, references and grants; old episode read is explicit only",async()=>{
      await db.exec("reset role");await db.query("update public.learner_bindings set revoked_at=now(),revoked_by=$1,revocation_reason='rehire' where id=$2",[id(3),id(11)]);
      await bind(13,1,21,33);await asUser(1);await makeAttempt(300,"written","completed");assert.deepEqual((await evidence()).records,[]);
      await grant(603,6,13);await asUser(6);assert.equal((await evidence(601)).records.length,7);assert.equal((await evidence(601)).can_create,false);
      await assert.rejects(record(850,finding(),601),/Active separate learner/);
      await assert.rejects(record(850,finding(),603),/wrong episode/);
      await record(850,{...finding(),evidence:{kind:"attempt",id:id(300),revision:2}},603);
      await asUser(1);assert.equal((await evidence()).records[0].employment_episode_id,id(33));
    });
    await t.test("bounded deterministic pagination preserves equal-timestamp records",async()=>{
      await asUser(6);
      await db.exec("begin");
      for(let n=900;n<952;n++) await record(n,{...finding(),evidence:{kind:"attempt",id:id(300),revision:2}},603);
      await db.exec("commit");
      const first=await evidence(603);assert.equal(first.records.length,51);
      const last=first.records[49];
      const next=(await db.query("select public.read_competency_evidence($1,$2,$3) as data",[id(603),last.created_at,last.id])).rows[0].data;
      const seen=[...first.records.slice(0,50),...next.records];assert.equal(seen.length,53);assert.equal(new Set(seen.map(r=>r.id)).size,53);
      await assert.rejects(db.query("select public.read_competency_evidence($1,$2,null)",[id(603),last.created_at]),/Incomplete cursor/);
    });
    await t.test("no band/level changes, no source mutation or copied AI content",async()=>{
      await db.exec("reset role");assert.deepEqual((await db.query("select band from public.competency_bands")).rows,[{band:"B2"}]);
      assert.deepEqual((await db.query("select level from public.progression_levels")).rows,[{level:"L1"}]);
      assert.equal((await db.query("select ai_score from public.learner_training_attempts where id=$1",[id(101)])).rows[0].ai_score,null);
      const cols=(await db.query("select column_name from information_schema.columns where table_schema='learner_competency'")).rows.map(r=>r.column_name);
      for(const k of ["score","band","level","transcript","ai_feedback"]) assert.ok(!cols.includes(k));
    });
  } finally {
    await db.close();
    if (!resolve(dir).startsWith(resolve(tmpdir())+sep) || !resolve(dir).split(sep).at(-1).startsWith("orion-coaching-test-")) throw new Error("Unsafe cleanup path");
    await rm(dir,{recursive:true,force:true});
  }
});
