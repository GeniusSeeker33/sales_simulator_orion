import { createClient } from "@supabase/supabase-js";

// Separate Orion development project: never reuse the live FFL directory client.
// This client needs a real authorized Orion development session. No service key in browser.
const url = import.meta.env.VITE_ORION_DEV_SUPABASE_URL;
const key = import.meta.env.VITE_ORION_DEV_SUPABASE_PUBLISHABLE_KEY;
const client = url && key ? createClient(url, key) : null;

export async function loadCjfPortfolio() {
  if (!client) return { rows: [], error: "Development portfolio connection not configured." };
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData?.user) {
    return { rows: [], error: "Authorized Orion development sign-in required. Chase's real account is not used." };
  }
  // RPC must verify auth.uid() and an approved manager/admin profile server-side.
  // Never expose the underlying staging table to the browser.
  const { data, error } = await client.rpc("orion_read_cjf_portfolio");
  return { rows: data || [], error: error?.message || null };
}
