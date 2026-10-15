import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = (value) => createHash('sha256').update(value).digest('hex');
export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function validLabel(value) {
  const label = typeof value === 'string' ? value.trim() : '';
  if (!label || label.length > 40 || /[\x00-\x1f\x7f]/.test(label)) return null;
  return label;
}
export function parseCookies(raw = '') {
  const result = {};
  for (const pair of raw.split(';')) {
    const splitAt = pair.indexOf('=');
    if (splitAt <= 0) continue;
    const key = pair.slice(0, splitAt).trim();
    const value = pair.slice(splitAt + 1).trim();
    result[key] = value;
  }
  return result;
}
export function requireOwnAccount(sessionId, requestedId) {
  return !!sessionId && sessionId === requestedId;
}
export function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function getConfig() {
  const origin = process.env.RP_ORIGIN;
  const id = process.env.RP_ID;
  if (!origin || !id || !process.env.DATABASE_URL) throw new Error('DATABASE_URL, RP_ORIGIN, RP_ID 환경변수가 필요합니다.');
  const url = new URL(origin);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) || url.origin !== origin || id !== url.hostname) {
    throw new Error('RP_ORIGIN은 정확한 사이트 출처, RP_ID는 해당 호스트명이어야 합니다.');
  }
  return { origin, id, secure: url.protocol === 'https:' };
}
