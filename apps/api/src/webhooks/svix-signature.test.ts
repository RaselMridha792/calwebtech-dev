import { describe, expect, it } from 'vitest';
import { SIGNATURE_TOLERANCE_SECONDS, signPayload, verifySignature } from './svix-signature';

const SECRET = `whsec_${Buffer.from('a test signing key of some length').toString('base64')}`;
const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);
const TIMESTAMP = String(NOW / 1000);
const BODY = '{"type":"email.delivered","created_at":"2026-09-24T12:00:00Z","data":{"email_id":"e1"}}';

function signed(overrides: Partial<{ id: string; timestamp: string; signature: string; body: string }> = {}) {
  const id = overrides.id ?? 'msg_1';
  const timestamp = overrides.timestamp ?? TIMESTAMP;
  const body = overrides.body ?? BODY;
  return { id, timestamp, body, signature: overrides.signature ?? `v1,${signPayload(SECRET, id, timestamp, BODY)}` };
}

describe('Resend (Svix) webhook signatures', () => {
  it('accept a request signed with the secret', () => {
    expect(verifySignature(SECRET, signed(), NOW)).toBe(true);
  });

  it('accept any one of several signatures, as while a secret is rotated', () => {
    const good = signPayload(SECRET, 'msg_1', TIMESTAMP, BODY);
    expect(verifySignature(SECRET, signed({ signature: `v1,bm90IGl0 v1,${good}` }), NOW)).toBe(true);
  });

  it('refuse a body changed after signing', () => {
    expect(verifySignature(SECRET, signed({ body: BODY.replace('delivered', 'complained') }), NOW)).toBe(false);
  });

  it('refuse a signature made with another secret', () => {
    const other = `whsec_${Buffer.from('somebody else').toString('base64')}`;
    const signature = `v1,${signPayload(other, 'msg_1', TIMESTAMP, BODY)}`;
    expect(verifySignature(SECRET, signed({ signature }), NOW)).toBe(false);
  });

  it('refuse a request replayed outside the tolerance', () => {
    const late = NOW + (SIGNATURE_TOLERANCE_SECONDS + 1) * 1000;
    expect(verifySignature(SECRET, signed(), late)).toBe(false);
  });

  it('refuse missing headers and unknown versions', () => {
    expect(verifySignature(SECRET, { ...signed(), id: undefined }, NOW)).toBe(false);
    expect(verifySignature(SECRET, { ...signed(), signature: undefined }, NOW)).toBe(false);
    const good = signPayload(SECRET, 'msg_1', TIMESTAMP, BODY);
    expect(verifySignature(SECRET, signed({ signature: `v2,${good}` }), NOW)).toBe(false);
  });
});
