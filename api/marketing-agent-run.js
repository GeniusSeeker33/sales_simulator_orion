/* global process */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { INSTRUCTION_VERSION, MODEL, validateRequest } from './_lib/marketing-agents.js';
import { inferMarketing } from './_lib/marketing-inference.js';

export const config = { maxDuration: 60 };

// Injectable boundaries allow real handler + PostgreSQL tests with only inference mocked.
export function createHandler({ makeClient = createClient, makeModel = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 }) } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const url = process.env.LEARNER_SUPABASE_URL, key = process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !process.env.LEARNER_SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Marketing agents are not configured' });
    let human;
    try {
      const client = makeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user || data.user.is_anonymous) return res.status(401).json({ error: 'Verified human session required' });
      human = data.user.id;
    } catch { return res.status(503).json({ error: 'Authentication unavailable' }); }
    let request;
    try { request = validateRequest(req.body); } catch { return res.status(400).json({ error: 'Invalid agent request' }); }
    const server = makeClient(url, process.env.LEARNER_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const rpc = async (name, args) => {
      const { data, error } = await server.rpc(name, args);
      if (error) throw error;
      return data;
    };
    const runId = randomUUID();
    let context;
    try {
      context = await rpc('start_marketing_agent_run', { p_id: runId, p_human: human, p_request: request, p_version: INSTRUCTION_VERSION, p_model: MODEL });
    } catch (error) {
      if (error.code === '40001') return res.status(409).json({ error: 'Campaign or asset changed. Refresh before starting a revision.' });
      return res.status(error.code === '42501' ? 403 : 503).json({ error: error.code === '42501' ? 'Marketing agent access denied' : 'Agent run could not be started' });
    }
    let usage = {}, phase = 'model_failed';
    try {
      const { output, qa } = await inferMarketing({ model: makeModel(), request, context, onUsage: value => { usage = value; }, onPhase: value => { phase = value; } });
      phase = 'persistence_failed';
      const run = await rpc('finish_marketing_agent_run', { p_id: runId, p_output: output, p_qa: qa, p_usage: usage, p_error: null });
      return res.status(run.status === 'succeeded' ? 200 : 409).json({ run });
    } catch {
      try {
        const run = await rpc('finish_marketing_agent_run', { p_id: runId, p_output: null, p_qa: [], p_usage: usage, p_error: phase });
        // Completion is idempotent: an ambiguous RPC response cannot undo a committed result.
        return res.status(run.status === 'succeeded' ? 200 : 502).json({ run, ...(run.status === 'failed' ? { error: 'Agent run failed. No agent results were applied.' } : {}) });
      } catch {
        return res.status(503).json({ run_id: runId, error: 'Run outcome unavailable. Check Agents before retrying.' });
      }
    }
  };
}

export default createHandler();
