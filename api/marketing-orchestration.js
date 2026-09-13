/* global process */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { inferMarketing } from './_lib/marketing-inference.js';

export const config = { maxDuration: 120 };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
// Only these fixed database messages may cross the public error boundary.
const retryMessages = new Set([
  "You need workspace write permission to retry Guardian.",
  "This work has no completed technical Guardian failure to retry.",
  "The review cannot be linked safely to this work. Inspect the technical history.",
  "The task changed. Refresh and review its scope before continuing.",
  "The campaign changed. Refresh and review its brief before continuing.",
  "The asset changed. Refresh and review the current content before continuing.",
  "Marketing Policy changed. Refresh and review the current rules before continuing.",
  "Current content has a Marketing Policy issue. Review it before continuing.",
  "A stage is still active or uncertain. Inspect it before retrying.",
  "Another workflow owns this work. Inspect it before continuing.",
  "Review context changed. Refresh before retrying."
]);
export function validCommand(body) {
  const keys = ['workspace_id', 'id', 'action', 'campaign_id', 'task_id', 'task_revision', 'campaign_revision', 'workflow', 'asset_type', 'expected_revision', 'instructions', 'asset_revision', 'constraint_set_ids', 'decision', 'notes', 'review_constraints'];
  return body && !Array.isArray(body) && Object.keys(body).every(k => keys.includes(k)) && uuid(body.workspace_id) && uuid(body.id)
    && ['start', 'accept', 'revise', 'submit', 'inspect', 'stop', 'complete_task', 'review', 'retry_guardian'].includes(body.action)
    && (body.instructions === undefined || typeof body.instructions === 'string' && body.instructions.length <= 4000)
    && (!['revise', 'review', 'retry_guardian'].includes(body.action) || Number.isSafeInteger(body.asset_revision) && Number.isSafeInteger(body.task_revision) && Number.isSafeInteger(body.campaign_revision) && Array.isArray(body.constraint_set_ids) && body.constraint_set_ids.length <= 30 && body.constraint_set_ids.every(uuid))
    && (body.action !== 'review' || ['approve', 'request_changes'].includes(body.decision) && typeof body.notes === 'string' && body.notes.length <= 4000 && (body.review_constraints === undefined || Array.isArray(body.review_constraints) && body.review_constraints.length <= 30))
    && (body.action === 'start' ? uuid(body.campaign_id) && uuid(body.task_id) && Number.isSafeInteger(body.task_revision) && Number.isSafeInteger(body.campaign_revision)
      && ['strategist', 'creator_guardian', 'strategist_creator_guardian'].includes(body.workflow)
      && ['social_copy', 'email_copy', 'web_copy', 'print_copy', 'image_brief', 'video_brief'].includes(body.asset_type)
      : Number.isSafeInteger(body.expected_revision));
}
export function createHandler({ makeClient = createClient, makeModel = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 }) } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const url = process.env.LEARNER_SUPABASE_URL, key = process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY, secret = process.env.LEARNER_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !secret) return res.status(503).json({ error: 'Marketing agents are not configured' });
    let human;
    try {
      const { data, error } = await makeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
      if (error || !data?.user || data.user.is_anonymous) return res.status(401).json({ error: 'Verified human session required' });
      human = data.user.id;
    } catch { return res.status(503).json({ error: 'Authentication unavailable' }); }
    if (!validCommand(req.body)) return res.status(400).json({ error: 'Invalid orchestration command' });
    const server = makeClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const rpc = async (name, args) => { const { data, error } = await server.rpc(name, args); if (error) throw error; return data; };
    let next;
    try { next = await rpc('command_marketing_orchestration', { p_human: human, p_request: req.body }); }
    catch (error) { return res.status(error.code === '42501' ? 403 : 409).json({ error: req.body.action === 'retry_guardian' && retryMessages.has(error.message) ? error.message : 'Assignment or action unavailable. Refresh and inspect task context before retrying.' }); }
    // At most Creator + Guardian; Strategist always stops at its human gate.
    for (let stage = 0; next.run && stage < 2; stage++) {
      const { id, context } = next.run;
      let usage = {}, phase = 'model_failed';
      const args = { p_id: next.orchestration.id, p_run: id };
      try {
        const { output, qa } = await inferMarketing({ model: makeModel(), request: context.request, context, onUsage: v => { usage = v; }, onPhase: v => { phase = v; } });
        phase = 'persistence_failed';
        next = await rpc('finish_marketing_orchestration_stage', { ...args, p_output: output, p_qa: qa, p_usage: usage, p_error: null });
      } catch {
        try { next = await rpc('finish_marketing_orchestration_stage', { ...args, p_output: null, p_qa: [], p_usage: usage, p_error: phase }); }
        catch { return res.status(503).json({ error: 'Stage outcome uncertain. Inspect the task execution before restarting.', orchestration_id: args.p_id }); }
      }
    }
    return res.status(200).json({ orchestration: next.orchestration });
  };
}
export default createHandler();
