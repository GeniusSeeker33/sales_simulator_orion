import { learnerClient } from "./learnerClient";
async function rpc(name, args) {
  if (!learnerClient) throw new Error("Learner storage is not configured.");
  const { data, error } = await learnerClient.rpc(name, args);
  if (error) throw new Error("Record not confirmed saved. Check your connection and verified learner enrollment, then retry.");
  return data;
}
export function beginAttempt(id, kind, scenario, difficulty = null) {
  return rpc("begin_learner_attempt", { p_id: id, p_kind: kind, p_scenario: scenario, p_difficulty: difficulty });
}
export function finishAttempt(id, status, score = null) {
  return rpc("finish_learner_attempt", { p_id: id, p_status: status, p_ai_score: score });
}
export async function loadLearnerHistory() {
  if (!learnerClient) throw new Error("Learner storage unavailable.");
  const { data, error } = await learnerClient.from("learner_training_attempts")
    .select("id,kind,scenario_ref,status,started_at,ended_at,ai_score,person_id,employment_episode_id")
    .order("started_at", { ascending: false }).limit(50);
  if (error) throw new Error("History unavailable. No records have been inferred from this browser.");
  return data;
}
