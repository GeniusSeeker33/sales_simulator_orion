import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://shwdkkiinqhacwerukch.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_tUNgUTnQef0JqhmTapIu8g_SGQQ3wlr";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
