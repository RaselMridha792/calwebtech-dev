import { z } from 'zod';

/**
 * What stands between a public form and the database besides Turnstile and the honeypot
 * (docs/14-remaining-work.md, task 6; docs/08-decisions.md, 61). Every check here runs in
 * the API, the same for leads, bookings and subscribers; the browser only reports how long
 * the form was open.
 */

/** The forms the checks know, each with its own limits. */
export const ANTISPAM_FORMS = ['lead', 'booking', 'subscribe'] as const;
export type AntispamForm = (typeof ANTISPAM_FORMS)[number];

/**
 * How long a form has to have been open before it is sent, in milliseconds. A person reads
 * and types; a script posts at once. The figures are low on purpose: a false positive is a
 * person told to try again, so the check only catches what no person could do.
 */
export const FORM_MINIMUM_MS: Record<AntispamForm, number> = {
  lead: 2_000,
  booking: 2_000,
  subscribe: 1_000,
};

/**
 * How many submissions one address may make in a window, whatever network they come from.
 * The per-IP limit stops a loop from one machine; this stops one address being used from
 * many.
 */
export const EMAIL_LIMITS: Record<AntispamForm, { max: number; windowSeconds: number }> = {
  lead: { max: 5, windowSeconds: 60 * 60 },
  booking: { max: 3, windowSeconds: 24 * 60 * 60 },
  subscribe: { max: 5, windowSeconds: 60 * 60 },
};

/**
 * Milliseconds the form was open before it was sent, measured in the browser from the form
 * appearing. Optional, so a page loaded before the field existed still sends; a value under
 * the form's minimum is refused as automated.
 */
export const formElapsedSchema = z.coerce.number().int().min(0).max(24 * 60 * 60 * 1000).optional();

/** Why an address was refused, in words the form shows under the field. */
export const EMAIL_DOMAIN_MESSAGES = {
  disposable: 'Use an address you will check: a temporary inbox cannot receive our reply.',
  noMail: 'That address cannot receive email. Check it for a typo.',
} as const;

/**
 * Throwaway inbox providers. Short on purpose: these are the services that show up in real
 * form spam, and a long list mostly adds domains nobody uses. Matched on the domain and any
 * subdomain of it.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  'anonbox.net',
  'burnermail.io',
  'discard.email',
  'dispostable.com',
  'dropmail.me',
  'emailondeck.com',
  'fakeinbox.com',
  'fakemail.net',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxkitten.com',
  'jetable.org',
  'mail-temp.com',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailinator2.com',
  'mailnesia.com',
  'mailsac.com',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spam4.me',
  'spambox.us',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.dev',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'tmail.ws',
  'tmpmail.net',
  'tmpmail.org',
  'trash-mail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

/** The part after the @, lower-cased. */
export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase();
}

/** True for a throwaway inbox provider or a subdomain of one. */
export function isDisposableDomain(domain: string): boolean {
  const labels = domain.toLowerCase().split('.');
  for (let start = 0; start < labels.length - 1; start += 1) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(start).join('.'))) return true;
  }
  return false;
}
