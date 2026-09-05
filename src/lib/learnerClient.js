import { createClient } from "@supabase/supabase-js";
// Separate from the newsletter integration. No fallback project or shared login.
const url = import.meta.env.VITE_LEARNER_SUPABASE_URL;
const key = import.meta.env.VITE_LEARNER_SUPABASE_PUBLISHABLE_KEY;
export const learnerClient = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "orion-verified-learner-auth" },
}) : null;
