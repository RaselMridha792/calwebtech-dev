import type { StaticLegalSlug, StaticThankYouType } from '@calwebtech/shared';
import contact from './contact.json';
import faq from './faq.json';
import accessibility from './legal/accessibility.json';
import cookiePolicy from './legal/cookie-policy.json';
import informationSecurity from './legal/information-security.json';
import privacyPolicy from './legal/privacy-policy.json';
import terms from './legal/terms.json';
import pricing from './pricing.json';
import processPage from './process.json';
import notFound from './not-found.json';
import audit from './thank-you/audit.json';
import booking from './thank-you/booking.json';
import calculator from './thank-you/calculator.json';
import careers from './thank-you/careers.json';
import contactThanks from './thank-you/contact.json';
import project from './thank-you/project.json';
import resource from './thank-you/resource.json';

/*
 * Snapshots of the static family's API responses (docs/10-site-pages.md), which pages render
 * while API_INTERNAL_URL is unset. Each file is exactly what its endpoint returns.
 */

export const staticPricingSnapshot: unknown = pricing;
export const staticProcessSnapshot: unknown = processPage;
export const staticContactSnapshot: unknown = contact;
export const staticFaqSnapshot: unknown = faq;
export const staticNotFoundSnapshot: unknown = notFound;

const thankYouPages: Record<StaticThankYouType, unknown> = {
  contact: contactThanks,
  project,
  audit,
  calculator,
  booking,
  resource,
  careers,
};

/**
 * `GET /pages/thank-you/:type`, keyed by type. Look a type up with `Object.hasOwn` first,
 * so `constructor` or `__proto__` read as no page rather than as a property of Object.
 */
export const staticThankYouSnapshots: Readonly<Record<string, unknown>> = thankYouPages;

/** `GET /pages/legal/:slug`, keyed by slug. */
export const staticLegalSnapshots: Record<StaticLegalSlug, unknown> = {
  'privacy-policy': privacyPolicy,
  terms,
  'cookie-policy': cookiePolicy,
  accessibility,
  'information-security': informationSecurity,
};
