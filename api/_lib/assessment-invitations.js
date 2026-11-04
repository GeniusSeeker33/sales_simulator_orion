// Server-only invitation helpers. Tokens must never be logged or stored in plaintext.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export function createAssessmentInvitation({ now = Date.now(), ttlMs = DEFAULT_INVITATION_TTL_MS } = {}) {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 30 * 24 * 60 * 60 * 1000) {
    throw new Error('Invalid invitation lifetime');
  }
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashAssessmentToken(token), expiresAt: new Date(now + ttlMs).toISOString() };
}
export function hashAssessmentToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid assessment token');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
export function verifyAssessmentToken(token, expectedHash, expiresAt, now = Date.now()) {
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now) return false;
  let actual;
  try { actual = Buffer.from(hashAssessmentToken(token), 'hex'); } catch { return false; }
  return timingSafeEqual(actual, Buffer.from(expectedHash, 'hex'));
}
