import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../api/marketing-agent-run.js';
import { validateOutput } from '../api/_lib/marketing-agents.js';

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
  for (const name of ['20260911120000_marketing_command_center.sql', '20260912111609_marketing_campaign_workflow.sql', '20260912161020_marketing_agent_run_layer.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
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
      makeModel: () => ({ responses: { create: async options => { calls++; assert.equal(options.store, false); assert.equal(options.text.format.strict, true); assert.ok(!JSON.stringify(options).includes('server-secret')); if (beforeOutput) await beforeOutput(); if (modelError) throw new Error('SECRET provider detail'); return { status, output_text: typeof output === 'string' ? output : JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } }; } } }),
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
});

test('strict contracts reject nested malformed proposals and approval recommendations', () => {
  assert.throws(() => validateOutput('strategist', { ...plan, steps: [{ title: 'A', rationale: 'B', budget: 5 }] }));
  assert.throws(() => validateOutput('strategist', { ...plan, steps: [] }));
  assert.throws(() => validateOutput('guardian', { ...guardian, recommendation: 'approved' }));
  assert.throws(() => validateOutput('guardian', { ...guardian, findings: [{ category: 'claims', severity: 'blocker', finding: 'Unsupported' }] }));
});
