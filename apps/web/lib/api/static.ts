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
import { apiUrl, findView, getView, hasApi } from './core';

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
 * How long the 404 copy is reused, matching the campaign pages' regeneration interval. The
 * root not-found boundary is rendered into the payload of every page, the statically
 * regenerated campaign pages included, so its data must be cacheable: a per-request fetch
 * there would turn those pages dynamic. A changed `static.not-found` setting shows within this.
 */
export const STATIC_NOT_FOUND_REVALIDATE_SECONDS = 300;

/**
 * The designed 404's copy, or null when it cannot be read (a missing or malformed setting, or
 * no API during the build). A 404 must never become an error page, so the page then falls
 * back to a plain version, and the failure is logged.
 */
export const getStaticNotFound = cache(async (): Promise<StaticNotFoundView | null> => {
  if (!hasApi()) return staticNotFoundViewSchema.parse(staticNotFoundSnapshot);
  try {
    const response = await fetch(apiUrl('/pages/not-found'), {
      next: { revalidate: STATIC_NOT_FOUND_REVALIDATE_SECONDS },
    });
    if (!response.ok) throw new Error(`API responded ${String(response.status)} for /pages/not-found`);
    return staticNotFoundViewSchema.parse(await response.json());
  } catch (error) {
    console.warn('The not-found page copy could not be loaded; showing the plain 404.', error);
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
