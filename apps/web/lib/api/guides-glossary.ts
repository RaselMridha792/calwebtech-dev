import 'server-only';
import {
  GLOSSARY_ROUTE,
  GUIDES_ROUTE,
  glossaryIndexViewSchema,
  glossaryTermPath,
  glossaryTermViewSchema,
  guideDetailViewSchema,
  guidePath,
  guidesIndexViewSchema,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import {
  glossaryIndexSnapshot,
  glossaryTermSnapshot,
  guideSnapshot,
  guidesIndexSnapshot,
} from '@/static-content/guides-glossary';
import { findView, getView } from './core';

/** The sitemap section the guides and glossary pages are grouped under. */
export const GUIDES_GLOSSARY_SITEMAP_SECTION = 'Resources';

/** `/guides/`: the index copy and every published guide. */
export const getGuidesIndex = cache(() => getView('/pages/guides', guidesIndexViewSchema, guidesIndexSnapshot));

/** `/guides/<slug>/`, or null when no such guide is published. */
export const getGuidePage = cache((slug: string) =>
  findView(`/pages/guides/${encodeURIComponent(slug)}`, guideDetailViewSchema, guideSnapshot(slug)),
);

/** `/glossary/`: the index copy and every published term, grouped A to Z. */
export const getGlossaryIndex = cache(() => getView('/pages/glossary', glossaryIndexViewSchema, glossaryIndexSnapshot));

/** `/glossary/<term>/`, or null when no such term is published. */
export const getGlossaryTerm = cache((slug: string) =>
  findView(`/pages/glossary/${encodeURIComponent(slug)}`, glossaryTermViewSchema, glossaryTermSnapshot(slug)),
);

export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const section = GUIDES_GLOSSARY_SITEMAP_SECTION;
  const [guides, glossary] = await Promise.all([getGuidesIndex(), getGlossaryIndex()]);
  const terms = glossary.groups.flatMap((group) => group.terms);
  return [
    { path: GUIDES_ROUTE, title: 'Guides', section },
    ...guides.guides.map((guide) => ({
      path: guidePath(guide.slug),
      title: guide.title,
      section,
      lastModified: guide.updatedAt,
    })),
    { path: GLOSSARY_ROUTE, title: 'Glossary', section, lastModified: glossary.updatedAt },
    ...terms.map((term) => ({ path: glossaryTermPath(term.slug), title: term.term, section })),
  ];
}
