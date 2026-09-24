import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Unsubscribe links (Task 5.4). The worker signs one per recipient and the API checks it,
 * so the two share this file; it is its own entry point (`@calwebtech/shared/unsubscribe-token`)
 * and not in the barrel, because it needs `node:crypto` and the barrel reaches the browser.
 *
 * A token is the subscriber's id, a tilde and an HMAC of the id. It never expires: an unsubscribe link in
 * a two-year-old email has to keep working, and all it can do is stop mail to one address.
 *
 * The key is derived from `AUTH_SECRET` with a purpose label, so the same server secret can
 * sign other things later without one kind of signature being accepted as another.
 */

const PURPOSE = 'calwebtech:unsubscribe:v1';

/** Shorter than this, a secret is treated as missing: a guessable key signs nothing. */
export const SIGNING_SECRET_MIN_LENGTH = 16;

/** The secret when it is long enough to sign with, otherwise null. */
export function usableSigningSecret(secret: string | undefined): string | null {
  return secret && secret.length >= SIGNING_SECRET_MIN_LENGTH ? secret : null;
}

const SIGNATURE_LENGTH = 32;

/**
 * A tilde, not a dot: the site adds a trailing slash to every page, and Next.js treats a
 * last segment with a dot in it as a file, redirecting the link in every email once. The
 * signature is base64url, which never contains a tilde.
 */
const SEPARATOR = '~';

function signature(subscriberId: string, secret: string): string {
  const key = createHmac('sha256', secret).update(PURPOSE).digest();
  return createHmac('sha256', key).update(subscriberId).digest('base64url').slice(0, SIGNATURE_LENGTH);
}

export function signUnsubscribeToken(subscriberId: string, secret: string): string {
  return `${subscriberId}${SEPARATOR}${signature(subscriberId, secret)}`;
}

/** The subscriber id the token was signed for, or null for anything else. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const at = token.lastIndexOf(SEPARATOR);
  if (at <= 0) return null;
  const subscriberId = token.slice(0, at);
  const given = Buffer.from(token.slice(at + 1));
  const expected = Buffer.from(signature(subscriberId, secret));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? subscriberId : null;
}

/** The page a person lands on from the link in the footer. */
export function unsubscribePagePath(token: string): string {
  return `/unsubscribe/${token}/`;
}

/**
 * The one-click address in the `List-Unsubscribe` header (RFC 8058). A mail client POSTs to
 * it directly, so it is the API's route on the site origin, not a page.
 */
export function unsubscribeOneClickPath(token: string): string {
  return `/api/unsubscribe/${token}`;
}
