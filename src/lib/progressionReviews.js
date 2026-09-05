export const progressionVersion = "orion-sales/0.1-draft";
export function progressionOutcomes(level) {
  if (!/^L[1-5]$/.test(level || "")) return [];
  const n = Number(level[1]);
  return [`remain_${level}`, ...(n < 5 ? [`advance_${level}_to_L${n + 1}`] : []), "defer_insufficient_evidence"];
}
export function parseProgressionRefs(text) {
  return text.trim() ? text.trim().split(/\n/).map(line => {
    const [id, revision, extra] = line.trim().split(/\s+/);
    if (extra || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !/^[1-9][0-9]*$/.test(revision || "")) throw new Error("Enter one UUID and positive revision per line.");
    return { id, revision: Number(revision) };
  }) : [];
}
// Fresh forms and corrections both require a new explicit human choice.
export const initialProgressionOutcome = "";
