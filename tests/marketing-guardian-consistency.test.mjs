import test from 'node:test';
import assert from 'node:assert/strict';
import { guardianInconsistencies, GUARDIAN_INCONSISTENCY } from '../api/_lib/marketing-guardian-consistency.js';
import { inferMarketing } from '../api/_lib/marketing-inference.js';
const id = '00000000-0000-4000-8000-000000000001';
const context = { human_constraints: [{ id, constraint_type: 'human_instruction', value: 'No unverified comparative claims' }],
 campaign: { target_audiences: ['dealers'], channels: ['email'], primary_cta: 'Book a demo' }, asset: { asset_type: 'email_copy', content: 'Book your demo.' } };
const output = (status, detail, recommendation = status === 'violated' ? 'needs_changes' : 'ready_for_human_review') => ({
 summary: 'Reviewed the copy.', recommendation, findings: [], constraint_evaluations: [{ constraint_id: id, status, detail }] });

test('ID-bound narrative satisfaction contradicts a structured violation in both claim examples', () => {
 for (const detail of ['The email copy no longer contains unverified comparative claims.', 'No unsupported incentive claims are present.', 'Assessment: satisfied. The rule is met.']) {
  const issues = guardianInconsistencies(output('violated', detail), context);
  assert.equal(issues[0].constraint_id, id); assert.equal(issues[0].narrative_status, 'satisfied'); assert.equal(issues[0].structured_status, 'violated');
 }
});
test('ID-bound narrative violation contradicts structured satisfaction', () => {
 const issues = guardianInconsistencies(output('satisfied', 'Assessment: violated. An unsupported claim remains.'), context);
 assert.equal(issues[0].narrative_status, 'violated'); assert.equal(issues[0].structured_status, 'satisfied');
});
test('a genuine violation, satisfaction and nuanced semantic review remain valid', () => {
 for (const value of [output('violated', 'The phrase "competitive wholesale firearms" is an unsupported comparative claim.'),
  output('violated', 'Potential comparative implication remains.'), output('satisfied', 'Assessment: satisfied. No issue.'),
  output('semantic_review', 'This is borderline; human review recommended.')]) assert.deepEqual(guardianInconsistencies(value, context), []);
});
test('unidentified prose, negation, exceptions and unrelated rules do not cause speculative contradictions', () => {
 for (const detail of ['This rule might be satisfied.', 'This constraint is satisfied except for the final claim.', 'The author wrote "This constraint is satisfied".', 'If revised, this constraint is satisfied.']) assert.deepEqual(guardianInconsistencies(output('violated', detail), context), []);
 const value = output('violated', 'Potential implication remains.');
 value.findings = [{ finding: 'No unsupported incentive claims are present.', requires_correction: false, severity: 'info' }];
 assert.deepEqual(guardianInconsistencies(value, context), []);
 value.findings[0].finding = `[${id}] Assessment: satisfied. No unsupported incentive claims are present.`;
 assert.equal(guardianInconsistencies(value, context)[0].source, 'finding');
 value.findings[0].finding = '[another-rule] Assessment: satisfied.';
 assert.deepEqual(guardianInconsistencies(value, context), []);
});
test('overall recommendation must have supporting evidence without over-constraining advisory findings', () => {
 assert.equal(guardianInconsistencies(output('satisfied', 'Assessment: satisfied.', 'needs_changes'), context)[0].source, 'recommendation');
 assert.equal(guardianInconsistencies(output('violated', 'Potential implication remains.', 'ready_for_human_review'), context)[0].source, 'recommendation');
 const value = output('satisfied', 'Assessment: satisfied.'); value.findings = [{ severity: 'warning', requires_correction: false, finding: 'Optional improvement.' }];
 assert.deepEqual(guardianInconsistencies(value, context), []);
 value.findings[0].requires_correction = true; value.recommendation = 'needs_changes';
 assert.deepEqual(guardianInconsistencies(value, context), []);
});
test('deterministic policy failures keep their blocking authority', () => {
 assert.deepEqual(guardianInconsistencies(output('violated', 'Assessment: satisfied.'), context, [{ passed: false }]), []);
});
test('shared server inference rejects inconsistency before calibration and preserves original structured evidence', async () => {
 const original = output('violated', 'The email copy no longer contains unverified comparative claims.');
 const result = await inferMarketing({ request: { agent_key: 'guardian' }, context, model: { responses: { create: async () => ({ status: 'completed', output_text: JSON.stringify(original), usage: { total_tokens: 42 } }) } } });
 assert.equal(result.error, GUARDIAN_INCONSISTENCY); assert.deepEqual(result.output.result, original);
 assert.ok(result.qa.every(q => q.passed)); assert.equal(result.usage.total_tokens, 42);
});

test('legacy unlinked narrative uses only one exact named rule, never ambiguous rules or loose synonym matching', () => {
 const value = output('violated', 'Potential issue remains.');
 value.findings = [{ severity: 'info', requires_correction: false, finding: 'The email copy no longer contains unverified comparative claims.' }];
 assert.equal(guardianInconsistencies(value, context)[0].source, 'exact_named_rule');
 assert.equal(guardianInconsistencies(value, { ...context, human_constraints: [{ id, constraint_type: 'no_unverified_comparative_claim', value: 'Avoid all unsubstantiated comparisons.' }] })[0].source, 'exact_named_rule');
 const duplicates = { ...context, human_constraints: [...context.human_constraints, { ...context.human_constraints[0], id: 'other' }] };
 assert.deepEqual(guardianInconsistencies(value, duplicates), []);
 value.findings[0].finding = 'No unsupported incentive claims are present.';
 assert.deepEqual(guardianInconsistencies(value, context), []);
});
