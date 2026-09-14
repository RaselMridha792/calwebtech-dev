import aiIntegration from './ai-integration.json';
import aiSearchVisibility from './ai-search-visibility.json';
import carePlans from './care-plans.json';
import customWebsiteDevelopment from './custom-website-development.json';
import ecommerceDevelopment from './ecommerce-development.json';
import index from './index.json';
import nextjsDevelopment from './nextjs-development.json';
import shopifyDevelopment from './shopify-development.json';
import webApplicationDevelopment from './web-application-development.json';
import websiteRedesign from './website-redesign.json';
import wordpressDevelopment from './wordpress-development.json';

/**
 * The services family's views while no API is hosted (docs/10-site-pages.md, Snapshots):
 * exactly what `GET /pages/services` and `GET /pages/services/:slug` return, with the
 * publish-ready copy. Validated by the getters and by services.test.ts.
 */
export const servicesIndexSnapshot: unknown = index;

/** Detail views keyed by slug. */
export const serviceSnapshots: Readonly<Record<string, unknown>> = {
  'custom-website-development': customWebsiteDevelopment,
  'website-redesign': websiteRedesign,
  'web-application-development': webApplicationDevelopment,
  'ecommerce-development': ecommerceDevelopment,
  'nextjs-development': nextjsDevelopment,
  'wordpress-development': wordpressDevelopment,
  'shopify-development': shopifyDevelopment,
  'ai-search-visibility': aiSearchVisibility,
  'ai-integration': aiIntegration,
  'care-plans': carePlans,
};

/**
 * A detail snapshot, or undefined for any other path segment. Own keys only, so a slug such
 * as `constructor` or `__proto__` is a 404 rather than an object from the prototype.
 */
export function serviceSnapshot(slug: string): unknown {
  return Object.hasOwn(serviceSnapshots, slug) ? serviceSnapshots[slug] : undefined;
}
