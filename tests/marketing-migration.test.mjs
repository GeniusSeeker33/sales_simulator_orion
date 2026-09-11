import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const id=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");

test("marketing campaigns are workspace scoped, audited, and human approved", async t => {
  const db=await PGlite.create();
  try {
    await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;");
    await db.exec(await readFile(new URL("../supabase/migrations/20260911120000_marketing_command_center.sql",import.meta.url),"utf8"));
    for(const n of [1,2,3,4]) await db.query("insert into auth.users values($1)",[id(n)]);
    const orion="4f52494f-4e00-4000-8000-000000000001", other=id(20);
    await db.query("insert into marketing.workspaces(id,slug,name) values($1,'other','Other')",[other]);
    await db.query("insert into marketing.workspace_members values($1,$2,'contributor',now()),($1,$3,'approver',now()),($4,$2,'viewer',now())",[orion,id(1),id(2),other]);
    const asUser=async n=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):""]);await db.exec(n?"set role authenticated":"set role anon");};
    const payload=(approval="draft",status="draft")=>({name:"Dealer Growth",description:"",status,approval_state:approval,objectives:["Leads"],target_audiences:["Dealers"],channels:["web"],owner_user_id:id(1),budget_amount:"1200",budget_currency:"USD",starts_on:"2026-10-01",ends_on:"2026-10-31",attribution_key:"dealer-growth-q4"});
    const save=(user,campaign,revision,p,actor="human",run=null)=>asUser(user).then(()=>db.query("select public.save_marketing_campaign($1,$2,$3,$4,$5,$6)",[campaign,orion,revision,p,actor,run]));
    await t.test("anonymous, viewers, and other workspaces cannot write or read",async()=>{
      await asUser(null);await assert.rejects(db.query("select public.read_marketing_workspace(null)"),/permission denied/);
      await asUser(1);
      await assert.rejects(db.query("select public.save_marketing_campaign($1,$2,null,$3,'human',null)",[id(40),other,payload()]),/write access/);
      await asUser(3);await assert.rejects(db.query("select public.read_marketing_workspace(null)"),/workspace unavailable/);
    });
    await t.test("contributor creates a draft with tenant attribution and audit",async()=>{
      await save(1,id(30),null,payload());
      const data=(await db.query("select public.read_marketing_workspace($1) data",[orion])).rows[0].data;
      assert.equal(data.campaigns.length,1);assert.equal(data.campaigns[0].workspace_id,orion);assert.equal(data.campaigns[0].attribution_key,"dealer-growth-q4");
      await db.exec("reset role");const audit=(await db.query("select * from marketing.campaign_transitions")).rows;
      assert.equal(audit.length,1);assert.equal(audit[0].actor_type,"human");
    });
    await t.test("contributors and agents cannot approve or activate",async()=>{
      await assert.rejects(save(1,id(30),1,payload("approved","active")),/approver role/);
      await db.exec("reset role");await db.query("insert into marketing.agent_runs(id,workspace_id,campaign_id,agent_key,purpose,status,initiated_by) values($1,$2,$3,'copy-agent','draft','started',$4)",[id(50),orion,id(30),id(1)]);
      await assert.rejects(save(1,id(30),1,payload("approved","active"),"agent",id(50)),/Agents cannot approve/);
      await save(1,id(30),1,payload("in_review","planned"),"agent",id(50));
      await db.exec("reset role");await db.query("insert into marketing.agent_runs(id,workspace_id,agent_key,purpose,status,initiated_by) values($1,$2,'brief-agent','draft','started',$3)",[id(51),orion,id(1)]);
      await save(1,id(32),null,{...payload("draft","draft"),attribution_key:"agent-origin-draft"},"agent",id(51));
    });
    await t.test("human approver can approve and activation is audited",async()=>{
      await save(2,id(30),2,payload("approved","active"));
      await save(2,id(32),1,{...payload("approved","planned"),attribution_key:"agent-origin-draft"});
      await db.exec("reset role");const c=(await db.query("select * from marketing.campaigns where id=$1",[id(30)])).rows[0];
      assert.equal(c.approval_state,"approved");assert.equal(c.status,"active");assert.equal(c.revision,3);
      assert.equal((await db.query("select count(*)::int n from marketing.campaign_transitions where campaign_id=$1",[id(30)])).rows[0].n,3);
      await assert.rejects(db.query("delete from marketing.campaign_transitions"),/append-only/);
    });
    await t.test("optimistic revisions, workspace keys, and direct writes are protected",async()=>{
      await assert.rejects(save(2,id(30),1,payload("approved","active")),/Campaign changed/);
      await asUser(1);await assert.rejects(db.query("update marketing.campaigns set name='changed'"),/permission denied/);
      await assert.rejects(save(1,id(31),null,{...payload(),name:"Duplicate"}),/unique constraint/);
    });
  } finally { await db.close(); }
});
