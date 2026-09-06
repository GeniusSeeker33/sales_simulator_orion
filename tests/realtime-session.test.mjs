import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/realtime-session.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const future = () => Math.floor(Date.now() / 1000) + 60;

test('Realtime credential route with real learner guard and mocked network', async t => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const names = ['OPENAI_API_KEY', 'LEARNER_SUPABASE_URL', 'LEARNER_SUPABASE_PUBLISHABLE_KEY'];
  const originalEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    for (const name of names) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  });
  async function invoke({ method = 'POST', token = 'verified-test-token', key = 'sk-test-server-only', auth = true, binding = true, configured = true, upstream = () => json({ value: 'ek_short_lived_test', expires_at: future(), session: { private: 'omit' } }) } = {}) {
    process.env.OPENAI_API_KEY = key;
    process.env.LEARNER_SUPABASE_URL = configured ? 'https://learner.example.test' : '';
    process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
    const requests = [], logs = [];
    console.warn = (...args) => logs.push(args);
    globalThis.fetch = async (url, options) => {
      const address = String(url);
      if (address.includes('/auth/v1/user')) return auth ? json({ id: '11111111-1111-4111-8111-111111111111' }) : json({ message: 'invalid token' }, 401);
      if (address.includes('/rest/v1/learner_bindings')) return binding ? json({ id: '22222222-2222-4222-8222-222222222222' }) : json({ message: 'no binding' }, 406);
      assert.equal(address, 'https://api.openai.com/v1/realtime/client_secrets');
      requests.push({ url: address, ...options });
      return upstream();
    };
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await handler({ method, headers: { authorization: token ? `Bearer ${token}` : '' }, body: { customerType: 'friendly-repeat-buyer', scenario: { context: 'test' } } }, res);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.ok(!JSON.stringify([res.body, logs]).includes('sk-test-server-only'));
    return { ...res, requests, logs };
  }
  await t.test('authenticated GET health works without contacting OpenAI', async () => {
    const res = await invoke({ method: 'GET', key: '' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.hasApiKey, false);
    assert.equal(res.requests.length, 0);
  });
  for (const [label, options, status] of [
    ['missing auth', { token: '' }, 401], ['invalid auth', { auth: false }, 401],
    ['unverified learner', { binding: false }, 403], ['missing learner server configuration', { configured: false }, 503],
  ]) await t.test(label, async () => {
    const res = await invoke(options);
    assert.equal(res.statusCode, status);
    assert.equal(res.requests.length, 0);
  });
  await t.test('missing server key is a safe distinct 503', async () => {
    const res = await invoke({ key: '  ' });
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'realtime_not_configured');
    assert.equal(res.requests.length, 0);
  });
  await t.test('GA request and minimal short-lived credential response', async () => {
    const expires = future();
    const res = await invoke({ upstream: () => json({ value: 'ek_short_lived_test', expires_at: expires, session: { instructions: 'not returned' } }) });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { clientSecret: 'ek_short_lived_test', expiresAt: expires });
    const request = res.requests[0], body = JSON.parse(request.body);
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer sk-test-server-only');
    assert.ok(request.signal instanceof AbortSignal);
    assert.deepEqual(body.expires_after, { anchor: 'created_at', seconds: 600 });
    assert.equal(body.session.type, 'realtime');
    assert.equal(body.session.model, 'gpt-realtime');
    assert.deepEqual(body.session.output_modalities, ['audio']);
    assert.equal(body.session.audio.output.voice, 'coral');
    assert.deepEqual(body.session.audio.input.turn_detection, { type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true });
    assert.equal(body.session.audio.input.transcription.model, 'whisper-1');
  });
  for (const status of [401, 429, 500]) await t.test(`upstream ${status} is sanitized`, async () => {
    const res = await invoke({ upstream: () => json({ error: 'SECRET upstream details' }, status) });
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.code, 'realtime_upstream_error');
    assert.ok(!JSON.stringify([res.body, res.logs]).includes('SECRET'));
  });
  for (const data of [{}, { client_secret: { value: 'ek_old_shape' } }, { value: 'sk-test-server-only', expires_at: future() }, { value: 'ek_test', expires_at: 1 }, { value: 'ek_test', expires_at: '9999999999' }]) await t.test('malformed or expired credential rejected', async () => {
    const res = await invoke({ upstream: () => json(data) });
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.code, 'realtime_invalid_response');
  });
  await t.test('invalid JSON rejected', async () => {
    const res = await invoke({ upstream: () => new Response('not json') });
    assert.equal(res.body.code, 'realtime_invalid_response');
  });
  for (const [name, status] of [['TimeoutError', 504], ['TypeError', 502]]) await t.test(`safe ${name}`, async () => {
    const res = await invoke({ upstream: () => { const error = new Error('SECRET transport detail'); error.name = name; throw error; } });
    assert.equal(res.statusCode, status);
    assert.ok(!JSON.stringify([res.body, res.logs]).includes('SECRET'));
  });
});
