import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const randomToken = (bytes = 32) => Buffer.from(randomBytes(bytes)).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const hashIdentifier = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

export function safeTokenMatch(raw: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(raw), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
