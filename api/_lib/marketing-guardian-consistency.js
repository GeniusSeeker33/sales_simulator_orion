// Versioned, conservative validation of public assessment evidence, never hidden reasoning.
export const GUARDIAN_CONSISTENCY_VERSION = 'guardian-consistency-v1';
export const GUARDIAN_INCONSISTENCY = 'guardian_semantic_structured_mismatch';

function assessment(text) {
  const explicit = /^Assessment:\s*(satisfied|violated|semantic_review)\s*[.!]/i.exec(text.trim());
  if (explicit) return explicit[1].toLowerCase();
  // Only unqualified, complete assertions in an ID-bound assessment are recognized.
  // Do not guess at negation, quotations, exceptions, or borderline semantic evidence.
  if (/\b(may|might|potential|borderline|but|however|except|uncertain|if)\b|["“”]/i.test(text)) return null;
  if (/^(?:This|The) (?:constraint|rule) is satisfied[.!]?$/i.test(text.trim())
    || /^No (?:unsupported|unverified) [a-z -]+ (?:claims|terms) are present[.!]?$/i.test(text.trim())
    || /^The (?:email(?: copy)?|copy|asset) no longer contains (?:unsupported|unverified) [a-z -]+ claims[.!]?$/i.test(text.trim())) return 'satisfied';
  if (/^(?:This|The) (?:constraint|rule) is violated[.!]?$/i.test(text.trim())) return 'violated';
  return null;
}

const normalize = text => text.toLowerCase().replaceAll('_', ' ').replace(/claims\b/g, 'claim').replace(/\.$/, '').trim();
function prohibitedSubject(rule) {
  // Exact named prohibition only; never infer equivalence between different claim types.
  return [rule.value, rule.constraint_type].filter(Boolean)
    .map(value => /^no ((?:unverified|unsupported) [a-z -]+ (?:claim|terms))$/.exec(normalize(value))?.[1]).find(Boolean);
}
function clearedSubject(text) {
  return /^(?:no |the (?:email(?: copy)?|copy|asset) no longer contains )((?:unverified|unsupported) [a-z -]+ (?:claim|terms))(?: are present)?$/.exec(normalize(text))?.[1];
}

export function guardianInconsistencies(output, context, qa = []) {
  // Deterministic policy failures retain precedence and cannot be converted to a retry.
  if (qa.some(q => q.passed === false)) return [];
  const issues = [], rules = new Map((context.human_constraints || []).map(r => [r.id, r]));
  const add = (evaluation, narrative, source) => {
    if (!['satisfied', 'violated'].includes(narrative) || !['satisfied', 'violated'].includes(evaluation.status) || narrative === evaluation.status) return;
    const rule = rules.get(evaluation.constraint_id);
    issues.push({ constraint_id: evaluation.constraint_id, rule: rule?.value || rule?.constraint_type || evaluation.constraint_id,
      narrative_status: narrative, structured_status: evaluation.status, source });
  };
  for (const evaluation of output.constraint_evaluations) {
    add(evaluation, assessment(evaluation.detail), 'constraint_detail');
    // Existing finding contract retained: stable ID prefix explicitly links prose to a rule.
    for (const finding of output.findings) {
      const prefix = `[${evaluation.constraint_id}]`;
      if (finding.finding.startsWith(prefix)) add(evaluation, assessment(finding.finding.slice(prefix.length).trim()), 'finding');
      else {
        const subject = clearedSubject(finding.finding);
        const matches = subject ? [...rules.values()].filter(rule => prohibitedSubject(rule) === subject) : [];
        if (matches.length === 1 && matches[0].id === evaluation.constraint_id) add(evaluation, 'satisfied', 'exact_named_rule');
      }
    }
    if (/^All (?:explicit |effective )?constraints (?:are )?satisfied[.!]?$/i.test(output.summary.trim())) add(evaluation, 'satisfied', 'summary');
  }
  const violation = output.constraint_evaluations.some(e => e.status === 'violated');
  const corrective = output.findings.some(f => f.requires_correction && ['warning', 'blocker'].includes(f.severity));
  if (output.recommendation === 'needs_changes' && !violation && !corrective) {
    issues.push({ constraint_id: null, rule: 'Overall recommendation', narrative_status: 'no_corrective_evidence', structured_status: 'needs_changes', source: 'recommendation' });
  } else if (output.recommendation === 'ready_for_human_review' && (violation || corrective)) {
    issues.push({ constraint_id: null, rule: 'Overall recommendation', narrative_status: 'corrective_evidence', structured_status: 'ready_for_human_review', source: 'recommendation' });
  }
  return issues;
}
