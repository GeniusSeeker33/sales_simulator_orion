import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { talentFixture, id, now } from '../fixtures/talent.mjs';
import { createHandler } from '../../api/talent.js';
import { TalentFailure } from '../../api/_lib/talent-diagnostics.js';
const fixture = await talentFixture();
Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://synthetic.invalid', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public' });
const handler = createHandler({ now: () => now, withDatabase: (user, read) => {
  if (user === id(4)) throw new TalentFailure('crm_connection_failed', 'transaction_begin', { code: 'SELF_SIGNED_CERT_IN_CHAIN' });
  return fixture.withDatabase(user, read);
}, makeClient: () => ({ auth: { getUser: async token => ({ data: { user: token === 'database-error' ? { id: id(4) } : ['1', '2', '3'].includes(token) ? { id: id(Number(token)) } : null } }) } }) });
let pending = Promise.resolve();
export default defineConfig({
  plugins: [react(), { name: 'local-talent-fixture', configureServer(server) {
    server.middlewares.use('/api/talent-intake', (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const item = { source_application_id: '00000000-0000-4000-9001-000000000016', state: 'ready_for_review',
        reason: 'Governed reconciliation found no blocking condition.', ready_for_import: true,
        application_date: '2026-09-16T12:00:00Z', candidate_name: 'Future Applicant', position_title: 'Sales Guide',
        source_status: 'new', application_source: 'join-orion.com', recruiter: 'Recruiter A', resume_metadata_exists: true,
        duplicate_evidence: null, proposed_crm_mapping: { application_status: 'submitted' },
        provenance: { source_system: 'join-orion', source_entity: 'candidate_applications', source_id: '00000000-0000-4000-9001-000000000016' } };
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      if (url.searchParams.get('workspace_id') === id(30)) res.end(JSON.stringify({ actionable_count: 0, items: [], diagnostics: { invalid_count: 0, source_mapping_attention_count: 0 }, refreshed_at: '2026-09-16T13:00:00Z', exclusion_manifest: { fingerprint: 'fixture-fingerprint' } }));
      else res.end(JSON.stringify({ actionable_count: 1, items: [item], diagnostics: { invalid_count: 0, source_mapping_attention_count: 0 }, refreshed_at: '2026-09-16T13:00:00Z', exclusion_manifest: { fingerprint: 'fixture-fingerprint' } }));
    });
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
