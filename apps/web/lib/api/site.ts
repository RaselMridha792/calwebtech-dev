import 'server-only';
import {
  SETTING_KEYS,
  buildSiteChrome,
  homePageContentSchema,
  siteChromeViewSchema,
  type SiteChromeView,
} from '@calwebtech/shared';
import { cache } from 'react';
import staticChrome from '@/static-content/site-chrome.json';
import { findStoredCopy, getView } from './core';
import { getHomePage } from './index';

/**
 * The header, menus, footer and closing band of every site page, and whether site pages
 * may be indexed (`site.indexing`). Deduplicated within a request, so the layout, the
 * page's metadata and robots.txt share one call.
 *
 * The chrome is built from the homepage copy (`buildSiteChrome`). While the homepage's copy
 * comes from the dashboard and its records from the snapshot (`home` database-first), the
 * chrome is rebuilt the same way, so a menu or footer changed in the dashboard shows on every
 * page. Built from the snapshots alone it is exactly the committed chrome.
 */
export const getSiteChrome = cache(async (): Promise<SiteChromeView> => {
  const chrome = await getView('/site/chrome', siteChromeViewSchema, staticChrome);
  const stored = await findStoredCopy('home', SETTING_KEYS.homeContent, homePageContentSchema);
  if (!stored) return chrome;
  const home = await getHomePage();
  return buildSiteChrome({
    indexable: chrome.indexable,
    contact: chrome.contact,
    reviews: chrome.reviews,
    content: stored,
    serviceGroups: home.serviceGroups,
    services: home.services,
    industries: home.industries,
    projects: home.projects,
    offices: home.locations.map((location) => ({ city: location.city, address: location.address })),
  });
});
