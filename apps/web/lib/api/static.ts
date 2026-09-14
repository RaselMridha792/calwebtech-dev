import 'server-only';
import {
  SITE_ROUTES,
  STATIC_LEGAL_SLUGS,
  staticContactViewSchema,
  staticFaqViewSchema,
  staticLegalViewSchema,
  staticNotFoundViewSchema,
  staticPricingViewSchema,
  staticProcessViewSchema,
  staticThankYouViewSchema,
  type StaticLegalSlug,
  type StaticNotFoundView,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import {
  staticContactSnapshot,
  staticFaqSnapshot,
  staticLegalSnapshots,
  staticNotFoundSnapshot,
  staticPricingSnapshot,
  staticProcessSnapshot,
  staticThankYouSnapshots,
} from '@/static-content/static';
import { findView, getView } from './core';

/*
 * The static page family (docs/10-site-pages.md): pricing, process, contact, FAQ, the
 * thank-you pages, the legal set and the designed 404. Without API_INTERNAL_URL each getter
 * returns its snapshot from static-content/static, validated by the same schema.
 */

export const getStaticPricing = cache(() => getView('/pages/pricing', staticPricingViewSchema, staticPricingSnapshot));

export const getStaticProcess = cache(() => getView('/pages/process', staticProcessViewSchema, staticProcessSnapshot));

export const getStaticContact = cache(() => getView('/pages/contact', staticContactViewSchema, staticContactSnapshot));

export const getStaticFaq = cache(() => getView('/pages/faq', staticFaqViewSchema, staticFaqSnapshot));

/**
 * The designed 404's copy, or null when it cannot be read. Next.js renders not-found
 * boundaries into every page's payload, so a missing or malformed `static.not-found` setting
 * must not throw there: the page falls back to a plain 404 and the failure is logged.
 */
export const getStaticNotFound = cache(async (): Promise<StaticNotFoundView | null> => {
  try {
    return await getView('/pages/not-found', staticNotFoundViewSchema, staticNotFoundSnapshot);
  } catch (error) {
    console.error('The not-found page copy could not be loaded; showing the plain 404.', error);
    return null;
  }
});

/** A conversion type's thank-you page, or null for a type that has none (the page answers 404). */
export const getStaticThankYou = cache((type: string) =>
  findView(
    `/pages/thank-you/${encodeURIComponent(type)}`,
    staticThankYouViewSchema,
    Object.hasOwn(staticThankYouSnapshots, type) ? staticThankYouSnapshots[type] : null,
  ),
);

export const getStaticLegal = cache((slug: StaticLegalSlug) =>
  getView(`/pages/legal/${slug}`, staticLegalViewSchema, staticLegalSnapshots[slug]),
);

/** Names of the legal pages in the sitemap, the footer's labels. */
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
