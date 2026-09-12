import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../api/marketing-agent-run.js';
import { validateOutput } from '../api/_lib/marketing-agents.js';
import { deriveMarketingAttention } from '../src/lib/marketingAttention.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspace = '4f52494f-4e00-4000-8000-000000000001', campaign = id(10), other = id(20);
const plan = { summary: 'Prepare a demo campaign.', steps: [{ title: 'Prepare copy', rationale: 'Explain the offer.' }], proposed_tasks: ['Write social draft'] };
const draft = { name: 'Agent draft', asset_type: 'social_copy', content: 'Book a demo' };
const guardian = { summary: 'CTA reviewed.', recommendation: 'ready_for_human_review', findings: [] };
const signatures = {
  start_marketing_agent_run: ['p_id', 'p_human', 'p_request', 'p_version', 'p_model'],
  finish_marketing_agent_run: ['p_id', 'p_output', 'p_qa', 'p_usage', 'p_error'],
};

test('Marketing agent server boundary with PostgreSQL and mocked inference', async t => {
  const db = await PGlite.create();
  const env = { ...process.env };
  t.after(async () => { process.env = env; await db.close(); });
  Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://test.invalid', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'public', LEARNER_SUPABASE_SERVICE_ROLE_KEY: 'server-secret' });
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const name of ['20260911120000_marketing_command_center.sql', '20260912111609_marketing_campaign_workflow.sql', '20260912161020_marketing_agent_run_layer.sql', '20260912172142_marketing_attention_creator_revision.sql', '20260912185640_marketing_human_resolution_actions.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  for (let n = 1; n <= 4; n++) await db.query('insert into auth.users values($1)', [id(n)]);
  await db.query("insert into marketing.workspaces(id,slug,name) values($1,'other','Other')", [other]);
  await db.query("insert into marketing.workspace_members(workspace_id,user_id,role) values($1,$3,'contributor'),($1,$4,'approver'),($1,$5,'viewer'),($2,$6,'admin')", [workspace, other, id(1), id(2), id(3), id(4)]);
  const asUser = async n => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']); await db.exec(n ? 'set role authenticated' : 'set role anon'); };
  await asUser(1);
  await db.query('select public.save_marketing_campaign($1,$2,null,$3)', [campaign, workspace, { name: 'Demo', attribution_key: 'demo', target_audiences: ['Dealers'], channels: ['social'] }]);
  await db.query('select public.save_marketing_brief($1,$2,1,$3)', [workspace, campaign, { objectives: ['Demos'], target_audiences: ['Dealers'], channels: ['social'], primary_cta: 'Book a demo' }]);
  const request = (agent = 'strategist', extra = {}) => ({ workspace_id: workspace, campaign_id: campaign, agent_key: agent, purpose: 'Prepare demo work', ...(agent === 'creator' ? { asset_type: 'social_copy', submit_for_review: true } : {}), ...extra });
  const rpc = async (name, args) => {
    try {
      await db.exec('reset role; set role service_role');
      const keys = signatures[name];
      return { data: (await db.query(`select public.${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) data`, keys.map(k => args[k]))).rows[0].data, error: null };
    } catch (error) { return { data: null, error }; }
  };
  let calls = 0;
  const invoke = async ({ body = request(), human = 1, auth = true, token = 'verified', output = plan, modelError = false, beforeOutput, status = 'completed', rpcOverride } = {}) => {
    const handler = createHandler({
      makeClient: (_url, key) => key === 'public' ? { auth: { getUser: async supplied => { assert.equal(supplied, token); return { data: { user: auth ? { id: id(human) } : null }, error: !auth }; } } } : { rpc: rpcOverride || rpc },
      makeModel: () => ({ responses: { create: async options => { calls++; assert.equal(options.store, false); assert.equal(options.text.format.strict, true); assert.ok(!JSON.stringify(options).includes('server-secret')); if (beforeOutput) await beforeOutput(JSON.parse(options.input[1].content)); if (modelError) throw new Error('SECRET provider detail'); return { status, output_text: typeof output === 'string' ? output : JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } }; } } }),
    });
    const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: 'POST', headers: { authorization: token ? `Bearer ${token}` : '' }, body }, res);
    assert.ok(!JSON.stringify(res.body).includes('SECRET'));
    return res;
  };
  const count = async table => { await db.exec('reset role'); return Number((await db.query(`select count(*) n from marketing.${table}`)).rows[0].n); };
  let created;
  await t.test('missing/invalid authentication and unauthorized initiation deny inference and runs', async () => {
    for (const [options, expected] of [[{ token: '' }, 401], [{ auth: false }, 401], [{ human: 3 }, 403], [{ human: 4 }, 403], [{ body: request('strategist', { workspace_id: other }) }, 403], [{ body: request('strategist', { campaign_id: id(99) }) }, 403]]) assert.equal((await invoke(options)).statusCode, expected);
    assert.equal(calls, 0); assert.equal(await count('agent_runs'), 0);
    for (const field of ['actor_type', 'initiated_by', 'approval_state']) assert.equal((await invoke({ body: { ...request(), [field]: 'agent' } })).statusCode, 400);
  });
  await t.test('authenticated Strategist stores attributable proposal without changing campaign or tasks', async () => {
    await db.exec('reset role');
    const before = (await db.query('select * from marketing.campaigns')).rows;
    const res = await invoke(); assert.equal(res.statusCode, 200);
    const run = res.body.run;
    assert.equal(run.initiated_by, id(1)); assert.equal(run.workspace_id, workspace); assert.equal(run.campaign_id, campaign); assert.equal(run.agent_key, 'strategist');
    assert.deepEqual(run.output_metadata.result, plan); assert.equal(run.status, 'succeeded'); assert.ok(run.started_at); assert.ok(run.ended_at); assert.equal(run.usage.total_tokens, 150); assert.equal(run.cost_usd, null);
    assert.equal(await count('campaign_tasks'), 0); assert.deepEqual((await db.query('select * from marketing.campaigns')).rows, before);
  });
  await t.test('Creator saves and submits attributable draft, never approval', async () => {
    const res = await invoke({ human: 2, body: request('creator'), output: draft });
    assert.equal(res.statusCode, 200); created = res.body.run;
    await db.exec('reset role');
    const asset = (await db.query('select * from marketing.assets where id=$1', [created.outcome_asset_id])).rows[0];
    assert.equal(asset.created_via, 'agent'); assert.equal(asset.agent_run_id, created.id); assert.equal(asset.created_by, id(2)); assert.equal(asset.approval_state, 'in_review'); assert.equal(asset.approved_by, null); assert.equal(asset.publication_state, 'unpublished');
    const history = (await db.query('select * from marketing.workflow_history where asset_id=$1 order by id', [asset.id])).rows;
    assert.deepEqual(history.map(h => h.action), ['asset_saved', 'submitted']); assert.ok(history.every(h => h.agent_run_id === created.id && h.actor_type === 'agent' && h.actor_user_id === id(2)));
  });
  await t.test('Guardian evidence preserves asset state and records deterministic QA', async () => {
    await db.exec('reset role'); const before = (await db.query('select * from marketing.assets')).rows;
    const res = await invoke({ body: request('guardian', { asset_id: created.outcome_asset_id }), output: guardian });
    assert.equal(res.statusCode, 200); assert.equal(res.body.run.output_metadata.result.recommendation, 'ready_for_human_review');
    assert.ok(res.body.run.output_metadata.deterministic_qa.every(c => c.passed));
    await db.exec('reset role'); assert.deepEqual((await db.query('select * from marketing.assets')).rows, before);
    assert.equal((await invoke({ body: request('guardian', { asset_id: id(99) }), output: guardian })).statusCode, 403);
  });
  await t.test('malformed, forged, incomplete and failed model outputs leave no partial assets', async () => {
    const assets = await count('assets'), history = await count('workflow_history');
    for (const options of [{ output: 'not JSON' }, { output: { ...draft, approval_state: 'approved' } }, { output: { ...draft, content: '' } }, { output: { ...draft, asset_type: 'web_copy' } }, { output: draft, status: 'incomplete' }, { modelError: true }]) {
      const res = await invoke({ body: request('creator'), ...options }); assert.equal(res.statusCode, 502); assert.equal(res.body.run.status, 'failed'); assert.deepEqual(res.body.run.output_metadata, {}); assert.ok(res.body.run.ended_at);
    }
    assert.equal(await count('assets'), assets); assert.equal(await count('workflow_history'), history);
  });
  await t.test('save-only Creator remains draft and deterministic Guardian failures override model recommendation', async () => {
    const saved = await invoke({ body: request('creator', { submit_for_review: false }), output: { ...draft, content: 'TODO: add CTA' } });
    await db.exec('reset role');
    assert.equal((await db.query('select approval_state from marketing.assets where id=$1', [saved.body.run.outcome_asset_id])).rows[0].approval_state, 'draft');
    const body = request('guardian', { asset_id: saved.body.run.outcome_asset_id });
    const reviewed = await invoke({ body, output: guardian });
    assert.equal(reviewed.body.run.output_metadata.result.recommendation, 'needs_changes');
    assert.ok(reviewed.body.run.output_metadata.deterministic_qa.some(c => !c.passed));
    const stale = await invoke({ body, output: guardian, beforeOutput: async () => { await db.exec('reset role'); await db.query('update marketing.assets set revision=revision+1 where id=$1', [body.asset_id]); } });
    assert.equal(stale.body.run.error_code, 'result_rejected');
  });
  await t.test('stale campaign and revoked membership reject results transactionally', async () => {
    const before = await count('assets');
    const res = await invoke({ body: request('creator'), output: draft, beforeOutput: async () => { await db.exec('reset role'); await db.query('update marketing.campaigns set revision=revision+1 where id=$1', [campaign]); } });
    assert.equal(res.body.run.error_code, 'result_rejected'); assert.equal(await count('assets'), before);
    const revoked = await invoke({ beforeOutput: async () => { await db.exec('reset role'); await db.query("update marketing.workspace_members set role='viewer' where user_id=$1", [id(1)]); } });
    assert.equal(revoked.body.run.status, 'failed'); await db.exec('reset role'); await db.query("update marketing.workspace_members set role='contributor' where user_id=$1", [id(1)]);
  });
  await t.test('browser cannot invoke server RPCs, private writes, or forge agent approval', async () => {
    await asUser(2);
    for (const sql of ["select public.start_marketing_agent_run(null,null,'{}','marketing-v1','model')", "select public.finish_marketing_agent_run(null,'{}','[]','{}',null)", "select marketing.write_asset_as_agent(null,null,null,null,'approve','{}',null)", "select marketing.save_campaign_as_agent(null,null,null,'{}',null)"]) await assert.rejects(db.exec(sql), /permission denied/);
    await assert.rejects(db.exec("update marketing.agent_runs set status='succeeded'"), /permission denied/);
    await db.exec('reset role');
    await assert.rejects(db.query("select marketing.write_asset_as_agent($1,$2,$3,2,'approve','{}',$4)", [workspace, campaign, created.outcome_asset_id, created.id]), /Agents cannot/);
    await assert.rejects(db.query("select marketing.write_asset_as_agent($1,$2,$3,2,'request_changes','{}',$4)", [workspace, campaign, created.outcome_asset_id, created.id]), /Agents cannot/);
  });
  await t.test('governed revision hands off human and Guardian feedback, preserves content and attributes a new run', async () => {
    const original = (await invoke({ body: request('creator'), output: draft })).body.run;
    const qa = (await invoke({ body: request('guardian', { asset_id: original.outcome_asset_id }), output: { ...guardian, recommendation: 'needs_changes', findings: [{ category: 'cta', severity: 'warning', requires_correction: true, finding: 'Explain the guided demo.' }] } })).body.run;
    await asUser(2);
    await db.query("select public.write_marketing_asset($1,$2,$3,2,'request_changes',$4)", [workspace, campaign, original.outcome_asset_id, { notes: 'Mention a guided demo; preserve the CTA.' }]);
    const workspaceData = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    assert.ok(deriveMarketingAttention(workspaceData).some(i => i.id === `asset:${original.outcome_asset_id}`));
    assert.ok(!deriveMarketingAttention(workspaceData).some(i => i.run_id === qa.id));
    const revisionRequest = { ...request('creator'), asset_type: undefined, revision_asset_id: original.outcome_asset_id, expected_asset_revision: 3,
      expected_campaign_revision: workspaceData.campaigns.find(c => c.id === campaign).revision, supplemental_instructions: 'Keep it concise.' };
    // JSON requests do not contain undefined keys.
    delete revisionRequest.asset_type;
    const revised = await invoke({ body: revisionRequest, output: { ...draft, content: 'Book a demo — a guided walkthrough.' }, beforeOutput: async context => {
      assert.equal(context.asset.content, draft.content); assert.equal(context.asset.revision, 3);
      assert.equal(context.human_change_request.notes, 'Mention a guided demo; preserve the CTA.');
      assert.equal(context.guardian_assessment.run_id, qa.id); assert.equal(context.guardian_assessment.asset_revision, 2);
      assert.equal(context.guardian_assessment.output_metadata.result.findings[0].finding, 'Explain the guided demo.');
      assert.equal(context.request.supplemental_instructions, 'Keep it concise.'); assert.equal(context.campaign.primary_cta, 'Book a demo');
    } });
    assert.equal(revised.statusCode, 200); assert.equal(revised.body.run.outcome_asset_id, original.outcome_asset_id); assert.notEqual(revised.body.run.id, original.id);
    await db.exec('reset role');
    const current = (await db.query('select * from marketing.assets where id=$1', [original.outcome_asset_id])).rows[0];
    assert.equal(current.revision, 5); assert.equal(current.approval_state, 'in_review'); assert.equal(current.approved_by, null); assert.equal(current.agent_run_id, original.id);
    const history = (await db.query('select * from marketing.workflow_history where asset_id=$1 order by id', [original.outcome_asset_id])).rows;
    assert.deepEqual(history.map(h => h.action), ['asset_saved', 'submitted', 'changes_requested', 'asset_saved', 'submitted']);
    assert.equal(history[0].snapshot.content, draft.content); assert.equal(history[2].notes, 'Mention a guided demo; preserve the CTA.');
    assert.equal(history[3].agent_run_id, revised.body.run.id); assert.equal(history[3].actor_type, 'agent'); assert.equal(history[4].agent_run_id, revised.body.run.id);
    assert.equal((await db.query('select output_metadata from marketing.agent_runs where id=$1', [qa.id])).rows[0].output_metadata.result.recommendation, 'needs_changes');
    assert.equal((await invoke({ body: revisionRequest, output: draft })).statusCode, 403);
    await asUser(2);
    await db.query("select public.write_marketing_asset($1,$2,$3,5,'request_changes',$4)", [workspace, campaign, current.id, { notes: 'Shorten it.' }]);
    const secondRequest = { ...revisionRequest, expected_asset_revision: 6, submit_for_review: false };
    assert.equal((await invoke({ body: secondRequest, human: 3 })).statusCode, 403);
    assert.equal((await invoke({ body: { ...secondRequest, workspace_id: other }, human: 4 })).statusCode, 403);
    assert.equal((await invoke({ body: { ...secondRequest, actor_type: 'agent' } })).statusCode, 400);
    const stale = await invoke({ body: secondRequest, output: draft, beforeOutput: async () => {
      await asUser(1); await db.query("select public.write_marketing_asset($1,$2,$3,6,'save',$4)", [workspace, campaign, current.id, { ...draft, content: 'Human revised instead.' }]);
    } });
    assert.equal(stale.body.run.status, 'failed'); assert.equal(stale.body.run.error_code, 'result_rejected');
    await db.exec('reset role'); assert.equal((await db.query('select content from marketing.assets where id=$1', [current.id])).rows[0].content, 'Human revised instead.');
  });
  await t.test('attention covers old runs beyond activity pagination and reads remain workspace isolated', async () => {
    await db.exec('reset role');
    await db.query("insert into marketing.agent_runs(id,workspace_id,campaign_id,agent_key,purpose,status,initiated_by) select gen_random_uuid(),$1,$2,'strategist','Legacy proposal','succeeded',$3 from generate_series(1,55)", [workspace, campaign, id(1)]);
    await asUser(1);
    const result = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    assert.ok(result.attention_runs.length > 55); assert.equal((await db.query('select public.read_marketing_agent_runs($1,null) data', [workspace])).rows[0].data.length, 50);
    assert.ok(deriveMarketingAttention(result).some(i => i.id === `run:${result.attention_runs.find(r => r.status === 'failed').id}`));
    assert.equal((await db.query('select public.read_marketing_agent_run($1,$2) data', [workspace, created.id])).rows[0].data.id, created.id);
    await asUser(4);
    await assert.rejects(db.query('select public.read_marketing_attention_workspace($1)', [workspace]), /unavailable/);
    await assert.rejects(db.query('select public.read_marketing_agent_run($1,$2)', [other, created.id]), /unavailable/);
  });
  await t.test('revision save-only, stale campaign and malformed revision output are governed', async () => {
    const original = (await invoke({ body: request('creator'), output: draft })).body.run;
    await asUser(2);
    await db.query("select public.write_marketing_asset($1,$2,$3,2,'request_changes',$4)", [workspace, campaign, original.outcome_asset_id, { notes: 'Shorten the copy.' }]);
    const c = (await db.query('select revision from marketing.campaigns where id=$1', [campaign])).rows[0];
    const body = { workspace_id: workspace, campaign_id: campaign, agent_key: 'creator', purpose: 'Revise', revision_asset_id: original.outcome_asset_id,
      expected_asset_revision: 3, expected_campaign_revision: c.revision, submit_for_review: false };
    assert.equal((await invoke({ body: { ...body, expected_asset_revision: 2 }, output: draft })).statusCode, 409);
    const malformed = await invoke({ body, output: { ...draft, approval_state: 'approved' } });
    assert.equal(malformed.body.run.error_code, 'invalid_output');
    const stale = await invoke({ body, output: draft, beforeOutput: async () => {
      await db.exec('reset role'); await db.query('update marketing.campaigns set revision=revision+1 where id=$1', [campaign]);
    } });
    assert.equal(stale.body.run.error_code, 'result_rejected');
    const saved = await invoke({ body: { ...body, expected_campaign_revision: c.revision + 1 }, output: draft, beforeOutput: async context => { assert.equal(context.guardian_assessment, null); } });
    assert.equal(saved.statusCode, 200); await db.exec('reset role');
    const a = (await db.query('select * from marketing.assets where id=$1', [original.outcome_asset_id])).rows[0];
    assert.equal(a.revision, 4); assert.equal(a.approval_state, 'draft'); assert.equal(a.approved_by, null);
    assert.equal((await db.query("select count(*) n from marketing.workflow_history where asset_id=$1 and action='approved'", [a.id])).rows[0].n, 0);
    await asUser(2);
    await db.query("select public.write_marketing_asset($1,$2,$3,null,'save',$4)", [workspace, campaign, id(101), draft]);
    await db.query("select public.write_marketing_asset($1,$2,$3,1,'submit','{}')", [workspace, campaign, id(101)]);
    await db.query("select public.write_marketing_asset($1,$2,$3,2,'request_changes',$4)", [workspace, campaign, id(101), { notes: 'Human-created draft changes.' }]);
    assert.equal((await invoke({ body: { ...body, revision_asset_id: id(101), expected_campaign_revision: c.revision + 1 }, output: draft })).statusCode, 403);
  });
  await t.test('submission failure rolls back the new asset and its history', async () => {
    const before = await count('assets'), history = await count('workflow_history');
    await db.exec(`create function marketing.test_reject_submit() returns trigger language plpgsql as $$ begin if new.approval_state='in_review' then raise exception 'test submission failure'; end if; return new; end $$;
      create trigger test_reject_submit before update on marketing.assets for each row execute function marketing.test_reject_submit();`);
    const res = await invoke({ body: request('creator'), output: draft });
    assert.equal(res.body.run.status, 'failed'); assert.equal(res.body.run.error_code, 'result_rejected');
    assert.equal(await count('assets'), before); assert.equal(await count('workflow_history'), history);
    await db.exec('drop trigger test_reject_submit on marketing.assets; drop function marketing.test_reject_submit()');
  });
  await t.test('ambiguous completion response retries the same run without duplicating its result', async () => {
    let first = true;
    const before = await count('assets');
    const res = await invoke({ body: request('creator'), output: draft, rpcOverride: async (name, args) => {
      const result = await rpc(name, args);
      if (name === 'finish_marketing_agent_run' && first) { first = false; return { data: null, error: new Error('connection lost after commit') }; }
      return result;
    } });
    assert.equal(res.statusCode, 200); assert.equal(await count('assets'), before + 1);
  });
  await t.test('history and terminal runs are immutable; completion retries cannot duplicate drafts', async () => {
    await db.exec('reset role');
    for (const sql of ["delete from marketing.agent_run_history", "update marketing.agent_run_history set snapshot='{}'", "delete from marketing.agent_runs", "update marketing.agent_runs set purpose='rewrite'"]) await assert.rejects(db.exec(sql), /immutable|append-only/);
    const before = await count('assets');
    const result = await rpc('finish_marketing_agent_run', { p_id: created.id, p_output: draft, p_qa: [], p_usage: {}, p_error: null });
    assert.equal(result.data.id, created.id); assert.equal(await count('assets'), before);
    const snapshots = (await db.query('select snapshot from marketing.agent_run_history where agent_run_id=$1 order by id', [created.id])).rows;
    assert.deepEqual(snapshots.map(s => s.snapshot.status), ['started', 'succeeded']);
  });
  await t.test('run reads and history are workspace isolated', async () => {
    await asUser(4);
    assert.equal((await db.query('select * from marketing.agent_runs')).rows.length, 0);
    assert.equal((await db.query('select * from marketing.agent_run_history')).rows.length, 0);
    await assert.rejects(db.query('select public.read_marketing_agent_runs($1,null)', [workspace]), /unavailable/);
    await asUser(3); assert.ok((await db.query('select public.read_marketing_agent_runs($1,null) data', [workspace])).rows[0].data.length > 0);
  });
  await t.test('human resolutions validate persisted selections, roles, isolation and immutable evidence', async () => {
    const resolve = async (run, action, selection = [], w = workspace) => (await db.query('select public.resolve_marketing_agent_run($1,$2,$3,$4,$5) data', [w, run.id, action, selection, 'Human reviewed this proposal.'])).rows[0].data;
    const proposal = (await invoke({ output: { ...plan, proposed_tasks: ['First task', 'Second task'] } })).body.run;
    await asUser(0); await assert.rejects(resolve(proposal, 'accept_plan'), /permission denied/);
    await asUser(3); await assert.rejects(resolve(proposal, 'accept_plan'), /unavailable/);
    await asUser(4); await assert.rejects(resolve(proposal, 'accept_plan'), /unavailable/);
    await assert.rejects(resolve(proposal, 'accept_plan', [], other), /unavailable/);
    await asUser(1);
    const before = await count('campaign_tasks'); await asUser(1);
    for (const selection of [['Injected arbitrary task'], [0, 'Injected task'], [0, 999], [0, 0], [-1], [0.5], [], { title: 'Injected' }]) await assert.rejects(resolve(proposal, 'create_tasks', selection), /Invalid/);
    await assert.rejects(resolve(proposal, 'approve'), /Invalid/);
    assert.equal(await count('campaign_tasks'), before); await asUser(1);
    const record = await resolve(proposal, 'create_tasks', [1]);
    assert.equal(record.actor_user_id, id(1)); assert.equal(record.agent_run_id, proposal.id); assert.equal(record.campaign_id, campaign); assert.equal(record.workspace_id, workspace); assert.ok(record.occurred_at);
    const task = (await db.query('select * from marketing.campaign_tasks where id=$1', [record.created_task_ids[0]])).rows[0];
    assert.equal(task.title, 'Second task'); assert.equal(task.status, 'todo'); assert.equal(task.owner_user_id, null); assert.equal(task.due_on, null); assert.equal(task.created_by, id(1));
    const history = (await db.query('select * from marketing.workflow_history where task_id=$1', [task.id])).rows[0];
    assert.equal(history.actor_type, 'human'); assert.equal(history.actor_user_id, id(1));
    await assert.rejects(resolve(proposal, 'dismiss'), /already resolved/);
    const snapshot = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    assert.ok(snapshot.resolutions.some(r => r.id === record.id)); assert.ok(!deriveMarketingAttention(snapshot).some(i => i.run_id === proposal.id));
    await assert.rejects(db.query('insert into marketing.agent_run_resolutions(id) values($1)', [id(800)]), /permission denied/);
    await asUser(4); await assert.rejects(db.query('select public.read_marketing_attention_workspace($1)', [workspace]), /unavailable/);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select to_jsonb(r) data from marketing.agent_runs r where id=$1', [proposal.id])).rows[0].data, proposal);
    await assert.rejects(db.query("update marketing.agent_runs set purpose='erase' where id=$1", [proposal.id]), /immutable|append-only/i);
    await assert.rejects(db.query("update marketing.agent_run_resolutions set note='erase' where id=$1", [record.id]), /immutable|append-only/i);
    await assert.rejects(db.query('delete from marketing.agent_run_resolutions where id=$1', [record.id]), /immutable|append-only/i);
    await db.query("insert into marketing.workspace_members(workspace_id,user_id,role) values($1,$2,'admin')", [workspace, id(4)]);
    for (const [human, action] of [[1, 'accept_plan'], [2, 'dismiss'], [4, 'accept_plan']]) {
      const run = (await invoke()).body.run; await asUser(human);
      const resolved = await resolve(run, action); assert.equal(resolved.action, action); assert.equal(resolved.actor_user_id, id(human)); assert.deepEqual(resolved.created_task_ids, []);
    }
  });
  await t.test('Guardian human submission checks current revision and preserves a separate approval decision', async () => {
    const makeReady = async () => {
      const creator = (await invoke({ body: request('creator', { submit_for_review: false }), output: draft })).body.run;
      const run = (await invoke({ body: request('guardian', { asset_id: creator.outcome_asset_id }), output: guardian })).body.run;
      assert.equal(run.output_metadata.result.recommendation, 'ready_for_human_review');
      return run;
    };
    const submit = run => db.query("select public.resolve_marketing_agent_run($1,$2,'send_to_approval','[]',null)", [workspace, run.id]);
    const run = await makeReady();
    await asUser(3); await assert.rejects(submit(run), /unavailable/);
    await asUser(1);
    let data = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    assert.equal(deriveMarketingAttention(data).find(i => i.run_id === run.id).severity, 'attention');
    await submit(run);
    data = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    const asset = data.assets.find(a => a.id === run.input_metadata.asset.id);
    assert.equal(asset.approval_state, 'in_review'); assert.equal(asset.approved_by, null);
    assert.ok(!deriveMarketingAttention(data).some(i => i.run_id === run.id)); assert.equal(deriveMarketingAttention(data).find(i => i.asset_id === asset.id).severity, 'critical');
    await assert.rejects(submit(run), /already resolved/);
    await assert.rejects(db.query("select public.write_marketing_asset($1,$2,$3,$4,'approve','{}')", [workspace, campaign, asset.id, asset.revision]), /approv|permission|role/i);
    await asUser(2); await db.query("select public.write_marketing_asset($1,$2,$3,$4,'approve','{}')", [workspace, campaign, asset.id, asset.revision]);
    data = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    assert.ok(!deriveMarketingAttention(data).some(i => i.asset_id === asset.id));
    assert.deepEqual((await db.query('select public.read_marketing_agent_run($1,$2) data', [workspace, run.id])).rows[0].data, run);
    const history = (await db.query('select action,actor_type from marketing.workflow_history where asset_id=$1 order by id', [asset.id])).rows;
    assert.deepEqual(history, [{ action: 'asset_saved', actor_type: 'agent' }, { action: 'submitted', actor_type: 'human' }, { action: 'approved', actor_type: 'human' }]);
    for (const action of ['save', 'submit']) {
      const stale = await makeReady(); await asUser(1);
      await db.query('select public.write_marketing_asset($1,$2,$3,1,$4,$5)', [workspace, campaign, stale.input_metadata.asset.id, action, action === 'save' ? { ...draft, content: 'Newer content' } : {}]);
      await assert.rejects(submit(stale), /changed or already submitted/);
      const fresh = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
      assert.ok(!fresh.resolutions.some(r => r.agent_run_id === stale.id));
    }
  });
  await t.test('hosted CTA regression persists advisory readiness and leaves human approval separate', async () => {
    await asUser(1);
    const c = (await db.query('select revision from marketing.campaigns where id=$1', [campaign])).rows[0];
    await db.query('select public.save_marketing_brief($1,$2,$3,$4)', [workspace, campaign, c.revision, { objectives: ['Dealer applications'], target_audiences: ['Dealers'], channels: ['social'], primary_cta: 'Apply to become an Orion Wholesale dealer at Join-Orion.com.' }]);
    const text = 'Take the first step by applying at Join-Orion.com to begin the dealer qualification process.';
    const creator = (await invoke({ body: request('creator'), output: { ...draft, content: text } })).body.run;
    const reviewed = await invoke({ body: request('guardian', { asset_id: creator.outcome_asset_id }), output: { summary: 'CTA is semantically suitable.', recommendation: 'needs_changes', findings: [{ category: 'cta', severity: 'info', requires_correction: false, finding: 'CTA wording differs but directs dealer applications to the correct destination.' }] } });
    assert.equal(reviewed.statusCode, 200);
    assert.equal(reviewed.body.run.output_metadata.result.recommendation, 'ready_for_human_review');
    assert.ok(reviewed.body.run.output_metadata.deterministic_qa.every(q => q.passed));
    await asUser(2);
    const data = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    const a = data.assets.find(asset => asset.id === creator.outcome_asset_id);
    assert.equal(a.approval_state, 'in_review'); assert.equal(a.approved_by, null); assert.equal(a.content, text);
    const attention = deriveMarketingAttention(data);
    assert.equal(attention.find(i => i.run_id === reviewed.body.run.id).severity, 'attention');
    assert.equal(attention.find(i => i.id === `asset:${a.id}`).severity, 'critical');
    await db.query("select public.write_marketing_asset($1,$2,$3,2,'approve',$4)", [workspace, campaign, a.id, { notes: 'Human approved equivalent CTA.' }]);
    const approved = (await db.query('select public.read_marketing_attention_workspace($1) data', [workspace])).rows[0].data;
    assert.ok(!deriveMarketingAttention(approved).some(i => i.run_id === reviewed.body.run.id || i.id === `asset:${a.id}`));
    assert.equal(approved.assets.find(asset => asset.id === a.id).approved_by, id(2));
  });
});

test('strict contracts reject nested malformed proposals and approval recommendations', () => {
  assert.throws(() => validateOutput('strategist', { ...plan, steps: [{ title: 'A', rationale: 'B', budget: 5 }] }));
  assert.throws(() => validateOutput('strategist', { ...plan, steps: [] }));
  assert.throws(() => validateOutput('guardian', { ...guardian, recommendation: 'approved' }));
  assert.throws(() => validateOutput('guardian', { ...guardian, findings: [{ category: 'claims', severity: 'blocker', finding: 'Unsupported' }] }));
});
