import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../../api/marketing-agent-run.js';
import { createHandler as createOrchestrationHandler } from '../../api/marketing-orchestration.js';

const fixture = name => fileURLToPath(new URL(name, import.meta.url));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Local, synthetic test server only. Execute the real migrations and RPCs.
const db = await PGlite.create();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
for (const name of ['20260911120000_marketing_command_center.sql', '20260912111609_marketing_campaign_workflow.sql', '20260912161020_marketing_agent_run_layer.sql', '20260912172142_marketing_attention_creator_revision.sql', '20260912185640_marketing_human_resolution_actions.sql', '20260912192217_marketing_task_orchestration.sql', '20260912213640_marketing_human_constraints.sql', '20260913154417_marketing_orchestration_recovery.sql', '20260913194223_marketing_guided_policy.sql']) {
  await db.exec(await readFile(fixture(`../../supabase/migrations/${name}`), 'utf8'));
}
for (const [n, role] of [[1, 'contributor'], [2, 'approver'], [3, 'viewer']]) {
  await db.query('insert into auth.users values($1)', [id(n)]);
  await db.query("insert into marketing.workspace_members(workspace_id,user_id,role) values('4f52494f-4e00-4000-8000-000000000001',$1,$2)", [id(n), role]);
}
const signatures = {
  resolve_marketing_agent_run: ['p_workspace', 'p_run', 'p_action', 'p_selection', 'p_note'],
  save_marketing_policy: ['p_workspace', 'p_campaign', 'p_expected_set', 'p_rules'],
  save_marketing_human_constraints: ['p_workspace', 'p_asset', 'p_expected_revision', 'p_expected_set', 'p_constraints'],
  read_marketing_workspace: ['p_workspace'],
  read_marketing_attention_workspace: ['p_workspace'],
  read_marketing_agent_run: ['p_workspace', 'p_run'],
  read_marketing_agent_runs: ['p_workspace', 'p_campaign'],
  save_marketing_campaign: ['p_id', 'p_workspace', 'p_expected_revision', 'p_payload'],
  save_marketing_brief: ['p_workspace', 'p_campaign', 'p_expected_revision', 'p_payload'],
  save_marketing_task: ['p_workspace', 'p_campaign', 'p_id', 'p_expected_revision', 'p_payload'],
  write_marketing_asset: ['p_workspace', 'p_campaign', 'p_id', 'p_expected_revision', 'p_action', 'p_payload'],
  read_marketing_asset_history: ['p_workspace', 'p_asset'],
};
let pending = Promise.resolve();
const rejectedGuardianRuns = new Set();
Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://synthetic.invalid', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public', LEARNER_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server' });
const agentDependencies = {
  makeClient: (_url, key) => key === 'synthetic-public' ? { auth: { getUser: async token => ({ data: { user: /^[123]$/.test(token) ? { id: id(Number(token)) } : null } }) } } : {
    rpc: async (name, args) => {
      const keys = { command_marketing_orchestration: ['p_human', 'p_request'], finish_marketing_orchestration_stage: ['p_id', 'p_run', 'p_output', 'p_qa', 'p_usage', 'p_error'], start_marketing_agent_run: ['p_id', 'p_human', 'p_request', 'p_version', 'p_model'], finish_marketing_agent_run: ['p_id', 'p_output', 'p_qa', 'p_usage', 'p_error'] }[name];
      try {
        if (name === 'finish_marketing_orchestration_stage' && args.p_output?.recommendation && rejectedGuardianRuns.has(args.p_run)) args = { ...args, p_output: { ...args.p_output, rejected_field: true } };
        await db.exec('reset role; set role service_role');
        const result = await db.query(`select public.${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) data`, keys.map(k => args[k]));
        return { data: result.rows[0].data };
      } catch (error) { return { error }; }
    },
  },
  makeModel: () => ({ responses: { create: async options => {
    const context = JSON.parse(options.input[1].content);
    if (context.orchestration?.instructions === 'Reproduce Guardian result rejection' && context.request.agent_key === 'guardian') rejectedGuardianRuns.add(context.orchestration.active_run_id);
    if (context.request.purpose === 'Fail model') throw new Error('Synthetic model failure');
    const outputs = {
      strategist: { summary: 'Proposed demo execution plan', steps: [{ title: 'Draft copy', rationale: 'Explain the offer' }], proposed_tasks: ['Prepare demo copy'] },
      creator: { name: 'Creator browser draft', asset_type: context.request.asset_type, content: 'Book your guided demo.' },
      guardian: { summary: 'Review audience and CTA before approval.', recommendation: 'needs_changes', findings: [{ category: 'audience', severity: 'warning', requires_correction: true, finding: 'Confirm audience suitability.' }] },
    };
    if (context.request.purpose === 'Ready for approval' || context.orchestration) outputs.guardian = { summary: 'Ready for a human decision.', recommendation: 'ready_for_human_review', findings: [] };
    if (context.orchestration?.instructions === 'Exercise constraint failure' || context.prior_human_change_requests?.[0]?.notes === 'Exercise constraint failure' && context.orchestration?.revision_cycles === 1) outputs.creator.content = 'Competitive wholesale firearms. Book your guided demo.';
    outputs.guardian.constraint_evaluations = (context.human_constraints || []).map(c => ({ constraint_id: c.id, status: 'satisfied', detail: 'Model believes satisfied.' }));
    return { status: 'completed', output_text: JSON.stringify(outputs[context.request.agent_key]), usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 } };
  } } }),
};
const agentHandler = createHandler(agentDependencies);
const orchestrationHandler = createOrchestrationHandler(agentDependencies);
export default defineConfig({
  plugins: [react(), {
    name: 'synthetic-marketing-db',
    configureServer(server) {
      for (const [path, handler] of [['/api/marketing-agent-run', agentHandler], ['/api/marketing-orchestration', orchestrationHandler]]) server.middlewares.use(path, (req, res) => {
        const execute = async () => {
          let body = ''; for await (const chunk of req) body += chunk;
          req.body = JSON.parse(body);
          res.status = code => { res.statusCode = code; return res; };
          res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
          await handler(req, res);
        };
        pending = pending.then(execute, execute);
      });
      server.middlewares.use('/__marketing_rpc', (req, res) => {
        const execute = async () => {
          try {
            let body = ''; for await (const chunk of req) body += chunk;
            const { name, args } = JSON.parse(body);
            if (!Object.hasOwn(signatures, name)) throw new Error('Unknown test RPC');
            const user = Number(req.headers['x-test-user']);
            if (![1, 2, 3].includes(user)) throw new Error('Unknown synthetic user');
            await db.exec('reset role');
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(user)]);
            await db.exec('set role authenticated');
            const keys = signatures[name];
            const result = await db.query(`select public.${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) data`, keys.map(key => args[key] ?? null));
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: result.rows[0].data, error: null }));
          } catch (error) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: null, error: { message: error.message } })); }
        };
        pending = pending.then(execute, execute);
      });
    },
  }],
  resolve: { alias: [
    { find: /.*\/learnerClient(?:\.js)?$/, replacement: fixture('client.js') },
    { find: /.*\/context\/AuthContext(?:\.jsx)?$/, replacement: fixture('auth.jsx') },
  ] },
  server: { host: '127.0.0.1', port: 5181, strictPort: true },
});
