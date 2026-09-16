/* global process */
import { createClient } from '@supabase/supabase-js';
import { withTalentDatabase } from './_lib/talent-db.js';
import { createHostedJoinOrionSource } from './_lib/join-orion-db.js';
import { readIntakeReview } from './_lib/intake-review.js';
import { isUuid } from './_lib/talent-read.js';
import { TalentFailure, logTalentDiagnostic } from './_lib/talent-diagnostics.js';

export function createHandler({ makeClient = createClient, withDatabase = withTalentDatabase,
  source = createHostedJoinOrionSource(), log = event => console.error(JSON.stringify(event)) } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    if (!isUuid(req.query?.workspace_id) || Object.keys(req.query || {}).some(key => key !== 'workspace_id')) return res.status(400).json({ error: 'A valid workspace is required.' });
    const url = process.env.LEARNER_SUPABASE_URL, key = process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return res.status(503).json({ error: 'Talent authentication is not configured.' });
    let user;
    try {
      const result = await makeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
      user = result.data?.user;
      if (result.error || !user || user.is_anonymous) return res.status(401).json({ error: 'Verified human session required' });
    } catch {
      logTalentDiagnostic(log, new TalentFailure('auth_verification_failed', 'auth_verification'));
      return res.status(503).json({ error: 'Authentication unavailable.' });
    }
    try {
      const result = await withDatabase(user.id, query => readIntakeReview(query, user.id, req.query.workspace_id, source));
      return res.status(result.status).json(result.body);
    } catch (error) {
      logTalentDiagnostic(log, error);
      const category = error?.category;
      if (category === 'join_orion_not_configured') return res.status(503).json({ error: 'Candidate intake source is not configured.' });
      if (category === 'join_orion_source_unavailable') return res.status(503).json({ error: 'Candidate intake source is unavailable. Please retry.' });
      if (/exclusion|manifest/i.test(error?.message || '')) return res.status(503).json({ error: 'Candidate intake exclusion configuration is invalid.' });
      return res.status(503).json({ error: 'Candidate intake CRM service is unavailable. Please retry.' });
    }
  };
}
export default createHandler();
