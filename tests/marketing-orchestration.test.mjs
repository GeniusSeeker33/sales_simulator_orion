import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../api/marketing-orchestration.js';
import { deriveMarketingAttention } from '../src/lib/marketingAttention.js';
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const w = '4f52494f-4e00-4000-8000-000000000001', c = id(10), other = id(11);
const signatures = { command_marketing_orchestration: ['p_human', 'p_request'], finish_marketing_orchestration_stage: ['p_id', 'p_run', 'p_output', 'p_qa', 'p_usage', 'p_error'] };

test('governed task orchestration across actual PostgreSQL boundaries', async t => {
  const db = await PGlite.create(), env = { ...process.env };
  t.after(async () => { process.env = env; await db.close(); });
  Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://test.invalid', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'public', LEARNER_SUPABASE_SERVICE_ROLE_KEY: 'secret' });
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const name of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(n => n.includes('marketing')).sort()) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  for (let n = 1; n <= 4; n++) await db.query('insert into auth.users values($1)', [id(n)]);
  await db.query("insert into marketing.workspaces(id,slug,name) values($1,'outside','Outside')", [other]);
  await db.query("insert into marketing.workspace_members(workspace_id,user_id,role) values($1,$3,'contributor'),($1,$4,'approver'),($1,$5,'viewer'),($2,$6,'admin')", [w, other, id(1), id(2), id(3), id(4)]);
  const asUser = async n => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(n)]); await db.exec('set role authenticated'); };
  await asUser(1); await db.query('select public.save_marketing_campaign($1,$2,null,$3)', [c, w, { name: 'Orchestration', attribution_key: 'orchestration', target_audiences: ['Dealers'], channels: ['social'] }]);
  await db.query('select public.save_marketing_brief($1,$2,1,$3)', [w, c, { primary_cta: 'Book a demo', target_audiences: ['Dealers'], channels: ['social'] }]);
  let sequence = 30, calls = [], mode = 'ready', beforeModel, loseCompletion = false;
  const rpc = async (name, args) => {
    try {
      await db.exec('reset role; set role service_role'); const keys = signatures[name];
      const data = (await db.query(`select public.${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) data`, keys.map(k => args[k]))).rows[0].data;
      if (loseCompletion && name === 'finish_marketing_orchestration_stage' && !args.p_error) { loseCompletion = false; throw new Error('Lost committed response'); }
      return { data };
    }
    catch (error) { return { error }; }
  };
  const handler = createHandler({ makeClient: (_url, key) => key === 'public' ? { auth: { getUser: async token => ({ data: { user: token === 'invalid' ? null : { id: id(Number(token)) } } }) } } : { rpc },
    makeModel: () => ({ responses: { create: async options => {
      const context = JSON.parse(options.input[1].content), agent = context.request.agent_key;
      calls.push({ agent, context }); assert.equal(options.store, false); assert.equal(options.text.format.strict, true);
      assert.ok(context.task.id); assert.ok(context.orchestration.workflow);
      if (beforeModel) { const callback = beforeModel; beforeModel = null; await callback(context); }
      if (mode === 'failure' || mode === 'guardian_failure' && agent === 'guardian') throw new Error('private provider error');
      const output = agent === 'strategist' ? { summary: 'Task execution plan', steps: [{ title: 'Write task copy', rationale: 'Follow task scope' }], proposed_tasks: ['Prepare copy'] }
        : agent === 'creator' ? { name: 'Orchestrated draft', asset_type: context.request.asset_type, content: 'Book your demo.' }
        : { summary: 'QA', recommendation: mode === 'changes' ? 'needs_changes' : 'ready_for_human_review', findings: mode === 'changes' ? [{ category: 'audience', severity: 'warning', requires_correction: true, finding: 'Explain dealer benefit.' }] : [] };
      return { status: 'completed', output_text: mode === 'malformed' ? '{bad' : JSON.stringify(output), usage: { input_tokens: 50, output_tokens: 25, total_tokens: 75 } };
    } } }) });
  const invoke = async (body, human = 1) => { const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(data) { this.body = data; return this; } }; await handler({ method: 'POST', headers: { authorization: `Bearer ${human}` }, body }, res); return res; };
  const assignment = async (workflow = 'creator_guardian') => {
    const task = id(sequence++); await asUser(1);
    await db.query('select public.save_marketing_task($1,$2,$3,null,$4)', [w, c, task, { title: 'Prepare dealer demo', status: 'todo' }]);
    const campaign = (await db.query('select revision from marketing.campaigns where id=$1', [c])).rows[0];
    return { id: id(sequence++), workspace_id: w, campaign_id: c, task_id: task, task_revision: 1, campaign_revision: campaign.revision, workflow, asset_type: 'social_copy', action: 'start' };
  };
  const action = (o, name, extra = {}) => invoke({ id: o.id, workspace_id: w, action: name, expected_revision: o.revision, ...extra });
  const snapshot = async () => { await asUser(1); return (await db.query('select public.read_marketing_attention_workspace($1) data', [w])).rows[0].data; };
  await t.test('authentication, membership, workspace/task matching and actor controls deny unsafe starts', async () => {
    const req = await assignment();
    for (const human of ['invalid', 3, 4]) assert.ok((await invoke(req, human)).statusCode >= 400);
    for (const forged of [{ ...req, campaign_id: other }, { ...req, workspace_id: other }, { ...req, actor_type: 'agent' }, { ...req, run_id: id(999) }, { ...req, workflow: 'publish' }]) assert.ok((await invoke(forged)).statusCode >= 400);
    assert.equal(calls.length, 0);
    await asUser(1); await assert.rejects(db.query('select public.command_marketing_orchestration($1,$2)', [id(1), req]), /permission denied/);
  });
  await t.test('Creator to Guardian links exact revision, deduplicates attention, requires human approval/completion', async () => {
    calls = []; const req = await assignment(); const res = await invoke(req); assert.equal(res.statusCode, 200);
    const o = res.body.orchestration; assert.equal(o.state, 'awaiting_review'); assert.deepEqual(calls.map(r => r.agent), ['creator', 'guardian']);
    assert.equal(calls[1].context.asset.id, o.asset_id); assert.equal(calls[1].context.asset.revision, o.asset_revision); assert.equal(o.run_ids.length, 2);
    let data = await snapshot(); assert.equal(data.tasks.find(x => x.id === req.task_id).status, 'todo');
    const items = deriveMarketingAttention(data); assert.equal(items.filter(x => x.orchestration_id === o.id).length, 1); assert.ok(!items.some(x => o.run_ids.includes(x.run_id)));
    const repeated = await invoke(req); assert.equal(repeated.body.orchestration.id, o.id); assert.equal(calls.length, 2);
    assert.equal((await invoke({ ...req, id: id(sequence++) })).statusCode, 409);
    const submitted = (await action(o, 'submit')).body.orchestration; assert.equal(submitted.state, 'awaiting_approval');
    data = await snapshot(); const a = data.assets.find(x => x.id === o.asset_id); assert.equal(a.approval_state, 'in_review'); assert.equal(a.approved_by, null);
    assert.equal(deriveMarketingAttention(data).filter(x => x.asset_id === a.id || x.orchestration_id === o.id).length, 1);
    const distinctFailure = structuredClone(data);
    distinctFailure.orchestrations.find(x => x.id === o.id).state = 'failed';
    assert.equal(deriveMarketingAttention(distinctFailure).filter(x => x.asset_id === a.id || x.orchestration_id === o.id).length, 2);
    await assert.rejects(db.query("select public.write_marketing_asset($1,$2,$3,$4,'approve','{}')", [w, c, a.id, a.revision]), /approv/i);
    await asUser(2); await db.query("select public.write_marketing_asset($1,$2,$3,$4,'approve','{}')", [w, c, a.id, a.revision]);
    data = await snapshot(); const complete = data.orchestrations.find(x => x.id === o.id); assert.equal(complete.state, 'completed');
    assert.equal(deriveMarketingAttention(data).find(x => x.orchestration_id === o.id).severity, 'attention');
    await action(complete, 'complete_task'); data = await snapshot(); assert.equal(data.tasks.find(x => x.id === req.task_id).status, 'done'); assert.ok(!deriveMarketingAttention(data).some(x => x.orchestration_id === o.id));
    await db.exec('reset role'); await assert.rejects(db.query("update marketing.task_orchestrations set state='creator_running' where id=$1", [o.id]), /immutable/);
    await assert.rejects(db.query('delete from marketing.orchestration_history where orchestration_id=$1', [o.id]), /append-only/);
  });
  await t.test('Strategist workflows pause for human acceptance and cannot duplicate continuation', async () => {
    for (const workflow of ['strategist', 'strategist_creator_guardian']) {
      calls = []; const o = (await invoke(await assignment(workflow))).body.orchestration; assert.equal(o.state, 'awaiting_plan'); assert.equal(calls.length, 1);
      const advanced = (await action(o, 'accept')).body.orchestration; assert.equal(advanced.state, workflow === 'strategist' ? 'completed' : 'awaiting_review');
      if (workflow !== 'strategist') { assert.deepEqual(calls.map(x => x.agent), ['strategist', 'creator', 'guardian']); assert.ok(calls[1].context.accepted_plan.result.summary); }
      const count = calls.length; await action(o, 'accept'); assert.equal(calls.length, count);
      const data = await snapshot(); assert.ok(data.resolutions.some(r => r.agent_run_id === o.plan_run_id && r.actor_user_id === id(1)));
    }
  });
  await t.test('Guardian changes pause; human authorizes same-asset revisions capped at three', async () => {
    mode = 'changes'; calls = []; let o = (await invoke(await assignment())).body.orchestration; const asset = o.asset_id;
    assert.equal(o.state, 'changes_needed'); assert.equal(calls.length, 2);
    for (let cycle = 1; cycle <= 3; cycle++) {
      const res = await action(o, 'revise', { instructions: 'Address the dealer benefit.' }); assert.equal(res.statusCode, 200); o = res.body.orchestration;
      assert.equal(o.asset_id, asset); assert.equal(o.revision_cycles, cycle); assert.equal(o.asset_revision, cycle + 1);
      assert.ok(calls.at(-2).context.previous_guardian); assert.equal(calls.at(-2).context.orchestration.instructions, 'Address the dealer benefit.');
      assert.equal(o.state, cycle === 3 ? 'blocked' : 'changes_needed');
    }
    const count = calls.length; await action(o, 'revise'); assert.equal(calls.length, count);
    await asUser(1); const history = (await db.query('select * from marketing.workflow_history where asset_id=$1 order by id', [asset])).rows;
    assert.equal(history.length, 4); assert.ok(history.every(h => h.actor_type === 'agent')); assert.equal(new Set(history.map(h => h.agent_run_id)).size, 4);
    mode = 'ready';
  });
  await t.test('failed/malformed stages, stale context and revoked permissions stop without assets', async () => {
    for (const failure of ['failure', 'malformed', 'task', 'campaign', 'permission']) {
      mode = ['failure', 'malformed'].includes(failure) ? failure : 'ready'; const req = await assignment();
      if (failure === 'task') beforeModel = async () => { await asUser(1); await db.query('select public.save_marketing_task($1,$2,$3,1,$4)', [w, c, req.task_id, { title: 'Changed task', status: 'todo' }]); };
      if (failure === 'campaign') beforeModel = async () => { await db.exec('reset role'); await db.query('update marketing.campaigns set revision=revision+1 where id=$1', [c]); };
      if (failure === 'permission') beforeModel = async () => { await db.exec('reset role'); await db.query("update marketing.workspace_members set role='viewer' where workspace_id=$1 and user_id=$2", [w, id(1)]); };
      const o = (await invoke(req)).body.orchestration; assert.equal(o.state, 'failed'); assert.equal(o.asset_id, null); assert.equal(o.run_ids.length, 1);
      await db.exec('reset role'); await db.query("update marketing.workspace_members set role='contributor' where workspace_id=$1 and user_id=$2", [w, id(1)]);
    }
    mode = 'ready';
  });
  await t.test('stale produced asset blocks handoff, stop is durable and history is isolated', async () => {
    let o = (await invoke(await assignment())).body.orchestration;
    await asUser(1); await db.query("select public.write_marketing_asset($1,$2,$3,$4,'save',$5)", [w, c, o.asset_id, o.asset_revision, { name: 'Manual change', asset_type: 'social_copy', content: 'Book a demo' }]);
    o = (await action(o, 'submit')).body.orchestration; assert.equal(o.state, 'blocked');
    const plan = (await invoke(await assignment('strategist'))).body.orchestration; assert.equal((await action(plan, 'stop')).body.orchestration.state, 'cancelled');
    await asUser(4); await assert.rejects(db.query('select public.read_marketing_attention_workspace($1)', [w]), /unavailable/);
  });
  await t.test('lost stage handoff blocks without replay; Guardian failure preserves prior Creator evidence', async () => {
    calls = []; loseCompletion = true;
    const uncertain = (await invoke(await assignment())).body.orchestration;
    assert.equal(uncertain.state, 'blocked'); assert.match(uncertain.reason, /uncertain/); assert.equal(calls.length, 1);
    let data = await snapshot(); assert.ok(data.assets.some(a => a.id === uncertain.asset_id));
    assert.equal(deriveMarketingAttention(data).find(i => i.orchestration_id === uncertain.id).severity, 'critical');
    mode = 'guardian_failure'; calls = [];
    const failed = (await invoke(await assignment())).body.orchestration;
    assert.equal(failed.state, 'failed'); assert.equal(calls.length, 2);
    data = await snapshot(); assert.equal(data.assets.find(a => a.id === failed.asset_id).approval_state, 'draft');
    assert.equal(failed.run_ids.length, 2); mode = 'ready';
  });
  await t.test('cancellation during inference discards late results; fresh running stages are clear', async () => {
    const req = await assignment();
    beforeModel = async context => {
      const data = await snapshot();
      assert.ok(!deriveMarketingAttention(data).some(i => i.orchestration_id === req.id || i.run_id === context.orchestration.active_run_id));
      assert.equal(deriveMarketingAttention(data, Date.parse(context.orchestration.updated_at) + 120001).find(i => i.orchestration_id === req.id).severity, 'critical');
      const stopped = await action(context.orchestration, 'stop'); assert.equal(stopped.body.orchestration.state, 'cancelled');
    };
    const o = (await invoke(req)).body.orchestration;
    assert.equal(o.state, 'cancelled'); assert.equal(o.asset_id, null);
  });
});
