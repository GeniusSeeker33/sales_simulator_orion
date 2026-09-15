/* global process */
import { createClient } from '@supabase/supabase-js';
import { withTalentDatabase } from './_lib/talent-db.js';
import { parseTalentQuery, readTalent } from './_lib/talent-read.js';
import { TalentFailure, logTalentDiagnostic } from './_lib/talent-diagnostics.js';

export function createHandler({ makeClient = createClient, withDatabase = withTalentDatabase, now = Date.now,
  log = event => console.error(JSON.stringify(event)) } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const url = process.env.LEARNER_SUPABASE_URL, key = process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      logTalentDiagnostic(log, new TalentFailure('auth_not_configured', 'auth_configuration'));
      return res.status(503).json({ error: 'Talent authentication is not configured.' });
    }
    let user;
    try {
      const result = await makeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
      user = result.data?.user;
      // Supabase often returns transport/server errors rather than throwing them.
      if (result.error && (result.error.status >= 500 || result.error.status === 0 || result.error.name === 'AuthRetryableFetchError')) {
        throw new TalentFailure('auth_verification_failed', 'auth_verification');
      }
      if (result.error || !user || user.is_anonymous) return res.status(401).json({ error: 'Verified human session required' });
    } catch {
      logTalentDiagnostic(log, new TalentFailure('auth_verification_failed', 'auth_verification'));
      return res.status(503).json({ error: 'Authentication unavailable.' });
    }
    const options = parseTalentQuery(req.query);
    if (!options) return res.status(400).json({ error: 'Invalid candidate query.' });
    try {
      const result = await withDatabase(user.id, query => readTalent(query, user.id, options, now()));
      if (result.diagnostic) logTalentDiagnostic(log, new TalentFailure(result.diagnostic, 'workspace_lookup'));
      return res.status(result.status).json(result.body);
    } catch (error) {
      logTalentDiagnostic(log, error);
      // Never serialize database messages, credentials or source payloads.
      return res.status(503).json({ error: 'Talent workspace unavailable. Please retry or contact your workspace administrator.' });
    }
  };
}
export default createHandler();
