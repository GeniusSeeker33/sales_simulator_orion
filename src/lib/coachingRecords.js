export async function coachingCall(client, name, args) {
  if (!client) throw new Error("Coaching storage unavailable.");
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error("Request not confirmed. Access may have changed, evidence may be outdated, or a newer coaching version may exist. Refresh before retrying.");
  return data;
}
export async function readCoaching(client, scope = null, cursor = null) {
  const data = await coachingCall(client, "read_coaching_sessions", {
    p_scope: scope, p_before: cursor?.created_at ?? null, p_before_id: cursor?.id ?? null,
  });
  if (!data || !Array.isArray(data.records)) throw new Error("Coaching history unavailable.");
  return { ...data, records: data.records.slice(0, 50), hasMore: data.records.length > 50 };
}
export const progressStatuses = ["practiced", "follow_up_pending", "improving", "demonstrated", "reassess"];
