/**
 * RingCentral — JWT Authentication
 *
 * RingCentral supports multiple auth methods. For server-to-server (no user
 * interaction), JWT flow is preferred over password grant.
 *
 * Setup steps:
 * 1. Go to developers.ringcentral.com → Create App (Server-only, No User Interface)
 * 2. Enable scopes: ReadCallLog, Analytics, ReadAccounts
 * 3. Generate a JWT credential under App Settings → Credentials
 * 4. Add env vars to Vercel
 *
 * Required env vars:
 *   RINGCENTRAL_CLIENT_ID       — App client ID
 *   RINGCENTRAL_CLIENT_SECRET   — App client secret
 *   RINGCENTRAL_JWT_TOKEN       — JWT credential from app settings
 *   RINGCENTRAL_ACCOUNT_ID      — Usually "~" for main account
 *
 * Token endpoint:
 *   POST https://platform.ringcentral.com/restapi/oauth/token
 */

let rcTokenCache = { token: null, expiresAt: 0 };

export async function getRCToken() {
  const now = Date.now();

  if (rcTokenCache.token && now < rcTokenCache.expiresAt - 60_000) {
    return rcTokenCache.token;
  }

  const { RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT_TOKEN } = process.env;

  if (!RINGCENTRAL_CLIENT_ID || !RINGCENTRAL_CLIENT_SECRET || !RINGCENTRAL_JWT_TOKEN) {
    throw new Error("RingCentral credentials not configured. Add RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, and RINGCENTRAL_JWT_TOKEN to Vercel environment variables.");
  }

  const credentials = Buffer.from(`${RINGCENTRAL_CLIENT_ID}:${RINGCENTRAL_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://platform.ringcentral.com/restapi/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: RINGCENTRAL_JWT_TOKEN,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RingCentral token request failed: ${err}`);
  }

  const data = await res.json();
  rcTokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return rcTokenCache.token;
}

export const RC_BASE = "https://platform.ringcentral.com/restapi/v1.0";
