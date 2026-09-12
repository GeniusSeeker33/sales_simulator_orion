import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicQA, validateOutput } from '../api/_lib/marketing-agents.js';
import { calibrateGuardian } from '../api/_lib/marketing-guardian-qa.js';
import { deriveMarketingAttention } from '../src/lib/marketingAttention.js';

const cta = 'Apply to become an Orion Wholesale dealer at Join-Orion.com.';
const content = 'Take the first step by applying at Join-Orion.com to begin the dealer qualification process.';
const context = (text = content, primary_cta = cta) => ({ campaign: { primary_cta, channels: ['social'], target_audiences: ['dealers'] }, asset: { asset_type: 'social_copy', content: text } });
const result = (recommendation = 'ready_for_human_review', findings = []) => ({ summary: 'Reviewed the asset.', recommendation, findings });
const finding = (severity, requires_correction, text = 'Review CTA suitability.') => ({ category: 'cta', severity, requires_correction, finding: text });
const calibrate = (output, ctx = context()) => calibrateGuardian(validateOutput('guardian', output), deterministicQA(ctx));

test('hosted CTA wording regression passes objective checks without verbatim reproduction', () => {
  assert.ok(!content.includes(cta));
  const qa = deterministicQA(context());
  assert.ok(qa.every(q => q.passed));
  assert.ok(qa.filter(q => q.rule.startsWith('cta_')).every(q => !q.review_required));
  assert.equal(calibrate(result('needs_changes')).recommendation, 'ready_for_human_review');
});

test('missing and misleading destinations fail exact hostname checks', () => {
  for (const text of ['Apply for dealer qualification.', 'Apply at notJoin-Orion.com.', 'Apply at Join-Orion.com.evil.test.', 'Apply at https://Join-Orion.com@evil.test.', 'Apply at https://evil.test/Join-Orion.com']) {
    const qa = deterministicQA(context(text));
    assert.equal(qa.find(q => q.rule === 'cta_destination').passed, false, text);
    assert.equal(calibrate(result(), context(text)).recommendation, 'needs_changes');
  }
  for (const text of ['Apply at https://www.Join-Orion.com.', 'Apply at JOIN-ORION.COM!', 'Apply at https://join-orion.com/dealers']) assert.equal(deterministicQA(context(text)).find(q => q.rule === 'cta_destination').passed, true, text);
});

test('a destination or noun alone is not actionable copy', () => {
  for (const text of ['Join-Orion.com.', 'Our dealer application information is at Join-Orion.com.', 'https://join-orion.com/apply']) {
    assert.equal(deterministicQA(context(text)).find(q => q.rule === 'cta_action').passed, false, text);
    assert.equal(calibrate(result(), context(text)).recommendation, 'needs_changes');
  }
});

test('bounded intent uncertainty becomes advisory semantic review, never fuzzy approval or a blocking mismatch', () => {
  const output = calibrate(result(), context('Register at Join-Orion.com.'));
  assert.equal(output.recommendation, 'ready_for_human_review');
  assert.equal(output.findings[0].requires_correction, false);
  assert.match(output.findings[0].finding, /Human semantic review required/);
  assert.ok(deterministicQA(context('Register at Join-Orion.com.')).some(q => q.review_required));
  const unknown = calibrate(result(), context('Embark on your journey.', 'Embark on a dealer journey.'));
  assert.equal(unknown.recommendation, 'ready_for_human_review');
  assert.equal(unknown.findings[0].severity, 'info');
});

test('unsupported comparative claim and substantive corrections force needs_changes, regardless of model recommendation', () => {
  const claim = { ...finding('warning', true, 'The claim "better margins than every wholesaler" is unsupported; remove it.'), category: 'claims' };
  const output = calibrate(result('ready_for_human_review', [claim]), context(`${content} Better margins than every wholesaler.`));
  assert.equal(output.recommendation, 'needs_changes'); assert.deepEqual(output.findings, [claim]);
  assert.equal(calibrate(result('ready_for_human_review', [finding('blocker', true)])).recommendation, 'needs_changes');
});

test('informational/advisory findings cannot force needs_changes and malformed severity flags are rejected', () => {
  for (const severity of ['info', 'warning']) assert.equal(calibrate(result('needs_changes', [finding(severity, false)])).recommendation, 'ready_for_human_review');
  assert.throws(() => calibrate(result('needs_changes', [finding('info', true)])), /severity/);
  assert.throws(() => calibrate(result('ready_for_human_review', [finding('blocker', false)])), /severity/);
  assert.throws(() => calibrate(result('needs_changes', [finding('warning', 'true')])), /structured/);
});

test('unresolved placeholders and real deterministic failures always block readiness', () => {
  const ctx = context(`${content} {{INSERT OFFER}}`);
  assert.equal(deterministicQA(ctx).find(q => q.rule === 'no_placeholders').passed, false);
  assert.equal(calibrate(result('ready_for_human_review', [finding('info', false)]), ctx).recommendation, 'needs_changes');
  assert.equal(calibrate(result(), context('')).recommendation, 'needs_changes');
});

test('calibrated advisory attention is yellow; blocking attention is red; approval remains a separate asset gate', () => {
  const attention = (output, qa, approval_state = 'draft', events = []) => deriveMarketingAttention({ workspace: { id: 'w' }, campaigns: [{ id: 'c', name: 'Campaign' }], assets: [{ id: 'a', workspace_id: 'w', campaign_id: 'c', name: 'Asset', approval_state }], attention_events: events,
    attention_runs: [{ id: 'r', workspace_id: 'w', campaign_id: 'c', agent_key: 'guardian', status: 'succeeded', asset_id: 'a', asset_revision: 1,
      recommendation: output.recommendation, has_findings: output.findings.length > 0, qa_failed: qa.some(q => !q.passed) }] });
  const qa = deterministicQA(context()), advisory = calibrate(result('needs_changes', [finding('info', false)]));
  assert.equal(attention(advisory, qa)[0].severity, 'attention');
  assert.equal(attention(calibrate(result('ready_for_human_review', [finding('warning', true)])), qa)[0].severity, 'critical');
  assert.ok(attention(advisory, qa, 'in_review').some(i => i.id === 'asset:a' && i.severity === 'critical'));
  for (const action of ['approved', 'asset_saved']) assert.equal(attention(advisory, qa, 'approved', [{ asset_id: 'a', revision: 2, action }]).length, 0);
});
