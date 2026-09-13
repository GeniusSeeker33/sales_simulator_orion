import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../api/marketing-orchestration.js';
import { deriveAgentWork } from '../src/lib/marketingAgentWork.js';
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
  let sequence = 30, calls = [], mode = 'ready', creatorContent = 'Book your demo.', beforeModel, loseCompletion = false;
  const rpc = async (name, args) => {
    try {
      await db.exec('reset role; set role service_role'); const keys = signatures[name];
      if (mode === 'guardian_rejected' && name === 'finish_marketing_orchestration_stage' && args.p_output?.recommendation) args = { ...args, p_output: { ...args.p_output, rejected_field: true } };
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
        : agent === 'creator' ? { name: 'Orchestrated draft', asset_type: context.request.asset_type, content: creatorContent }
        : { constraint_evaluations: (context.human_constraints || []).map(c => ({ constraint_id: c.id, status: 'satisfied', detail: 'Model believes satisfied.' })), summary: 'QA', recommendation: mode === 'changes' ? 'needs_changes' : 'ready_for_human_review', findings: mode === 'changes' ? [{ category: 'audience', severity: 'warning', requires_correction: true, finding: 'Explain dealer benefit.' }] : [] };
      return { status: 'completed', output_text: mode === 'malformed' ? '{bad' : JSON.stringify(output), usage: { input_tokens: 50, output_tokens: 25, total_tokens: 75 } };
    } } }) });
  const invoke = async (body, human = 1) => { const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(data) { this.body = data; return this; } }; await handler({ method: 'POST', headers: { authorization: `Bearer ${human}` }, body }, res); return res; };
  const assignment = async (workflow = 'creator_guardian') => {
    const task = id(sequence++); await asUser(1);
    await db.query('select public.save_marketing_task($1,$2,$3,null,$4)', [w, c, task, { title: 'Prepare dealer demo', status: 'todo' }]);
    const campaign = (await db.query('select revision from marketing.campaigns where id=$1', [c])).rows[0];
    return { id: id(sequence++), workspace_id: w, campaign_id: c, task_id: task, task_revision: 1, campaign_revision: campaign.revision, workflow, asset_type: 'social_copy', action: 'start' };
  };
  const action = async (o, name, extra = {}) => { const data = name === 'revise' ? await snapshot() : null; const context = data?.orchestration_recovery.find(x => x.orchestration_id === o.id); return invoke({ id: o.id, workspace_id: w, action: name, expected_revision: o.revision, ...(context ? { asset_revision: context.asset_revision, task_revision: context.task_revision, campaign_revision: context.campaign_revision, constraint_set_ids: context.constraint_set_ids } : {}), ...extra }); };
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
  await t.test('bounded constraint evaluator handles normalization, lexicons, testimonials and exact destinations', async () => {
    await db.exec('reset role');
    const evaluate = async (type, value, content, details) => (await db.query('select marketing.evaluate_human_constraints($1,$2) data', [content, [{ constraints: [{ id: id(900), constraint_type: type, value, ...(details ? { details } : {}) }] }]])).rows[0].data[0];
    for (const content of ['competitive wholesale firearms', 'COMPETITIVE   WHOLESALE FIREARMS', '“competitive, wholesale firearms!”']) {
      const result = await evaluate('prohibited_phrase', 'competitive wholesale firearms', content);
      assert.equal(result.passed, false); assert.equal(result.matched_text, 'competitive wholesale firearms'); assert.ok(result.normalized_offset);
    }
    for (const term of ['competitive', 'best', 'leading', 'leader', 'superior']) assert.equal((await evaluate('no_unverified_comparative_claim', '', `Our ${term} inventory`)).passed, false);
    for (const term of ['grow your business', 'success', 'increase sales', 'improve profit', 'outperform', 'win']) assert.equal((await evaluate('no_unverified_outcome_claim', '', term)).passed, false);
    for (const content of ['A satisfied dealer', 'Customer says: great service', '"They changed my business" — a dealer']) assert.equal((await evaluate('no_fabricated_testimonial', '', content)).passed, false);
    assert.equal((await evaluate('no_fabricated_testimonial', '', 'Review the dealer application.')).review_required, true);
    assert.equal((await evaluate('no_unverified_comparative_claim', '', 'A leadership workshop')).passed, true);
    assert.equal((await evaluate('required_destination', 'Join-Orion.com', 'Apply at https://www.join-orion.com/apply.')).passed, true);
    for (const content of ['Apply at join-orion.com.evil.com', 'Apply at https://join-orion.com@evil.com', 'Apply elsewhere']) assert.equal((await evaluate('required_destination', 'Join-Orion.com', content)).passed, false);
    assert.equal((await evaluate('required_phrase_or_concept', 'dealer eligibility', 'Apply today', { mode: 'phrase' })).passed, false);
    assert.equal((await evaluate('required_phrase_or_concept', 'dealer eligibility', 'Apply today', { mode: 'concept' })).review_required, true);
  });
  await t.test('human requested constraints block Creator preflight before Guardian and clean revisions clear it', async () => {
    mode = 'ready'; creatorContent = 'Book your demo.';
    let o = (await invoke(await assignment())).body.orchestration;
    o = (await action(o, 'submit')).body.orchestration;
    await asUser(2);
    const rules = [{ constraint_type: 'prohibited_phrase', value: 'competitive wholesale firearms' }, { constraint_type: 'no_unverified_comparative_claim' }];
    await db.query("select public.write_marketing_asset($1,$2,$3,$4,'request_changes',$5)", [w, c, o.asset_id, o.asset_revision, { notes: 'Remove unsupported competitive language.', human_constraints: rules, constraint_set_id: null }]);
    let data = await snapshot(); o = data.orchestrations.find(x => x.id === o.id);
    const constraintSet = data.human_constraint_sets.find(s => s.asset_id === o.asset_id && !s.superseded);
    assert.equal(constraintSet.created_by, id(2)); assert.ok(constraintSet.source_decision_id); assert.equal(constraintSet.orchestration_id, o.id);
    creatorContent = 'Our competitive wholesale firearms. Book your demo.'; calls = [];
    o = (await action(o, 'revise')).body.orchestration;
    assert.equal(o.state, 'changes_needed'); assert.equal(o.reason, 'Human constraint failed'); assert.equal(calls.length, 1); assert.equal(calls[0].agent, 'creator');
    assert.equal(calls[0].context.human_constraints.length, 2); assert.equal(o.constraint_preflight.filter(q => !q.passed).length, 2);
    data = await snapshot(); assert.equal(data.assets.find(a => a.id === o.asset_id).content, creatorContent);
    assert.equal(deriveMarketingAttention(data).find(i => i.orchestration_id === o.id).severity, 'critical');
    const run = (await db.query('select public.read_marketing_agent_run($1,$2) data', [w, o.active_run_id])).rows[0].data;
    assert.equal(run.status, 'succeeded'); assert.ok(run.output_metadata.deterministic_qa.some(q => q.constraint_id && !q.passed));
    await assert.rejects(db.query("select public.write_marketing_asset($1,$2,$3,$4,'submit','{}')", [w, c, o.asset_id, o.asset_revision]), /Human constraint failed/);
    // A contradictory standalone Guardian response cannot override database preflight.
    await db.exec('reset role; set role service_role'); const gid = id(sequence++);
    const ctx = (await db.query("select public.start_marketing_agent_run($1,$2,$3,'marketing-v2','gpt-4.1-mini') data", [gid, id(1), { workspace_id: w, campaign_id: c, agent_key: 'guardian', purpose: 'Review constrained draft', asset_id: o.asset_id }])).rows[0].data;
    const qa = { summary: 'No unsupported claims', recommendation: 'ready_for_human_review', findings: [], constraint_evaluations: ctx.human_constraints.map(r => ({ constraint_id: r.id, status: 'satisfied', detail: 'Model claims clean' })) };
    const reviewed = (await db.query("select public.finish_marketing_agent_run($1,$2,'[]','{}',null) data", [gid, qa])).rows[0].data;
    assert.equal(reviewed.output_metadata.result.recommendation, 'needs_changes'); assert.ok(reviewed.output_metadata.result.constraint_evaluations.every(e => e.status === 'violated'));
    creatorContent = 'Book your dealer demo.'; calls = []; o = (await action(o, 'revise')).body.orchestration;
    assert.equal(o.state, 'awaiting_review'); assert.equal(o.revision_cycles, 2); assert.deepEqual(calls.map(x => x.agent), ['creator', 'guardian']);
    assert.ok(calls[1].context.creator_preflight.every(q => q.passed)); assert.ok(o.constraint_preflight.every(q => q.passed));
    assert.equal(calls[1].context.prior_human_change_requests[0].notes, 'Remove unsupported competitive language.');
    data = await snapshot(); assert.ok(!deriveMarketingAttention(data).some(i => i.run_id === gid));
    await asUser(1); const clean = (await db.query('select public.read_marketing_agent_run($1,$2) data', [w, o.active_run_id])).rows[0].data;
    assert.equal(clean.output_metadata.result.recommendation, 'ready_for_human_review'); assert.ok(clean.output_metadata.result.findings.every(f => !f.requires_correction));
    // Supersession is append-only, attributable, scoped, and optimistic.
    await asUser(3); await assert.rejects(db.query('select public.save_marketing_human_constraints($1,$2,$3,$4,$5)', [w, o.asset_id, o.asset_revision, constraintSet.id, []]), /unavailable/);
    await asUser(4); await assert.rejects(db.query('select public.save_marketing_human_constraints($1,$2,$3,$4,$5)', [w, o.asset_id, o.asset_revision, constraintSet.id, []]), /unavailable/);
    await db.exec('reset role; set role service_role'); await assert.rejects(db.query('select public.save_marketing_human_constraints($1,$2,$3,$4,$5)', [w, o.asset_id, o.asset_revision, constraintSet.id, []]), /permission denied/);
    await asUser(1); await assert.rejects(db.query('select public.save_marketing_human_constraints($1,$2,$3,null,$4)', [w, o.asset_id, o.asset_revision, []]), /Constraints changed/);
    await db.query('select public.save_marketing_human_constraints($1,$2,$3,$4,$5)', [w, o.asset_id, o.asset_revision, constraintSet.id, []]);
    data = await snapshot(); assert.equal(data.human_constraint_sets.find(s => s.id === constraintSet.id).superseded, true);
    await db.exec('reset role'); await assert.rejects(db.query("update marketing.human_constraint_sets set constraints='[]' where id=$1", [constraintSet.id]), /append-only/);
    await assert.rejects(db.query('delete from marketing.human_constraint_sets where id=$1', [constraintSet.id]), /append-only/);
  });
  await t.test('constraint supersession during inference rejects stale work and never leaks to another task', async () => {
    mode = 'changes'; creatorContent = 'Book your demo.';
    let o = (await invoke(await assignment())).body.orchestration;
    await asUser(1);
    const set = (await db.query('select public.save_marketing_human_constraints($1,$2,$3,null,$4) data', [w, o.asset_id, o.asset_revision, [{ constraint_type: 'prohibited_phrase', value: 'unsupported phrase' }]])).rows[0].data;
    beforeModel = async context => {
      assert.equal(context.human_constraints.length, 1);
      await asUser(1);
      await db.query('select public.save_marketing_human_constraints($1,$2,$3,$4,$5)', [w, o.asset_id, o.asset_revision, set.id, []]);
    };
    o = (await action(o, 'revise')).body.orchestration;
    assert.equal(o.state, 'failed'); assert.equal(o.asset_revision, 1);
    mode = 'ready'; calls = [];
    const unrelated = (await invoke(await assignment())).body.orchestration;
    assert.equal(unrelated.state, 'awaiting_review'); assert.ok(calls.every(c => c.context.human_constraints.length === 0));
    await asUser(1);
    await assert.rejects(db.query('select public.save_marketing_human_constraints($1,$2,$3,null,$4)', [w, unrelated.asset_id, unrelated.asset_revision, [{ constraint_type: 'prohibited_phrase', value: 'word', created_by: id(4) }]]), /Invalid constraint/);
    await db.exec('reset role; set role service_role');
    await assert.rejects(db.query("select marketing.finish_marketing_agent_run_before_constraints($1,null,'[]','{}',null)", [unrelated.active_run_id]), /permission denied/);
    await asUser(4); const foreign = (await db.query('select public.read_marketing_attention_workspace($1) data', [other])).rows[0].data;
    assert.equal(foreign.human_constraint_sets.length, 0);
  });
  const requestChanges = async (o, rules = [{ constraint_type: 'prohibited_phrase', value: 'competitive wholesale firearms' }]) => {
    await asUser(1);
    const a = (await snapshot()).assets.find(a => a.id === o.asset_id);
    if (a.approval_state !== 'in_review') await db.query("select public.write_marketing_asset($1,$2,$3,$4,'submit','{}')", [w, c, a.id, a.revision]);
    const current = (await snapshot()).assets.find(item => item.id === o.asset_id);
    await asUser(2);
    await db.query("select public.write_marketing_asset($1,$2,$3,$4,'request_changes',$5)", [w, c, a.id, current.revision, { notes: 'Use factual dealer wording. Remove competitive claims.', human_constraints: rules, constraint_set_id: null }]);
    return snapshot();
  };
  const revisionCommand = (o, data) => {
    const ctx = data.orchestration_recovery.find(x => x.orchestration_id === o.id);
    return { id: o.id, workspace_id: w, action: 'revise', expected_revision: o.revision, asset_revision: ctx.asset_revision, task_revision: ctx.task_revision, campaign_revision: ctx.campaign_revision, constraint_set_ids: ctx.constraint_set_ids, instructions: 'Follow the human requested changes.' };
  };
  const failedGuardian = async (workflow = 'creator_guardian') => {
    mode = 'guardian_rejected'; creatorContent = 'Book your demo.';
    let o = (await invoke(await assignment(workflow))).body.orchestration;
    if (o.state === 'awaiting_plan') o = (await action(o, 'accept')).body.orchestration;
    assert.equal(o.state, 'failed'); assert.equal(o.reason, 'result_rejected');
    mode = 'ready'; return o;
  };
  await t.test('hosted failure: human-requested revision recovers the same workflow and exact asset through approval', async () => {
    const original = await failedGuardian('strategist_creator_guardian'), oldRun = original.active_run_id;
    let data = await requestChanges(original);
    assert.equal(data.orchestrations.find(x => x.id === original.id).state, 'failed'); // human edits never auto-recover
    const request = revisionCommand(original, data), oldAssetRevision = request.asset_revision;
    assert.equal(data.orchestration_recovery.find(x => x.orchestration_id === original.id).eligible, true);
    const project = data => deriveAgentWork({ ...data, attention: deriveMarketingAttention(data) }).all.filter(x => x.orchestration?.id === original.id || x.asset?.id === original.asset_id);
    assert.equal(project(data).length, 1); assert.equal(project(data)[0].state, 'Recoverable Guardian failure');
    await db.exec('reset role; set role service_role');
    await assert.rejects(db.query("select public.start_marketing_agent_run($1,$2,$3,'marketing-v2','gpt-4.1-mini')", [id(sequence++), id(1), { workspace_id: w, campaign_id: c, agent_key: 'creator', purpose: 'Bypass team', revision_asset_id: original.asset_id, expected_asset_revision: oldAssetRevision, expected_campaign_revision: original.campaign_revision, supplemental_instructions: '', submit_for_review: true }]), /task workflow/);
    calls = [];
    beforeModel = async context => {
      assert.equal(context.request.agent_key, 'creator'); assert.equal(context.orchestration.id, original.id);
      // Duplicate click and refresh after initiation never own another inference call.
      const duplicate = await invoke(request); assert.equal(duplicate.body.orchestration.state, 'creator_running');
      const current = (await snapshot()).orchestrations.find(x => x.id === original.id);
      assert.equal(current.revision_cycles, 1); assert.equal((await action(current, 'inspect')).body.orchestration.state, 'creator_running');
      const late = await rpc('finish_marketing_orchestration_stage', { p_id: original.id, p_run: oldRun, p_output: null, p_qa: [], p_usage: {}, p_error: 'persistence_failed' });
      assert.equal(late.data.orchestration.state, 'creator_running'); assert.equal(late.data.orchestration.active_run_id, context.orchestration.active_run_id);
    };
    let recovered = (await invoke(request)).body.orchestration;
    assert.equal(recovered.state, 'awaiting_review'); assert.equal(recovered.id, original.id); assert.equal(recovered.task_id, original.task_id);
    assert.equal(recovered.initiated_by, original.initiated_by); assert.equal(recovered.workflow, original.workflow);
    assert.equal(recovered.asset_id, original.asset_id); assert.equal(recovered.asset_revision, oldAssetRevision + 1); assert.equal(recovered.revision_cycles, 1);
    assert.deepEqual(recovered.run_ids.slice(0, original.run_ids.length), original.run_ids);
    assert.deepEqual(calls.map(x => x.agent), ['creator', 'guardian']);
    assert.equal(calls[0].context.human_change_request.notes, 'Use factual dealer wording. Remove competitive claims.');
    assert.equal(calls[0].context.human_constraints.length, 1); assert.equal(calls[1].context.asset.revision, oldAssetRevision + 1);
    assert.equal(calls[1].context.orchestration.id, original.id); assert.ok(calls[1].context.creator_preflight.every(q => q.passed));
    await invoke(request); assert.equal(calls.length, 2);
    data = await snapshot(); assert.equal(project(data).length, 1);
    assert.equal(project(data)[0].pipeline.find(s => s.label === 'Guardian').status, 'done');
    assert.equal(data.orchestrations.filter(x => x.task_id === original.task_id).length, 1);
    recovered = (await action(recovered, 'submit')).body.orchestration;
    data = await snapshot(); assert.equal(project(data).length, 1); assert.equal(project(data)[0].action, 'Approve / Request Changes');
    await asUser(2); await db.query("select public.write_marketing_asset($1,$2,$3,$4,'approve','{}')", [w, c, recovered.asset_id, recovered.asset_revision]);
    data = await snapshot(); recovered = data.orchestrations.find(x => x.id === original.id);
    assert.equal(recovered.state, 'completed'); assert.equal(data.tasks.find(x => x.id === original.task_id).status, 'todo');
    await action(recovered, 'complete_task'); data = await snapshot(); assert.equal(project(data)[0].group, 'recentlyCompleted');
    await db.exec('reset role');
    const authorizations = (await db.query('select * from marketing.orchestration_revision_authorizations where orchestration_id=$1', [original.id])).rows;
    assert.equal(authorizations.length, 1); assert.equal(authorizations[0].actor_user_id, id(1)); assert.ok(authorizations[0].human_decision_id);
    assert.equal((await db.query('select status,error_code from marketing.agent_runs where id=$1', [oldRun])).rows[0].error_code, 'result_rejected');
    assert.ok((await db.query("select 1 from marketing.orchestration_history where orchestration_id=$1 and snapshot->>'state'='failed'", [original.id])).rows.length);
    await assert.rejects(db.query('delete from marketing.orchestration_revision_authorizations where orchestration_id=$1', [original.id]), /append-only/);
    await assert.rejects(db.query("update marketing.orchestration_history set snapshot='{}' where orchestration_id=$1", [original.id]), /append-only/);
  });
  await t.test('recovered preflight failure persists Creator and stops before Guardian; a further explicit cycle succeeds', async () => {
    const original = await failedGuardian(); const data = await requestChanges(original); calls = []; creatorContent = 'Competitive wholesale firearms. Book your demo.';
    let o = (await invoke(revisionCommand(original, data))).body.orchestration;
    assert.equal(o.id, original.id); assert.equal(o.state, 'changes_needed'); assert.equal(o.revision_cycles, 1); assert.equal(o.reason, 'Human constraint failed');
    assert.deepEqual(calls.map(x => x.agent), ['creator']); assert.ok(o.constraint_preflight.some(q => !q.passed));
    creatorContent = 'Book your dealer demo.'; calls = [];
    o = (await action(o, 'revise')).body.orchestration;
    assert.equal(o.id, original.id); assert.equal(o.revision_cycles, 2); assert.equal(o.state, 'awaiting_review'); assert.deepEqual(calls.map(x => x.agent), ['creator', 'guardian']);
  });
  await t.test('recovery denies stale versions, revoked roles, foreign workspace and a second active workflow', async () => {
    const original = await failedGuardian(); let data = await requestChanges(original); const request = revisionCommand(original, data); calls = [];
    for (const change of [{ asset_revision: request.asset_revision - 1 }, { task_revision: request.task_revision + 1 }, { campaign_revision: request.campaign_revision + 1 }, { constraint_set_ids: [] }]) assert.equal((await invoke({ ...request, ...change })).statusCode, 409);
    for (const human of ['invalid', 3, 4]) assert.ok((await invoke(request, human)).statusCode >= 400);
    assert.equal((await invoke({ ...request, workspace_id: other })).statusCode, 403);
    await asUser(1); await db.query('select public.save_marketing_human_constraints($1,$2,$3,$4,$5)', [w, original.asset_id, request.asset_revision, request.constraint_set_ids[0], []]);
    assert.equal((await invoke(request)).statusCode, 409); assert.equal(calls.length, 0);
    data = await snapshot(); const fresh = revisionCommand(original, data);
    await db.exec('reset role'); await db.query("update marketing.workspace_members set role='viewer' where workspace_id=$1 and user_id=$2", [w, id(1)]);
    assert.equal((await invoke(fresh)).statusCode, 403);
    await db.exec('reset role'); await db.query("update marketing.workspace_members set role='contributor' where workspace_id=$1 and user_id=$2", [w, id(1)]);
    const next = await invoke({ id: id(sequence++), workspace_id: w, action: 'start', campaign_id: c, task_id: original.task_id, task_revision: 1, campaign_revision: original.campaign_revision, workflow: 'creator_guardian', asset_type: 'social_copy' });
    assert.equal(next.statusCode, 200); const count = calls.length;
    assert.equal((await invoke(fresh)).statusCode, 409); assert.equal(calls.length, count);
    await asUser(4); const foreign = (await db.query('select public.read_marketing_attention_workspace($1) data', [other])).rows[0].data; assert.deepEqual(foreign.orchestration_recovery, []);
    await asUser(1); await assert.rejects(db.query('select marketing.orchestration_revision_context($1,$2)', [original.id, id(1)]), /permission denied/);
    await assert.rejects(db.query('select * from marketing.orchestration_revision_authorizations'), /permission denied/);
  });
  await t.test('cancelled, changed task and exhausted workflows cannot be revived', async () => {
    const cancelled = (await action((await invoke(await assignment())).body.orchestration, 'stop')).body.orchestration;
    let data = await requestChanges(cancelled); calls = [];
    assert.equal((await invoke(revisionCommand(cancelled, data))).statusCode, 409); assert.equal(calls.length, 0);
    const failed = await failedGuardian(); data = await requestChanges(failed);
    await asUser(1); await db.query('select public.save_marketing_task($1,$2,$3,1,$4)', [w, c, failed.task_id, { title: 'Changed task scope', status: 'todo' }]);
    calls = []; assert.equal((await invoke(revisionCommand(failed, data))).statusCode, 409); assert.equal(calls.length, 0);
    mode = 'changes'; let o = (await invoke(await assignment())).body.orchestration;
    for (let i = 0; i < 3; i++) o = (await action(o, 'revise')).body.orchestration;
    const count = calls.length; assert.equal(o.revision_cycles, 3); assert.equal((await action(o, 'revise')).statusCode, 409); assert.equal(calls.length, count); mode = 'ready';
  });

  await t.test('legacy detached successful revision can be explicitly adopted; an old standalone in-flight revision cannot apply', async () => {
    const original = await failedGuardian(); let data = await requestChanges(original);
    const a = data.assets.find(x => x.id === original.asset_id), legacyId = id(sequence++);
    const legacyRequest = { workspace_id: w, campaign_id: c, agent_key: 'creator', purpose: 'Legacy standalone revision', revision_asset_id: a.id, expected_asset_revision: a.revision, expected_campaign_revision: original.campaign_revision, supplemental_instructions: '', submit_for_review: true };
    // Execute the retained pre-migration implementation as the fixture owner to reproduce already-hosted history.
    await db.exec('reset role');
    await db.query("select marketing.start_marketing_agent_run_before_recovery($1,$2,$3,'marketing-v2','gpt-4.1-mini')", [legacyId, id(1), legacyRequest]);
    await db.query("select marketing.finish_marketing_agent_run_before_recovery($1,$2,'[]','{}',null)", [legacyId, { name: 'Legacy revised asset', asset_type: 'social_copy', content: 'Book your factual dealer demo.' }]);
    data = await snapshot(); const detached = data.assets.find(x => x.id === a.id);
    assert.equal(detached.revision, a.revision + 2); assert.equal(detached.approval_state, 'in_review');
    const projected = deriveAgentWork({ ...data, attention: deriveMarketingAttention(data) }).needsYou.filter(x => x.asset?.id === a.id);
    assert.equal(projected.length, 1); assert.equal(projected[0].orchestration.id, original.id);
    await asUser(2); const guidedData = (await db.query('select public.read_marketing_attention_workspace($1) data', [w])).rows[0].data;
    const guided = guidedData.guided_work.find(x => x.orchestration_id === original.id); assert.ok(guided.actions.includes('request_changes'));
    const recovered = (await invoke({ workspace_id:w,id:original.id,action:'review',expected_revision:original.revision,asset_revision:guided.asset_revision,task_revision:guided.task_revision,campaign_revision:guided.campaign_revision,constraint_set_ids:guided.constraint_set_ids,decision:'request_changes',notes:'Continue this revision in the original task workflow.' },2)).body.orchestration;
    assert.equal(recovered.id, original.id); assert.equal(recovered.asset_revision, detached.revision + 2); assert.equal(recovered.state, 'awaiting_review');
    const next = await failedGuardian(); data = await requestChanges(next); const pending = id(sequence++), current = data.assets.find(x => x.id === next.asset_id);
    await db.exec('reset role');
    await db.query("select marketing.start_marketing_agent_run_before_recovery($1,$2,$3,'marketing-v2','gpt-4.1-mini')", [pending, id(1), { ...legacyRequest, revision_asset_id: current.id, expected_asset_revision: current.revision }]);
    const denied = (await db.query("select public.finish_marketing_agent_run($1,$2,'[]','{}',null) data", [pending, { name: 'Late legacy revision', asset_type: 'social_copy', content: 'Book your demo.' }])).rows[0].data;
    assert.equal(denied.status, 'failed'); assert.equal(denied.error_code, 'result_rejected');
    data = await snapshot(); assert.equal(data.assets.find(x => x.id === current.id).revision, current.revision);
  });

  await t.test('corrupt stage lineage and private recovery helpers fail closed', async () => {
    mode = 'changes';
    const first = (await invoke(await assignment())).body.orchestration, second = (await invoke(await assignment())).body.orchestration;
    await db.exec('reset role');
    await db.query('update marketing.task_orchestrations set active_run_id=$2 where id=$1', [first.id, second.active_run_id]);
    const data = await snapshot(), ctx = data.orchestration_recovery.find(x => x.orchestration_id === first.id);
    assert.equal(ctx.eligible, false); assert.match(ctx.reason, /lineage/);
    const count = calls.length; assert.equal((await action(data.orchestrations.find(x => x.id === first.id), 'revise')).statusCode, 409); assert.equal(calls.length, count);
    await db.exec('reset role');
    for (const role of ['anon','authenticated','service_role']) {
      for (const fn of ['marketing.orchestration_revision_context(uuid,uuid)', 'marketing.command_marketing_orchestration_before_recovery(uuid,jsonb)', 'marketing.start_marketing_agent_run_before_recovery(uuid,uuid,jsonb,text,text)', 'marketing.finish_marketing_agent_run_before_recovery(uuid,jsonb,jsonb,jsonb,text)', 'marketing.finish_marketing_orchestration_stage_before_recovery(uuid,uuid,jsonb,jsonb,jsonb,text)']) {
        assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed", [role, fn])).rows[0].allowed, false);
      }
    }
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='marketing.orchestration_revision_authorizations'::regclass")).rows[0].relrowsecurity, true);
    mode = 'ready';
  });

  await t.test('inherited policies, atomic guided review, approval, attribution and immutable evidence', async () => {
    mode = 'ready'; creatorContent = 'Book your demo.';
    await asUser(2);
    const workspacePolicy = (await db.query('select public.save_marketing_policy($1,null,null,$2) data', [w, [{constraint_type:'prohibited_phrase',value:'guaranteed riches'},{constraint_type:'human_instruction',value:'Do not invent financial terms.'}]])).rows[0].data;
    const campaignPolicy = (await db.query('select public.save_marketing_policy($1,$2,null,$3) data', [w,c,[{constraint_type:'approved_destination',value:'Join-Orion.com'}]])).rows[0].data;
    for (const human of [1,3,4]) { await asUser(human); await assert.rejects(db.query('select public.save_marketing_policy($1,null,$2,$3)', [w,workspacePolicy.id,[]]), /permission/i); }
    calls=[]; let o = (await invoke(await assignment('strategist_creator_guardian'))).body.orchestration;
    assert.equal(calls[0].context.human_constraints.length,3);
    assert.deepEqual(new Set(calls[0].context.human_constraint_sets.map(s=>s.source_scope)),new Set(['Workspace','Campaign']));
    o=(await action(o,'accept')).body.orchestration;
    assert.equal(o.state,'awaiting_review'); assert.equal(calls.length,3);
    assert.ok(calls.every(call=>call.context.human_constraints.length===3));
    const readAs = async human => { await asUser(human);return (await db.query('select public.read_marketing_attention_workspace($1) data',[w])).rows[0].data; };
    let data=await readAs(2),ctx=data.guided_work.find(x=>x.orchestration_id===o.id);
    assert.ok(ctx.actions.includes('approve'));
    const request=(decision,context=ctx,orch=o)=>({workspace_id:w,id:orch.id,action:'review',expected_revision:orch.revision,asset_revision:context.asset_revision,task_revision:context.task_revision,campaign_revision:context.campaign_revision,constraint_set_ids:context.constraint_set_ids,decision,notes:'Clarify the dealer benefit.',review_constraints:[{constraint_type:'prohibited_phrase',value:'best ever'}]});
    assert.equal((await invoke(request('request_changes'),1)).statusCode,403);
    assert.equal((await invoke(request('request_changes'),4)).statusCode,403);
    assert.equal((await invoke({...request('request_changes'),asset_revision:999},2)).statusCode,409);
    const before=(await readAs(2)).human_constraint_sets.length;
    assert.equal((await invoke({...request('request_changes'),review_constraints:[{constraint_type:'approve'}]},2)).statusCode,409);
    assert.equal((await readAs(2)).human_constraint_sets.length,before);
    const feedback=request('request_changes');let res=await invoke(feedback,2);assert.equal(res.statusCode,200);o=res.body.orchestration;assert.equal(o.state,'awaiting_review');assert.equal(o.revision_cycles,1);
    const creator=calls.at(-2).context;
    assert.equal(creator.human_constraints.length,4);assert.equal(creator.prior_human_change_requests[0].notes,'Clarify the dealer benefit.');assert.ok(creator.previous_guardian);assert.equal(creator.asset.id,o.asset_id);
    const count=calls.length;await invoke(feedback,2);assert.equal(calls.length,count);
    data=await readAs(2);ctx=data.guided_work.find(x=>x.orchestration_id===o.id);
    const setCount=data.human_constraint_sets.length;
    res=await invoke(request('request_changes'),2);assert.equal(res.statusCode,200);o=res.body.orchestration;data=await readAs(2);assert.equal(data.human_constraint_sets.length,setCount,'unchanged asset rules do not create duplicate versions');
    ctx=data.guided_work.find(x=>x.orchestration_id===o.id);
    const approval=request('approve');res=await invoke(approval,2);assert.equal(res.statusCode,200);o=res.body.orchestration;assert.equal(o.state,'completed');
    data=await readAs(2);const a=data.assets.find(x=>x.id===o.asset_id);assert.equal(a.approval_state,'approved');assert.equal(a.approved_by,id(2));assert.equal(data.tasks.find(x=>x.id===o.task_id).status,'todo');
    await invoke(approval,2);assert.equal(calls.length,count+2);
    await db.exec('reset role');const history=(await db.query('select * from marketing.workflow_history where asset_id=$1 order by id',[a.id])).rows;
    assert.equal(history.filter(h=>h.action==='approved').length,1);assert.equal(history.filter(h=>h.action==='changes_requested').length,2);assert.equal(history.filter(h=>h.action==='asset_saved').length,3);
    assert.ok(history.filter(h=>h.action==='asset_saved').every(h=>h.actor_type==='agent'&&h.agent_run_id));
    await assert.rejects(db.query('delete from marketing.policy_versions where id=$1',[workspacePolicy.id]),/append-only/);
    await assert.rejects(db.query("update marketing.policy_versions set constraints='[]' where id=$1",[campaignPolicy.id]),/append-only/);
    for(const role of ['anon','authenticated','service_role']) for(const fn of ['marketing.guided_work_context(uuid,uuid)','marketing.effective_constraint_sets(uuid,uuid,uuid,uuid)','marketing.command_marketing_orchestration_before_guided(uuid,jsonb)']) assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed",[role,fn])).rows[0].allowed,false);
    await asUser(4);const outside=(await db.query('select public.read_marketing_attention_workspace($1) data',[other])).rows[0].data;assert.deepEqual(outside.policy_versions,[]);assert.deepEqual(outside.guided_work,[]);
    await asUser(2);await db.query('select public.save_marketing_policy($1,null,$2,$3)',[w,workspacePolicy.id,[]]);await db.query('select public.save_marketing_policy($1,$2,$3,$4)',[w,c,campaignPolicy.id,[]]);
  });
  await t.test('policy preflight, supersession during inference and legacy guided recovery fail safely', async () => {
    mode='ready';creatorContent='Book your demo.';
    await asUser(2);let data=(await db.query('select public.read_marketing_attention_workspace($1) data',[w])).rows[0].data;
    const current=data.policy_versions.find(s=>!s.superseded&&!s.campaign_id);
    const p=(await db.query('select public.save_marketing_policy($1,null,$2,$3) data',[w,current.id,[{constraint_type:'approved_destination',value:'Join-Orion.com'}]])).rows[0].data;
    creatorContent='Book your demo at fake.example/deal';let o=(await invoke(await assignment())).body.orchestration;assert.equal(o.state,'changes_needed');assert.equal(o.run_ids.length,1);assert.equal(o.constraint_preflight[0].passed,false);
    creatorContent='Book your demo at Join-Orion.com';o=(await action(o,'revise')).body.orchestration;assert.equal(o.state,'awaiting_review');
    beforeModel=async()=>{await asUser(2);await db.query('select public.save_marketing_policy($1,null,$2,$3)',[w,p.id,[{constraint_type:'human_instruction',value:'Use verified details only.'}]]);};
    const stale=(await invoke(await assignment())).body.orchestration;assert.equal(stale.state,'failed');assert.equal(stale.asset_id,null);
    mode='guardian_rejected';o=(await invoke(await assignment())).body.orchestration;assert.equal(o.state,'failed');mode='ready';
    await asUser(2);data=(await db.query('select public.read_marketing_attention_workspace($1) data',[w])).rows[0].data;
    const ctx=data.guided_work.find(x=>x.orchestration_id===o.id);assert.ok(ctx.actions.includes('request_changes'));
    const res=await invoke({workspace_id:w,id:o.id,action:'review',expected_revision:o.revision,asset_revision:ctx.asset_revision,task_revision:ctx.task_revision,campaign_revision:ctx.campaign_revision,constraint_set_ids:ctx.constraint_set_ids,decision:'request_changes',notes:'Keep the destination, clarify the benefit.'},2);
    assert.equal(res.statusCode,200);assert.equal(res.body.orchestration.id,o.id);assert.equal(res.body.orchestration.state,'awaiting_review');
  });

});
