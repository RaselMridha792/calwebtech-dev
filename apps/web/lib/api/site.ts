import 'server-only';
import { siteChromeViewSchema, type SiteChromeView } from '@calwebtech/shared';
import { cache } from 'react';
import staticChrome from '@/static-content/site-chrome.json';
import { getView } from './core';

/**
 * The header, menus, footer and closing band of every site page, and whether site pages
 * may be indexed (`site.indexing`). Deduplicated within a request, so the layout, the
 * page's metadata and robots.txt share one call.
 */
export const getSiteChrome = cache(
  (): Promise<SiteChromeView> => getView('/site/chrome', siteChromeViewSchema, staticChrome),
);
