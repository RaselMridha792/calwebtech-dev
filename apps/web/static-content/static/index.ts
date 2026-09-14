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
import careers from './thank-you/careers.json';
import consultation from './thank-you/consultation.json';
import contactThanks from './thank-you/contact.json';
import costEstimate from './thank-you/cost-estimate.json';
import project from './thank-you/project.json';
import resource from './thank-you/resource.json';
import serviceEnquiry from './thank-you/service-enquiry.json';
import websiteAudit from './thank-you/website-audit.json';

/*
 * Snapshots of the static family's API responses (docs/10-site-pages.md), which pages render
 * while API_INTERNAL_URL is unset. Each file is exactly what its endpoint returns.
 */

export const staticPricingSnapshot: unknown = pricing;
export const staticProcessSnapshot: unknown = processPage;
export const staticContactSnapshot: unknown = contact;
export const staticFaqSnapshot: unknown = faq;

const thankYouPages = {
  project,
  'service-enquiry': serviceEnquiry,
  consultation,
  contact: contactThanks,
  'cost-estimate': costEstimate,
  'website-audit': websiteAudit,
  resource,
  careers,
} satisfies Record<StaticThankYouType, unknown>;

/** `GET /pages/thank-you/:type`, keyed by type. A type without a page reads as undefined. */
export const staticThankYouSnapshots: Readonly<Record<string, unknown>> = thankYouPages;

/** `GET /pages/legal/:slug`, keyed by slug. */
export const staticLegalSnapshots: Record<StaticLegalSlug, unknown> = {
  'privacy-policy': privacyPolicy,
  terms,
  'cookie-policy': cookiePolicy,
  accessibility,
  'information-security': informationSecurity,
};
