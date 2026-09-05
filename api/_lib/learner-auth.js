import { createClient } from "@supabase/supabase-js";

// Request-scoped publishable client. RLS still applies; never use a service-role key here.
export async function requireLearner(req, res) {
  const url = process.env.LEARNER_SUPABASE_URL;
  const key = process.env.LEARNER_SUPABASE_PUBLISHABLE_KEY;
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  if (!url || !key) { res.status(503).json({ error: "Learner authentication unavailable" }); return false; }
  if (!token) { res.status(401).json({ error: "Authentication required" }); return false; }
  try {
    const client = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) { res.status(401).json({ error: "Invalid session" }); return false; }
    const { data, error: bindingError } = await client.from("learner_bindings")
      .select("id").eq("auth_user_id", user.id).is("revoked_at", null).single();
    if (bindingError || !data) { res.status(403).json({ error: "Verified learner enrollment required" }); return false; }
    return true;
  } catch {
    res.status(503).json({ error: "Learner authentication unavailable" }); return false;
  }
}
