import { validatePracticeScore } from "./practiceScore.js";
export async function evaluatePractice(transcript, request, technicalFailure = false) {
  if (technicalFailure) return { status: "technical_failure", score: null, feedback: "" };
  if (!transcript.some(item => item.speaker === "Sales Rep" && item.text?.trim())) {
    return { status: "abandoned", score: null, feedback: "" };
  }
  try {
    const response = await request();
    if (!response.ok) throw new Error("Provider failure");
    const data = await response.json();
    return { status: "completed", score: validatePracticeScore(data), feedback: typeof data.coachingNote === "string" ? data.coachingNote : "" };
  } catch {
    return { status: "technical_failure", score: null, feedback: "" };
  }
}
