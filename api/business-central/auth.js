/**
 * Microsoft Business Central — OAuth 2.0 Token Manager
 *
 * Auth method: OAuth 2.0 Client Credentials via Microsoft Entra ID (Azure AD)
 *
 * Setup steps:
 * 1. In Azure portal, register a new App Registration under your tenant
 * 2. Grant it "Dynamics 365 Business Central > API.ReadWrite.All" permission
 * 3. Create a Client Secret and copy the value
 * 4. In Business Central, add the Azure app to Users with appropriate role
 * 5. Add all five env vars to Vercel → Settings → Environment Variables
 *
 * Required env vars:
 *   BC_TENANT_ID        — Azure AD tenant ID (GUID)
 *   BC_CLIENT_ID        — Azure app registration client ID
 *   BC_CLIENT_SECRET    — Azure app client secret value
 *   BC_ENVIRONMENT      — BC environment name (e.g., "production")
 *   BC_COMPANY_ID       — BC company GUID (from BC → About page)
 *
 * Token endpoint:
 *   https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
 */

let tokenCache = { token: null, expiresAt: 0 };

export async function getBCToken() {
  const now = Date.now();

  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const { BC_TENANT_ID, BC_CLIENT_ID, BC_CLIENT_SECRET } = process.env;

  if (!BC_TENANT_ID || !BC_CLIENT_ID || !BC_CLIENT_SECRET) {
    throw new Error("Business Central credentials not configured. Add BC_TENANT_ID, BC_CLIENT_ID, and BC_CLIENT_SECRET to Vercel environment variables.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${BC_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: BC_CLIENT_ID,
    client_secret: BC_CLIENT_SECRET,
    scope: "https://api.businesscentral.dynamics.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`BC token request failed: ${err}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.token;
}

export function getBCBaseUrl() {
  const { BC_TENANT_ID, BC_ENVIRONMENT, BC_COMPANY_ID } = process.env;
  return `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/${BC_ENVIRONMENT}/api/v2.0/companies(${BC_COMPANY_ID})`;
}
