// Bounded lexical checks, not semantic approval. Bump independently of the DB run protocol.
export const GUARDIAN_QA_VERSION = 'guardian-qa-v2';
const ACTIONS = {
  apply: /\b(apply|applying)\b/i,
  join: /\b(join|joining)\b/i,
  register: /\b(register|registering|sign[ -]?up|signing up)\b/i,
  learn: /\b(learn(?:ing)? more|find out more|discover)\b/i,
  contact: /\b(contact(?:ing)?|call(?:ing)?|email(?:ing)?|reach out)\b/i,
  book: /\b(book(?:ing)?|schedule|scheduling|reserve|reserving)\b/i,
  visit: /\b(visit(?:ing)?|explore|browse|browsing)\b/i,
  buy: /\b(buy(?:ing)?|shop(?:ping)?|order(?:ing)?|purchase|purchasing)\b/i,
  download: /\b(download(?:ing)?)\b/i,
  subscribe: /\b(subscribe|subscribing)\b/i,
};

function destinations(text) {
  const tokens = text.match(/(?:https?:\/\/|www\.)[^\s<>()[\]"']+|\b[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:\/[^\s<>()[\]"']*)?/gi) || [];
  return [...new Set(tokens.flatMap(token => {
    try {
      token = token.replace(/[.,;:!?]+$/, '');
      const url = new URL(/^https?:\/\//i.test(token) ? token : `https://${token}`);
      // Reject credential-bearing URLs; a trusted name in the username is not the destination.
      if (url.username || url.password) return [];
      return [url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')];
    } catch { return []; }
  }))];
}

export function ctaChecks(cta, content) {
  const required = destinations(cta), actual = destinations(content);
  // Destination names/URL paths are not evidence of actionable prose.
  const prose = text => text.replace(/https?:\/\/\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, '');
  const intended = Object.keys(ACTIONS).filter(key => ACTIONS[key].test(prose(cta)));
  const present = Object.keys(ACTIONS).filter(key => ACTIONS[key].test(prose(content)));
  const check = (rule, passed, detail, review_required = false) => ({ rule, passed, detail, review_required, qa_version: GUARDIAN_QA_VERSION });
  return [
    check('cta_destination', !required.length || required.every(host => actual.includes(host)), required.length
      ? `Required destination hostname(s): ${required.join(', ')}. Hostnames must match; CTA wording need not.`
      : 'No recognizable destination in campaign CTA; human semantic review required.', !required.length),
    check('cta_action', present.length > 0 || intended.length === 0, present.length
      ? `Recognized action wording: ${present.join(', ')}. Human review still determines meaning and suitability.`
      : intended.length ? `No recognized actionable CTA; expected action wording such as ${intended.join(', ')}.` : 'Action intent is outside the bounded vocabulary; human semantic review required.', !present.length && !intended.length),
    check('cta_intent', true, intended.some(key => present.includes(key))
      ? 'Campaign action intent is present as recognizable wording; this is not semantic approval.'
      : 'Action equivalence cannot be established lexically; human semantic review required.', !intended.some(key => present.includes(key))),
  ];
}

export function calibrateGuardian(output, qa) {
  const findings = [...output.findings];
  if (qa.some(check => check.review_required) && findings.length === 0) findings.push({ category: 'cta', severity: 'info', requires_correction: false,
    finding: 'Human semantic review required for CTA equivalence or destination. Deterministic checks do not decide semantic suitability.' });
  const blocking = qa.some(check => !check.passed) || findings.some(f => f.requires_correction && ['warning', 'blocker'].includes(f.severity));
  return { ...output, findings, recommendation: blocking ? 'needs_changes' : 'ready_for_human_review' };
}
