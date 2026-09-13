import { guardianInconsistencies, GUARDIAN_CONSISTENCY_VERSION, GUARDIAN_INCONSISTENCY } from './marketing-guardian-consistency.js';
import { CONTRACTS, MODEL, deterministicQA, instructions, validateOutput } from './marketing-agents.js';
import { calibrateGuardian } from './marketing-guardian-qa.js';

export async function inferMarketing({ model, request, context, onUsage = () => {}, onPhase = () => {} }) {
  const response = await model.responses.create({
    model: MODEL, store: false, max_output_tokens: 6000,
    input: [{ role: 'system', content: instructions(request.agent_key) }, { role: 'user', content: JSON.stringify(context) }],
    text: { format: { type: 'json_schema', name: `marketing_${request.agent_key}`, strict: true, schema: CONTRACTS[request.agent_key] } },
  });
  const usage = Object.fromEntries(['input_tokens', 'output_tokens', 'total_tokens'].filter(k => Number.isSafeInteger(response.usage?.[k]) && response.usage[k] >= 0).map(k => [k, response.usage[k]]));
  onUsage(usage);
  onPhase('invalid_output');
  if (response.status !== 'completed' || !response.output_text) throw new Error('Incomplete model response');
  let output = validateOutput(request.agent_key, JSON.parse(response.output_text));
  if (request.agent_key === 'creator' && output.asset_type !== (request.revision_asset_id ? context.asset.asset_type : request.asset_type)) throw new Error('Wrong requested asset type');
  const qa = request.agent_key === 'guardian' ? [...deterministicQA(context), ...(context.constraint_preflight || [])] : [];
  if (request.agent_key === 'guardian') {
    onPhase('constraint_evaluation_mismatch');
    const ids = new Set((context.human_constraints || []).map(c => c.id));
    if (output.constraint_evaluations.length !== ids.size || new Set(output.constraint_evaluations.map(e => e.constraint_id)).size !== ids.size
      || output.constraint_evaluations.some(e => !ids.has(e.constraint_id))) throw new Error('Invalid constraint evaluation coverage');
    onPhase('invalid_output');
    const inconsistencies = guardianInconsistencies(output, context, qa);
    if (inconsistencies.length) return { output: { result: output, inconsistencies, validation_version: GUARDIAN_CONSISTENCY_VERSION }, qa, usage, error: GUARDIAN_INCONSISTENCY };
    output = calibrateGuardian(output, qa);
    output.constraint_evaluations = output.constraint_evaluations.map(e => qa.some(q => q.constraint_id === e.constraint_id && !q.passed) ? { ...e, status: 'violated', detail: qa.find(q => q.constraint_id === e.constraint_id && !q.passed).detail } : e);
    if (output.constraint_evaluations.some(e => e.status === 'violated')) output.recommendation = 'needs_changes';
  }
  return { output, qa, usage };
}
