import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const fixture = name => fileURLToPath(new URL(name, import.meta.url));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Local, synthetic test server only. Execute the real migrations and RPCs.
const db = await PGlite.create();
await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
for (const name of ['20260911120000_marketing_command_center.sql', '20260912111609_marketing_campaign_workflow.sql']) {
  await db.exec(await readFile(fixture(`../../supabase/migrations/${name}`), 'utf8'));
}
for (const [n, role] of [[1, 'contributor'], [2, 'approver'], [3, 'viewer']]) {
  await db.query('insert into auth.users values($1)', [id(n)]);
  await db.query("insert into marketing.workspace_members(workspace_id,user_id,role) values('4f52494f-4e00-4000-8000-000000000001',$1,$2)", [id(n), role]);
}
const signatures = {
  read_marketing_workspace: ['p_workspace'],
  save_marketing_campaign: ['p_id', 'p_workspace', 'p_expected_revision', 'p_payload'],
  save_marketing_brief: ['p_workspace', 'p_campaign', 'p_expected_revision', 'p_payload'],
  save_marketing_task: ['p_workspace', 'p_campaign', 'p_id', 'p_expected_revision', 'p_payload'],
  write_marketing_asset: ['p_workspace', 'p_campaign', 'p_id', 'p_expected_revision', 'p_action', 'p_payload'],
  read_marketing_asset_history: ['p_workspace', 'p_asset'],
};
let pending = Promise.resolve();
export default defineConfig({
  plugins: [react(), {
    name: 'synthetic-marketing-db',
    configureServer(server) {
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
