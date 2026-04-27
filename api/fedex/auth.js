/**
 * FedEx REST API — OAuth 2.0 Token Manager
 *
 * FedEx uses OAuth 2.0 Client Credentials (no user login required).
 *
 * Setup steps:
 * 1. Go to developer.fedex.com → Create Account → Create App
 * 2. Note your API Key (client_id) and Secret Key (client_secret)
 * 3. Enable APIs: Track API, Ship API, Rate API, Notifications API
 * 4. Add env vars to Vercel
 *
 * Required env vars:
 *   FEDEX_API_KEY           — Your FedEx app's API Key
 *   FEDEX_SECRET_KEY        — Your FedEx app's Secret Key
 *   FEDEX_ACCOUNT_NUMBER    — Your FedEx shipping account number
 *
 * Production vs Sandbox:
 *   Sandbox: https://apis-sandbox.fedex.com
 *   Production: https://apis.fedex.com
 *   Set FEDEX_ENV=sandbox or FEDEX_ENV=production
 */

let fedexTokenCache = { token: null, expiresAt: 0 };

export async function getFedExToken() {
  const now = Date.now();

  if (fedexTokenCache.token && now < fedexTokenCache.expiresAt - 60_000) {
    return fedexTokenCache.token;
  }

  const { FEDEX_API_KEY, FEDEX_SECRET_KEY } = process.env;

  if (!FEDEX_API_KEY || !FEDEX_SECRET_KEY) {
    throw new Error("FedEx credentials not configured. Add FEDEX_API_KEY and FEDEX_SECRET_KEY to Vercel environment variables.");
  }

  const base = process.env.FEDEX_ENV === "production"
    ? "https://apis.fedex.com"
    : "https://apis-sandbox.fedex.com";

  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: FEDEX_API_KEY,
      client_secret: FEDEX_SECRET_KEY,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FedEx token request failed: ${err}`);
  }

  const data = await res.json();
  fedexTokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return fedexTokenCache.token;
}

export function getFedExBase() {
  return process.env.FEDEX_ENV === "production"
    ? "https://apis.fedex.com"
    : "https://apis-sandbox.fedex.com";
}
