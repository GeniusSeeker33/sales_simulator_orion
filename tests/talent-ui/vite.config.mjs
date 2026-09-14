import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { talentFixture, id, now } from '../fixtures/talent.mjs';
import { createHandler } from '../../api/talent.js';
const fixture = await talentFixture();
Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://synthetic.invalid', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public' });
const handler = createHandler({ now: () => now, withDatabase: fixture.withDatabase,
  makeClient: () => ({ auth: { getUser: async token => ({ data: { user: ['1', '2', '3'].includes(token) ? { id: id(Number(token)) } : null } }) } }) });
let pending = Promise.resolve();
export default defineConfig({
  plugins: [react(), { name: 'local-talent-fixture', configureServer(server) {
    server.middlewares.use('/api/talent', (req, res) => {
      const execute = async () => {
        req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        res.status = code => { res.statusCode = code; return res; };
        res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res; };
        await handler(req, res);
      };
      pending = pending.then(execute, execute);
    });
  } }],
  resolve: { alias: [
    { find: /.*\/learnerFetch(?:\.js)?$/, replacement: fileURLToPath(new URL('fetch.js', import.meta.url)) },
    { find: /.*\/context\/AuthContext(?:\.jsx)?$/, replacement: fileURLToPath(new URL('auth.jsx', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
});
