import { createClient } from "@supabase/supabase-js";

// Isolated development-only Supabase client; never use the production FFL client.
const url = import.meta.env.VITE_ORION_DEV_SUPABASE_URL;
const key = import.meta.env.VITE_ORION_DEV_SUPABASE_PUBLISHABLE_KEY;
export const orionDevClient = url && key ? createClient(url, key, {
  auth: { persistSession: true, storageKey: "orion-dev-portfolio-auth", autoRefreshToken: true },
}) : null;

export async function signInOrionDev(email, password) {
  if (!orionDevClient) return { error: "Development connection not configured." };
  if (email.trim().toLowerCase() !== "desiree@orionwholesaleonline.com") {
    return { error: "Only the designated development administrator may use this preview." };
  }
  const { error } = await orionDevClient.auth.signInWithPassword({ email: email.trim(), password });
  return { error: error?.message || null };
}

export async function signOutOrionDev() {
  await orionDevClient?.auth.signOut({ scope: "local" });
}

export async function loadCjfPortfolio() {
  if (!orionDevClient) return { rows: [], error: "Development portfolio connection not configured." };
  const { data: authData, error: authError } = await orionDevClient.auth.getUser();
  if (authError || !authData?.user) return { rows: [], error: "Sign in to the separate Orion development account." };
  const { data, error } = await orionDevClient.rpc("orion_read_cjf_portfolio");
  return { rows: data || [], error: error?.message || null };
}
