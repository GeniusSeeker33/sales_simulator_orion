# Realtime voice session: configuration and verification

## Supported flow and diagnosis

The checked-out implementation already used `POST https://api.openai.com/v1/realtime/client_secrets`; the older audit's endpoint concern is not a confirmed cause of the hosted failure. Before this fix, OpenAI errors became HTTP 500, while `requireLearner` could return HTTP 503 before contacting OpenAI. A reported 503 alone therefore does not prove an OpenAI endpoint problem. The hosted deployment and its response body have not been inspected.

The route keeps the documented GA request: `expires_after: {anchor: "created_at", seconds: 600}` and `session: {type: "realtime", model: "gpt-realtime", instructions, output_modalities: ["audio"], audio: {input: {transcription: {model: "whisper-1"}}, output: {voice}}}`. The model, customer voices and scenario instructions remain unchanged. The browser posts its SDP to `/v1/realtime/calls` using the returned ephemeral key; the redundant model query parameter is removed because configuration belongs to the minted session.

Verified against official OpenAI documentation before editing:

- [Create client secret](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create): server endpoint, request fields and GA `value` / `expires_at` response.
- [Realtime with WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc): ephemeral-key flow and browser SDP exchange at `/v1/realtime/calls`.

The response is now restricted to `{clientSecret, expiresAt}` after validating a non-expired ephemeral credential. Responses use `Cache-Control: no-store`. No full upstream session, upstream error body, authorization header or server key is returned or logged. Requests time out after 10 seconds. Existing authenticated learner authorization runs before health checks and credential creation.

| Response | Meaning / operator action |
| --- | --- |
| 401 / 403 | Existing learner authentication/enrollment denial; use a verified individually enrolled learner. |
| 503, `Learner authentication unavailable` | Existing guard: check server learner configuration and Auth availability. This occurs before OpenAI. |
| 503, `realtime_not_configured` | Server OpenAI key is absent/blank. Check environment assignment without exposing its value. |
| 502, `realtime_upstream_error` | OpenAI rejected the request or transport failed. Server logs contain only upstream status or a safe failure code. Verify provider access/billing/model permissions privately. |
| 502, `realtime_invalid_response` | Provider returned invalid JSON or a missing/expired/malformed credential; never forward it. |
| 504, `realtime_upstream_timeout` | Provider did not complete within the route timeout. |

The UI displays a concise fallback to text simulation and invokes the existing failed/unscored durable-session path. It does not display raw provider errors. Text simulation and learner attribution logic are unchanged.

## Vercel requirements (manual; no secrets changed)

The repository already expects **server-only** `OPENAI_API_KEY` for voice. Also required by the existing authorization guard: `LEARNER_SUPABASE_URL` and `LEARNER_SUPABASE_PUBLISHABLE_KEY`, matching the staging frontend's `VITE_LEARNER_SUPABASE_URL` and `VITE_LEARNER_SUPABASE_PUBLISHABLE_KEY`. Never create a `VITE_OPENAI_API_KEY` or put a service-role key in browser configuration.

An administrator must verify these variables are assigned to the actual staging deployment's Vercel environment/branch and that the deployed revision includes this fix. Do not paste values into logs, issues or screenshots. A static Vite preview does not run Vercel API functions. `vercel.json` preserves `/api/` routes but does not provision environment values.

Remote variable presence is **UNVERIFIED**: this checkout has no `.vercel/project.json`, and the read-only CLI account check could not initialize its local configuration due to filesystem permissions. No key values were retrieved or modified, and no deployment was performed. Missing learner configuration must be resolved before this route can reach OpenAI; the code change alone cannot repair that configuration.

## Verification

Local automated commands:

```sh
npm run test:realtime
npm run test:learner
npm run build
```

The route tests use the real learner guard with mocked Auth, enrollment and OpenAI network responses. They cover authenticated GET, missing/invalid/unbound authentication, missing learner configuration, missing server key, exact GA request/minimal response, upstream 401/429/500, transport timeout/failure, and malformed/expired credentials. They assert safe responses/logs. They do not contact hosted services.

Manual staging checks (NOT executed here):

1. With an enrolled individual account, call authenticated GET `/api/realtime-session`; expect 200 and `hasApiKey: true`. An unauthenticated POST must be denied. Do not disable authorization to make GET public.
2. Start live voice over HTTPS, permit microphone access, verify successful credential minting and SDP exchange, then speak and stop. Do not export a network capture containing ephemeral credentials.
3. Refresh learner self-history: the simulation attempt/session retains the same verified learner binding and episode.
4. Block the voice endpoint in browser developer tools and start another voice attempt. Verify fallback text, released microphone, and the existing durable technical-failure/unscored state (no zero competence). Confirm text simulation remains usable.
5. In an isolated staging configuration only, an administrator may verify the missing-key path. Never remove a production key for a test. Check distinct safe error codes without retaining credential values.

Hosted voice connectivity, microphone behavior and deployed environment correctness remain manual acceptance gates. No migrations, RLS changes or new provisioning are required by this patch.

Local results: `test:realtime` 19/19 passed; `test:learner` 69/69 passed; build passed with the existing large-bundle warning. Repository lint reports 39 errors and 1 warning. Comparing the edited code files to the base revision gives identical findings (two existing server `process` no-undef findings; none in the voice panel); this patch does not broaden into repository lint cleanup.
