import 'server-only';
import type { Metadata } from 'next';
import { getSiteChrome } from '@/lib/api/site';
import { buildMetadata, type PageMetadataInput } from './metadata';

/**
 * Metadata for a page under the site layout. Every site page is noindex until the
 * `site.indexing` setting is on; `noindex` keeps a page out of search even then (thank-you
 * pages, filtered listings that are not deliberate targets).
 */
export async function sitePageMetadata(
  input: Omit<PageMetadataInput, 'indexable'> & { noindex?: boolean },
): Promise<Metadata> {
  const { noindex = false, ...page } = input;
  const chrome = await getSiteChrome();
  return buildMetadata({ ...page, indexable: chrome.indexable && !noindex });
}
