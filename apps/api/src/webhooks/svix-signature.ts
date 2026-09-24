import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Checks a Resend webhook signature (Task 5.4). Resend signs with Svix: the secret is
 * `whsec_` and base64, the signed content is `<svix-id>.<svix-timestamp>.<raw body>`, and the
 * `svix-signature` header holds one or more `v1,<base64 HMAC-SHA256>` entries separated by
 * spaces, any one of which may match (a secret being rotated has two).
 *
 * Written here rather than taken from the `svix` package: it is twenty lines of the standard
 * library, and a new dependency is a new supplier (RULES.md, section 1).
 */

/** A timestamp further than this from now is refused, so a captured request cannot be replayed. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export interface SignedRequest {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  body: Buffer | string;
}

function key(secret: string): Buffer {
  return Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64');
}

export function signPayload(secret: string, id: string, timestamp: string, body: Buffer | string): string {
  const content = Buffer.concat([Buffer.from(`${id}.${timestamp}.`), Buffer.isBuffer(body) ? body : Buffer.from(body)]);
  return createHmac('sha256', key(secret)).update(content).digest('base64');
}

export function verifySignature(secret: string, request: SignedRequest, now = Date.now()): boolean {
  const { id, timestamp, signature, body } = request;
  if (!id || !timestamp || !signature) return false;

  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(now / 1000 - seconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(signPayload(secret, id, timestamp, body));
  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
