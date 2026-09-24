import 'server-only';
import { subscribeResultSchema, type SubscribeSubmission } from '@calwebtech/shared';
import { apiUrl, hasApi } from './core';

export type SubscribeOutcome =
  | { status: 'subscribed' }
  | { status: 'invalid' }
  | { status: 'bot-check' }
  | { status: 'rate-limited' }
  | { status: 'unavailable' };

/**
 * Sends an address to `POST /subscribers` and reports what happened in the page's own terms.
 *
 * The API answers a new address, one already on the list and one that unsubscribed with the
 * same `subscribed`, on purpose (docs/08-decisions.md, 53), so there is nothing to tell them
 * apart here and nothing on the page that could.
 */
export async function postSubscriber(input: SubscribeSubmission, visitorIp: string | null): Promise<SubscribeOutcome> {
  if (!hasApi()) return { status: 'unavailable' };

  let response: Response;
  try {
    response = await fetch(apiUrl('/subscribers'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // The API trusts this because the proxy in front of it sets it (docs/01).
        ...(visitorIp ? { 'x-forwarded-for': visitorIp } : {}),
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
  } catch {
    return { status: 'unavailable' };
  }

  if (response.ok) {
    return subscribeResultSchema.safeParse(await response.json().catch(() => null)).success
      ? { status: 'subscribed' }
      : { status: 'unavailable' };
  }
  if (response.status === 400) return { status: 'invalid' };
  if (response.status === 403) return { status: 'bot-check' };
  if (response.status === 429) return { status: 'rate-limited' };
  return { status: 'unavailable' };
}
