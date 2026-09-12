import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const workspace = "4f52494f-4e00-4000-8000-000000000001";
const other = id(20), campaign = id(30), task = id(40), asset = id(50), run = id(60);

test("governed campaign workflow against PostgreSQL", async t => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    for (const file of ["20260911120000_marketing_command_center.sql", "20260912111609_marketing_campaign_workflow.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    for (const n of [1, 2, 3, 4, 5]) await db.query("insert into auth.users values($1)", [id(n)]);
    await db.query("insert into marketing.workspaces(id,slug,name) values($1,'other','Other')", [other]);
    await db.query(`insert into marketing.workspace_members(workspace_id,user_id,role) values
      ($1,$3,'contributor'),($1,$4,'approver'),($1,$5,'viewer'),($2,$6,'admin'),($1,$7,'admin')`, [workspace, other, id(1), id(2), id(3), id(4), id(5)]);
    const asUser = async n => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : ""]);
      await db.exec(n ? "set role authenticated" : "set role anon");
    };
    const saveTask = (revision, payload, w = workspace, c = campaign, taskId = task) => db.query("select public.save_marketing_task($1,$2,$3,$4,$5)", [w, c, taskId, revision, payload]);
    const writeAsset = (revision, action, payload = {}, assetId = asset, w = workspace, c = campaign) => db.query("select public.write_marketing_asset($1,$2,$3,$4,$5,$6)", [w, c, assetId, revision, action, payload]);
    const draft = { name: "Dealer launch", asset_type: "social_copy", content: "Book a dealer demo." };
    const getAsset = async (assetId = asset) => (await db.query("select * from marketing.assets where id=$1", [assetId])).rows[0];
    await asUser(1);
    await db.query("select public.save_marketing_campaign($1,$2,null,$3)", [campaign, workspace, { name: "Dealer campaign", attribution_key: "dealer-campaign" }]);
    await asUser(4);
    await db.query("select public.save_marketing_campaign($1,$2,null,$3)", [id(31), other, { name: "Private campaign", attribution_key: "private-campaign" }]);
    await writeAsset(null, "save", draft, id(51), other, id(31));

    await t.test("workspace isolation and direct table protections", async () => {
      await asUser(1);
      const data = (await db.query("select public.read_marketing_workspace($1) data", [workspace])).rows[0].data;
      assert.equal(data.campaigns.length, 1);
      assert.equal(data.assets.length, 0);
      assert.equal(data.members.length, 4);
      assert.equal((await db.query("select * from marketing.assets")).rows.length, 0);
      await assert.rejects(db.query("select public.read_marketing_workspace($1)", [other]), /unavailable/);
      await assert.rejects(saveTask(null, { title: "Cross tenant" }, other, id(31)), /write access/);
      await assert.rejects(saveTask(null, { title: "Wrong campaign" }, workspace, id(31)), /Campaign unavailable/);
      await assert.rejects(writeAsset(1, "submit", {}, id(51)), /Asset unavailable/);
      await assert.rejects(db.query("select public.read_marketing_asset_history($1,$2)", [workspace, id(51)]), /Asset unavailable/);
      for (const table of ["campaign_tasks", "assets", "workflow_history"]) {
        await assert.rejects(db.exec(`delete from marketing.${table}`), /permission denied/);
      }
      await asUser(3);
      await assert.rejects(saveTask(null, { title: "Viewer task" }), /write access/);
      await assert.rejects(writeAsset(null, "save", draft), /write access/);
      await asUser(null);
      await assert.rejects(writeAsset(null, "save", draft), /permission denied/);
    });

    await t.test("brief reuses campaign fields and KPI table, records revision, resets approval", async () => {
      await asUser(2);
      await db.query("select public.save_marketing_campaign($1,$2,1,$3)", [campaign, workspace, { name: "Dealer campaign", attribution_key: "dealer-campaign", approval_state: "approved" }]);
      await asUser(1);
      const brief = { objectives: ["Demo bookings"], target_audiences: ["Dealers"], channels: ["web", "email"], offer: "Guided demo", primary_cta: "Book", key_message: "Practice selling", requirements: "No unsupported claims", notes: "Q4", kpis: [{ name: "Bookings", target_value: 20, unit: "count" }] };
      await db.query("select public.save_marketing_brief($1,$2,2,$3)", [workspace, campaign, brief]);
      const data = (await db.query("select public.read_marketing_workspace($1) data", [workspace])).rows[0].data;
      assert.equal(data.campaigns[0].approval_state, "draft");
      assert.equal(data.campaigns[0].revision, 3);
      assert.deepEqual(data.campaigns[0].objectives, brief.objectives);
      assert.equal(data.kpis[0].name, "Bookings");
      await assert.rejects(db.query("select public.save_marketing_brief($1,$2,2,$3)", [workspace, campaign, brief]), /Campaign changed/);
      await assert.rejects(db.query("select public.save_marketing_brief($1,$2,3,$3)", [workspace, campaign, { ...brief, created_via: "agent" }]), /Unexpected/);
      await assert.rejects(db.query("select public.save_marketing_brief($1,$2,3,$3)", [workspace, campaign, { ...brief, kpis: [{ name: "" }] }]), /Invalid success metrics/);
      assert.equal((await db.query("select * from marketing.campaign_kpis")).rows.length, 1);
    });

    await t.test("task creates, edits, assigns a workspace owner and date, validates revisions", async () => {
      await asUser(1);
      await saveTask(null, { title: "Write copy", status: "todo" });
      await saveTask(1, { title: "Draft web copy", status: "in_progress", owner_user_id: id(2), due_on: "2026-10-01" });
      await saveTask(2, { title: "Draft web copy", status: "blocked" });
      await saveTask(3, { title: "Draft web copy", status: "done" });
      const row = (await db.query("select * from marketing.campaign_tasks where id=$1", [task])).rows[0];
      assert.equal(row.created_by, id(1)); assert.equal(row.updated_by, id(1)); assert.equal(row.revision, 4); assert.equal(row.status, "done");
      await assert.rejects(saveTask(3, { title: "Stale" }), /Task changed/);
      await assert.rejects(saveTask(4, { title: "Bad owner", owner_user_id: id(4) }), /owner must belong/);
      await assert.rejects(saveTask(4, { title: "Bad state", status: "published" }), /check constraint/);
      await assert.rejects(saveTask(4, { title: "  " }), /Task title required/);
      await assert.rejects(saveTask(4, { title: "Forgery", created_by: id(2) }), /Unexpected/);
    });

    await t.test("asset creation preserves creator, starts draft, rejects forged governance", async () => {
      await writeAsset(null, "save", draft);
      const row = await getAsset();
      assert.equal(row.created_by, id(1)); assert.equal(row.created_via, "human"); assert.equal(row.approval_state, "draft");
      assert.equal(row.publication_state, "unpublished");
      for (const field of ["created_by", "created_via", "actor_type", "approved_by", "approval_state", "publication_state"]) {
        await assert.rejects(writeAsset(1, "save", { ...draft, [field]: "agent" }), /Unexpected/);
      }
      await assert.rejects(writeAsset(1, "publish"), /Invalid asset action/);
      await assert.rejects(writeAsset(1, "save", { ...draft, asset_type: "binary" }), /Invalid asset type/);
      await assert.rejects(writeAsset(1, "save", { ...draft, content: "x".repeat(50001) }), /check constraint/);
    });

    await t.test("submission, requested changes and resubmission are governed", async () => {
      await writeAsset(1, "submit");
      assert.equal((await getAsset()).approval_state, "in_review");
      await assert.rejects(writeAsset(2, "save", draft), /Request changes before editing/);
      await assert.rejects(writeAsset(2, "approve"), /Human approver role/);
      await assert.rejects(writeAsset(2, "request_changes", { notes: "Changes" }), /Human approver role/);
      await asUser(2);
      await assert.rejects(writeAsset(1, "approve"), /Asset changed/);
      await assert.rejects(writeAsset(2, "request_changes"), /Describe the requested changes/);
      await writeAsset(2, "request_changes", { notes: "Clarify the CTA." });
      assert.equal((await getAsset()).approval_state, "changes_requested");
      await asUser(1);
      await writeAsset(3, "save", { ...draft, content: "Book your guided dealer demo today." });
      await writeAsset(4, "submit");
      await asUser(2);
      await writeAsset(5, "approve", { notes: "CTA and claims checked." });
      const row = await getAsset();
      assert.equal(row.approval_state, "approved"); assert.equal(row.approved_by, id(2)); assert.ok(row.approved_at);
      assert.equal(row.created_by, id(1)); assert.equal(row.created_via, "human");
    });

    await t.test("approved revisions cannot be silently edited; audit snapshots survive", async () => {
      await asUser(1);
      await writeAsset(6, "save", { ...draft, content: "Another draft" });
      const row = await getAsset();
      assert.equal(row.approval_state, "draft"); assert.equal(row.approved_by, null); assert.equal(row.approved_at, null);
      const history = (await db.query("select public.read_marketing_asset_history($1,$2) data", [workspace, asset])).rows[0].data;
      assert.deepEqual(history.map(h => h.action), ["asset_saved", "approved", "submitted", "asset_saved", "changes_requested", "submitted", "asset_saved"]);
      const approved = history.find(h => h.action === "approved");
      assert.equal(approved.snapshot.content, "Book your guided dealer demo today.");
      assert.equal(approved.snapshot.campaign_context.primary_cta, "Book");
      assert.equal(approved.notes, "CTA and claims checked.");
      await db.exec("reset role");
      await assert.rejects(db.exec("delete from marketing.workflow_history"), /append-only/);
      await assert.rejects(db.exec("update marketing.workflow_history set notes='erased'"), /append-only/);
    });

    await t.test("agents can draft/submit privately but never self-approve, even for an approver", async () => {
      await db.query("insert into marketing.agent_runs(id,workspace_id,campaign_id,agent_key,purpose,status,initiated_by) values($1,$2,$3,'draft-agent','copy','started',$4)", [run, workspace, campaign, id(2)]);
      await asUser(2);
      const agentWrite = (revision, action, payload = {}, runId = run) => db.query("select marketing.write_asset_as_agent($1,$2,$3,$4,$5,$6,$7)", [workspace, campaign, id(52), revision, action, payload, runId]);
      await assert.rejects(agentWrite(null, "save", draft), /permission denied/);
      await db.exec("reset role");
      await assert.rejects(agentWrite(null, "save", draft, null), /Agent run unavailable/);
      await agentWrite(null, "save", draft);
      await agentWrite(1, "submit");
      await assert.rejects(agentWrite(2, "approve"), /Agents cannot/);
      await assert.rejects(agentWrite(2, "request_changes", { notes: "Self review" }), /Agents cannot/);
      await assert.rejects(agentWrite(2, "publish"), /Invalid asset action/);
      await asUser(5);
      await writeAsset(2, "approve", { notes: "Human checked agent draft." }, id(52));
      const row = await getAsset(id(52));
      assert.equal(row.created_via, "agent"); assert.equal(row.created_by, id(2)); assert.equal(row.approved_by, id(5));
      const history = (await db.query("select public.read_marketing_asset_history($1,$2) data", [workspace, id(52)])).rows[0].data;
      assert.equal(history[0].actor_type, "human"); assert.equal(history[1].agent_run_id, run);
      await asUser(4);
      assert.equal((await db.query("select * from marketing.workflow_history")).rows.every(h => h.workspace_id === other), true);
    });
  } finally { await db.close(); }
});
