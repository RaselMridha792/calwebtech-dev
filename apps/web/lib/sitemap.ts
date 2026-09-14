import 'server-only';
import { SITEMAP_SOURCES } from './sitemap-sources';

/** One public page, for sitemap.xml and the human-readable /sitemap/ page. */
export interface SitemapEntry {
  /** Site path with a trailing slash, e.g. `/services/website-redesign/`. */
  path: string;
  /** The page's name as a visitor reads it in the HTML sitemap. */
  title: string;
  /** One of SITEMAP_SECTIONS; the HTML sitemap groups pages by it. */
  section: string;
  /** ISO date of the last change, when the record has one. */
  lastModified?: string | null;
}

export type SitemapSource = () => Promise<readonly SitemapEntry[]>;

/** Sections of the HTML sitemap, in order. A source naming another section is listed after these. */
export const SITEMAP_SECTIONS = [
  'Overview',
  'Services',
  'Industries',
  'Work',
  'Company',
  'Locations',
  'Plan a project',
  'Legal',
] as const;

/**
 * Every published page, from every registered source, once each. A source that fails
 * fails the whole list, so crawlers retry rather than read a sitemap with pages missing.
 */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const lists = await Promise.all(SITEMAP_SOURCES.map((source) => source()));
  const seen = new Set<string>();
  return lists.flat().filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

/** Entries grouped for the HTML sitemap, known sections first. */
export function sitemapSections(entries: readonly SitemapEntry[]): { name: string; entries: SitemapEntry[] }[] {
  const order: string[] = [...SITEMAP_SECTIONS];
  for (const entry of entries) if (!order.includes(entry.section)) order.push(entry.section);
  return order
    .map((name) => ({ name, entries: entries.filter((entry) => entry.section === name) }))
    .filter((section) => section.entries.length > 0);
}
