import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://shwdkkiinqhacwerukch.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNod2Rra2lpbnFoYWN3ZXJ1a2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MjcyNTgsImV4cCI6MjA5MjEwMzI1OH0.YxMWak3gVtzaOO82pL_USYmsKsavwnUXVTHkHsEHV7A";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
