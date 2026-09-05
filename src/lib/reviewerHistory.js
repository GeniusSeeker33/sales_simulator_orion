export async function fetchReviewerHistory(client, scopeId = null, cursor = null) {
  if (!client) throw new Error("Reviewer history unavailable.");
  const { data, error } = await client.rpc("read_reviewer_history", {
    p_scope_id: scopeId, p_before: cursor?.started_at ?? null, p_before_id: cursor?.id ?? null,
  });
  if (error || !data || !Array.isArray(data.scopes) || !Array.isArray(data.records)) {
    throw new Error("Reviewer history unavailable or access no longer authorized.");
  }
  return { scopes: data.scopes, records: data.records.slice(0, 50), hasMore: data.records.length > 50 };
}
export function reviewAssessmentLabel(record) {
  if (record.status === "technical_failure") return "Technical failure — unscored";
  if (record.status !== "completed" || record.assessment_status !== "ai_unreviewed" || typeof record.ai_overall !== "number") return "Unscored";
  return `AI practice: ${record.ai_overall}/100 — unreviewed, supporting evidence only`;
}
