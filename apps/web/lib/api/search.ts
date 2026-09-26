import 'server-only';
import {
  SITE_ROUTES,
  caseStudyPath,
  glossaryIndexViewSchema,
  glossaryTermPath,
  industryDetailViewSchema,
  industryPath,
  insightsArticlePath,
  insightsIndexViewSchema,
  searchResults,
  searchResultsSchema,
  searchTerms,
  serviceDetailViewSchema,
  servicePath,
  servicesIndexViewSchema,
  staticFaqViewSchema,
  workIndexViewSchema,
  type SearchQuery,
  type SearchResult,
  type SearchResults,
} from '@calwebtech/shared';
import { cache } from 'react';
import { glossaryIndexSnapshot } from '@/static-content/guides-glossary';
import { industrySnapshots } from '@/static-content/industries';
import { insightsIndexSnapshot } from '@/static-content/insights';
import { serviceSnapshots, servicesIndexSnapshot } from '@/static-content/services';
import { staticFaqSnapshot } from '@/static-content/static';
import { workIndexSnapshot } from '@/static-content/work';
import { apiUrl, usesSnapshots } from './core';

/**
 * Site search (docs/08-decisions.md, 62). With the API serving content it is the API's Postgres
 * search. While pages render from the committed snapshots, the database does not hold what the
 * visitor reads — the articles and the glossary above all — so the search runs over the same
 * snapshots instead, and answers in the same shape.
 */
export const searchSite = cache(async (query: SearchQuery): Promise<SearchResults> => {
  if (usesSnapshots()) return searchSnapshots(query);
  const params = new URLSearchParams({ q: query.q, ...(query.type ? { type: query.type } : {}) });
  const response = await fetch(apiUrl(`/search?${params.toString()}`), { cache: 'no-store' });
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for a search`);
  return searchResultsSchema.parse(await response.json());
});

interface Document extends SearchResult {
  /** Lower-cased, accents removed, for matching. */
  titleText: string;
  bodyText: string;
}

function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

function line(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.–-]+$/u, '')}…`;
}

function doc(type: SearchResult['type'], title: string, summary: string, href: string, extra = ''): Document {
  return {
    type,
    title,
    summary: line(summary),
    href,
    titleText: plain(title),
    bodyText: plain(`${summary} ${extra}`),
  };
}

/** Everything the snapshots publish, as search documents. Read once per process. */
let documents: Document[] | null = null;

function snapshotDocuments(): Document[] {
  if (documents) return documents;
  const found: Document[] = [];

  const services = servicesIndexViewSchema.parse(servicesIndexSnapshot).groups.flatMap((group) => group.services);
  for (const card of services) {
    const page = serviceDetailViewSchema.safeParse(serviceSnapshots[card.slug]);
    found.push(doc('service', card.title, card.summary, servicePath(card.slug), page.success ? page.data.answerBlock : ''));
    for (const item of page.success ? (page.data.faq?.items ?? []) : []) {
      found.push(doc('faq', item.question, item.answer, servicePath(card.slug)));
    }
  }

  for (const [slug, snapshot] of Object.entries(industrySnapshots)) {
    const page = industryDetailViewSchema.safeParse(snapshot);
    for (const item of page.success ? (page.data.faq?.items ?? []) : []) {
      found.push(doc('faq', item.question, item.answer, industryPath(slug)));
    }
  }

  for (const study of workIndexViewSchema.parse(workIndexSnapshot).caseStudies) {
    found.push(doc('case-study', study.clientName, study.summary, caseStudyPath(study.slug), study.tags.join(' ')));
  }

  for (const article of insightsIndexViewSchema.parse(insightsIndexSnapshot).articles) {
    found.push(doc('insight', article.title, article.excerpt, insightsArticlePath(article.slug)));
  }

  for (const term of glossaryIndexViewSchema.parse(glossaryIndexSnapshot).groups.flatMap((group) => group.terms)) {
    found.push(doc('glossary', term.term, term.definition, glossaryTermPath(term.slug)));
  }

  for (const item of staticFaqViewSchema.parse(staticFaqSnapshot).groups.flatMap((group) => group.items)) {
    found.push(doc('faq', item.question, item.answer, SITE_ROUTES.faq));
  }

  documents = found;
  return found;
}

/**
 * Every word of the query must appear; a word in the title counts three times one in the text,
 * and a title that begins with the query comes first — close to Postgres ranking titles first.
 */
export function searchSnapshots(query: SearchQuery, source: readonly Document[] = snapshotDocuments()): SearchResults {
  const terms = searchTerms(query.q);
  const phrase = plain(query.q.trim());
  const scored = source.flatMap((entry) => {
    let score = 0;
    for (const term of terms) {
      if (entry.titleText.includes(term)) score += 3;
      else if (entry.bodyText.includes(term)) score += 1;
      else return [];
    }
    if (terms.length === 0) return [];
    if (entry.titleText.startsWith(phrase)) score += 2;
    return [{ entry, score }];
  });
  scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'en'));
  const matches = scored.map(({ entry }) => ({
    type: entry.type,
    title: entry.title,
    summary: entry.summary,
    href: entry.href,
  }));
  return searchResults(query.q, query.type ?? null, matches);
}
