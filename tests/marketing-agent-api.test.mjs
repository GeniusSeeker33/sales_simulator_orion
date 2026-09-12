import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/marketing-agent-run.js';

test('real Supabase Auth and OpenAI SDK adapters use server credentials and sanitize failures', async t => {
  const originalFetch = globalThis.fetch, env = { ...process.env };
  t.after(() => { globalThis.fetch = originalFetch; process.env = env; });
  Object.assign(process.env, { LEARNER_SUPABASE_URL: 'https://marketing.example.test', LEARNER_SUPABASE_PUBLISHABLE_KEY: 'publishable', LEARNER_SUPABASE_SERVICE_ROLE_KEY: 'server-only', OPENAI_API_KEY: 'sk-server-only' });
  const body = { workspace_id: '00000000-0000-4000-8000-000000000001', campaign_id: '00000000-0000-4000-8000-000000000002', agent_key: 'strategist', purpose: 'Plan' };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  async function invoke({ auth = true, anonymous = false, upstream = 200, token = 'human-token' } = {}) {
    const requests = [], finishes = [];
    globalThis.fetch = async (url, options) => {
      const address = String(url); requests.push(address);
      if (address.endsWith('/auth/v1/user')) {
        assert.equal(new Headers(options.headers).get('Authorization'), `Bearer ${token}`);
        return auth ? json({ id: body.workspace_id, is_anonymous: anonymous }) : json({ message: 'invalid token' }, 401);
      }
      const payload = JSON.parse(options.body);
      if (address.endsWith('/rpc/start_marketing_agent_run')) {
        assert.equal(new Headers(options.headers).get('apikey'), 'server-only');
        assert.equal(payload.p_human, body.workspace_id);
        return json({ request: body, campaign: { revision: 1 } });
      }
      if (address.endsWith('/rpc/finish_marketing_agent_run')) {
        finishes.push(payload);
        return json({ id: payload.p_id, status: payload.p_error ? 'failed' : 'succeeded' });
      }
      assert.equal(address, 'https://api.openai.com/v1/responses');
      assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer sk-server-only');
      assert.equal(payload.text.format.type, 'json_schema'); assert.equal(payload.store, false);
      if (upstream !== 200) return json({ error: { message: 'SECRET provider details' } }, upstream);
      return json({ id: 'resp_test', object: 'response', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'Plan', steps: [{ title: 'Draft', rationale: 'Explain offer' }], proposed_tasks: [] }), annotations: [] }] }], usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } });
    };
    const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ method: 'POST', headers: { authorization: token ? `Bearer ${token}` : '' }, body }, res);
    assert.ok(!JSON.stringify(res.body).includes('SECRET')); assert.ok(!JSON.stringify(res.body).includes('server-only'));
    return { ...res, requests, finishes };
  }
  for (const options of [{ token: '' }, { auth: false }, { anonymous: true }]) {
    const res = await invoke(options); assert.equal(res.statusCode, 401); assert.equal(res.finishes.length, 0); assert.ok(res.requests.every(url => url.endsWith('/auth/v1/user')));
  }
  const success = await invoke(); assert.equal(success.statusCode, 200); assert.equal(success.finishes[0].p_usage.total_tokens, 30);
  for (const upstream of [401, 429, 500]) { const res = await invoke({ upstream }); assert.equal(res.statusCode, 502); assert.equal(res.finishes[0].p_error, 'model_failed'); }
});
