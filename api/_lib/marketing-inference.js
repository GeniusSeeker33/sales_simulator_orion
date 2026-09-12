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
  const qa = request.agent_key === 'guardian' ? deterministicQA(context) : [];
  if (request.agent_key === 'guardian') output = calibrateGuardian(output, qa);
  return { output, qa, usage };
}
