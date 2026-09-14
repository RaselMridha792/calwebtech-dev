import 'server-only';
import {
  SITE_ROUTES,
  STATIC_LEGAL_SLUGS,
  staticContactViewSchema,
  staticFaqViewSchema,
  staticLegalViewSchema,
  staticPricingViewSchema,
  staticProcessViewSchema,
  staticThankYouViewSchema,
  type StaticLegalSlug,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import {
  staticContactSnapshot,
  staticFaqSnapshot,
  staticLegalSnapshots,
  staticPricingSnapshot,
  staticProcessSnapshot,
  staticThankYouSnapshots,
} from '@/static-content/static';
import { findView, getView } from './core';

/*
 * The static page family (docs/10-site-pages.md): pricing, process, contact, FAQ, the
 * thank-you pages and the legal set. Without API_INTERNAL_URL each getter returns its
 * snapshot from static-content/static, validated by the same schema.
 */

export const getStaticPricing = cache(() => getView('/pages/pricing', staticPricingViewSchema, staticPricingSnapshot));

export const getStaticProcess = cache(() => getView('/pages/process', staticProcessViewSchema, staticProcessSnapshot));

export const getStaticContact = cache(() => getView('/pages/contact', staticContactViewSchema, staticContactSnapshot));

export const getStaticFaq = cache(() => getView('/pages/faq', staticFaqViewSchema, staticFaqSnapshot));

/** A conversion type's thank-you page, or null for a type that has none. */
export const getStaticThankYou = cache((type: string) =>
  findView(`/pages/thank-you/${encodeURIComponent(type)}`, staticThankYouViewSchema, Object.hasOwn(staticThankYouSnapshots, type) ? staticThankYouSnapshots[type] : null),
);

export const getStaticLegal = cache((slug: StaticLegalSlug) =>
  getView(`/pages/legal/${slug}`, staticLegalViewSchema, staticLegalSnapshots[slug]),
);

const LEGAL_TITLES: Record<StaticLegalSlug, string> = {
  'privacy-policy': 'Privacy policy',
  terms: 'Terms of use',
  'cookie-policy': 'Cookie policy',
  accessibility: 'Accessibility statement',
  'information-security': 'Information security',
};

/**
 * The family's indexable pages. They exist whatever is published, so the list needs no
 * call. Thank-you pages are noindex and stay out of the sitemap.
 */
export function sitemapEntries(): Promise<SitemapEntry[]> {
  return Promise.resolve([
    { path: SITE_ROUTES.pricing, title: 'Pricing', section: 'Plan a project' },
    { path: SITE_ROUTES.process, title: 'How a project runs', section: 'Plan a project' },
    { path: SITE_ROUTES.faq, title: 'Frequently asked questions', section: 'Plan a project' },
    { path: SITE_ROUTES.contact, title: 'Contact', section: 'Plan a project' },
    ...STATIC_LEGAL_SLUGS.map((slug) => ({ path: `/${slug}/`, title: LEGAL_TITLES[slug], section: 'Legal' })),
  ]);
}
