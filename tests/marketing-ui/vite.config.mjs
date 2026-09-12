import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../../api/marketing-agent-run.js';

const fixture = name => fileURLToPath(new URL(name, import.meta.url));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Local, synthetic test server only. Execute the real migrations and RPCs.
const db = await PGlite.create();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
for (const name of ['20260911120000_marketing_command_center.sql', '20260912111609_marketing_campaign_workflow.sql', '20260912161020_marketing_agent_run_layer.sql', '20260912172142_marketing_attention_creator_revision.sql']) {
  await db.exec(await readFile(fixture(`../../supabase/migrations/${name}`), 'utf8'));
}
for (const [n, role] of [[1, 'contributor'], [2, 'approver'], [3, 'viewer']]) {
  await db.query('insert into auth.users values($1)', [id(n)]);
  await db.query("insert into marketing.workspace_members(workspace_id,user_id,role) values('4f52494f-4e00-4000-8000-000000000001',$1,$2)", [id(n), role]);
}
const signatures = {
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
Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://synthetic.invalid', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public', LEARNER_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server' });
const agentHandler = createHandler({
  makeClient: (_url, key) => key === 'synthetic-public' ? { auth: { getUser: async token => ({ data: { user: /^[123]$/.test(token) ? { id: id(Number(token)) } : null } }) } } : {
    rpc: async (name, args) => {
      const keys = { start_marketing_agent_run: ['p_id', 'p_human', 'p_request', 'p_version', 'p_model'], finish_marketing_agent_run: ['p_id', 'p_output', 'p_qa', 'p_usage', 'p_error'] }[name];
      try {
        await db.exec('reset role; set role service_role');
        const result = await db.query(`select public.${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) data`, keys.map(k => args[k]));
        return { data: result.rows[0].data };
      } catch (error) { return { error }; }
    },
  },
  makeModel: () => ({ responses: { create: async options => {
    const context = JSON.parse(options.input[1].content);
    if (context.request.purpose === 'Fail model') throw new Error('Synthetic model failure');
    const outputs = {
      strategist: { summary: 'Proposed demo execution plan', steps: [{ title: 'Draft copy', rationale: 'Explain the offer' }], proposed_tasks: ['Prepare demo copy'] },
      creator: { name: 'Creator browser draft', asset_type: context.request.asset_type, content: 'Book your guided demo.' },
      guardian: { summary: 'Review audience and CTA before approval.', recommendation: 'needs_changes', findings: [{ category: 'audience', severity: 'warning', requires_correction: true, finding: 'Confirm audience suitability.' }] },
    };
    return { status: 'completed', output_text: JSON.stringify(outputs[context.request.agent_key]), usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 } };
  } } }),
});
export default defineConfig({
  plugins: [react(), {
    name: 'synthetic-marketing-db',
    configureServer(server) {
      server.middlewares.use('/api/marketing-agent-run', (req, res) => {
        const execute = async () => {
          let body = ''; for await (const chunk of req) body += chunk;
          req.body = JSON.parse(body);
          res.status = code => { res.statusCode = code; return res; };
          res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
          await agentHandler(req, res);
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
