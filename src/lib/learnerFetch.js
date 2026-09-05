import { learnerClient } from "./learnerClient";
export async function learnerFetch(url, options = {}) {
  if (!learnerClient) throw new Error("Learner authentication unavailable.");
  const { data, error } = await learnerClient.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to practice.");
  // Server verifies the token with getUser; browser claims confer no authority.
  return fetch(url, { signal: AbortSignal.timeout(45000), ...options, headers: { ...options.headers, Authorization: `Bearer ${data.session.access_token}` } });
}
