'use server';

import { SUBSCRIBE_SOURCE_HOME, subscribeSubmissionSchema } from '@calwebtech/shared';
import { headers } from 'next/headers';
import { postSubscriber } from '@/lib/api/subscribers';
import { TURNSTILE_FIELD } from '@/lib/turnstile-field';

/**
 * What the band shows after a submit. `email` is echoed on an error so React's automatic form
 * reset puts back what the visitor typed rather than an empty box.
 */
export type NewsletterState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; reason: 'invalid' | 'bot_check_failed' | 'rate_limited' | 'unavailable'; email: string };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/**
 * The homepage's "Subscribe now" posts here. Everything that matters is decided by the API;
 * this reads the form, validates it once more so an obviously bad address never leaves the
 * server, and turns the API's answer into words for the band.
 */
export async function subscribeToNewsletter(_previous: NewsletterState, form: FormData): Promise<NewsletterState> {
  const email = text(form, 'email');
  const parsed = subscribeSubmissionSchema.safeParse({
    email,
    sourcePage: text(form, 'sourcePage') || SUBSCRIBE_SOURCE_HOME,
    turnstileToken: text(form, TURNSTILE_FIELD) || undefined,
    referenceCode: text(form, 'referenceCode') || undefined,
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid', email };

  // The proxy in front of the web app sets this; the API trusts it for rate limiting.
  const forwarded = (await headers()).get('x-forwarded-for');
  const visitorIp = forwarded?.split(',')[0]?.trim() ?? null;

  const outcome = await postSubscriber(parsed.data, visitorIp);
  switch (outcome.status) {
    case 'subscribed':
      return { status: 'success' };
    case 'invalid':
      return { status: 'error', reason: 'invalid', email };
    case 'bot-check':
      return { status: 'error', reason: 'bot_check_failed', email };
    case 'rate-limited':
      return { status: 'error', reason: 'rate_limited', email };
    case 'unavailable':
      return { status: 'error', reason: 'unavailable', email };
  }
}
