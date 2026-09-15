import { learnerFetch } from './learnerFetch';

export async function readTalent(params, signal) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
  const timeout = AbortSignal.timeout(45000);
  const response = await learnerFetch(`/api/talent?${query}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Talent workspace unavailable.');
  return result;
}
