import type { Prisma } from '@calwebtech/db';
import {
  GLOSSARY_BODY_LIMIT,
  GLOSSARY_PARAGRAPH_MAX,
  GLOSSARY_RELATED_LIMIT,
  GUIDE_BLOCK_LIMIT,
  GUIDE_BULLET_MAX,
  GUIDE_PARAGRAPH_MAX,
  GUIDE_RELATED_LIMIT,
  GUIDE_SECTION_LIMIT,
  glossaryAnswer,
  glossaryGroups,
  glossaryIndexContentSchema,
  glossaryIndexViewSchema,
  glossaryLetter,
  glossaryTermViewSchema,
  guideDetailViewSchema,
  guideSummarySections,
  guidesIndexContentSchema,
  guidesIndexViewSchema,
  seoSchema,
  splitParagraphs,
  splitSentences,
  answerBlockSchema,
  type GlossaryIndexView,
  type GlossaryTermCard,
  type GlossaryTermView,
  type GuideCard,
  type GuideDetailView,
  type GuideSection,
  type GuidesIndexView,
} from '@calwebtech/shared';

/**
 * Records to views for `/guides/`, `/guides/<slug>/`, `/glossary/` and `/glossary/<term>/`.
 *
 * `Guide` and `GlossaryTerm` carry no page-copy column, so the sections a record cannot
 * supply are left out and the template's own headings fill the rest: a guide published from
 * the dashboard still renders a complete page with no deploy. The publish-ready copy of the
 * launch pages lives in apps/web/static-content/guides-glossary.
 *
 * The columns are unbounded text, so every field a record supplies is clipped and every list
 * is capped to what the contract accepts before it is parsed. A long entry loses its tail,
 * never its page.
 */

/** The columns a guide card needs: the index, related guides and the sitemap. */
export const guideCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  pageCount: true,
  coverImage: true,
} satisfies Prisma.GuideSelect;
export type GuideCardRecord = Prisma.GuideGetPayload<{ select: typeof guideCardSelect }>;

export const guideDetailSelect = {
  ...guideCardSelect,
  fileUrl: true,
  seo: true,
} satisfies Prisma.GuideSelect;
export type GuideDetailRecord = Prisma.GuideGetPayload<{ select: typeof guideDetailSelect }>;

/** The columns a glossary card needs. */
export const glossaryCardSelect = {
  id: true,
  slug: true,
  term: true,
  shortDefinition: true,
  relatedServiceId: true,
  updatedAt: true,
} satisfies Prisma.GlossaryTermSelect;
export type GlossaryCardRecord = Prisma.GlossaryTermGetPayload<{ select: typeof glossaryCardSelect }>;

export const glossaryDetailInclude = {
  relatedService: { select: { slug: true, title: true, shortDescription: true, status: true, publishedAt: true, deletedAt: true } },
} satisfies Prisma.GlossaryTermInclude;
export type GlossaryDetailRecord = Prisma.GlossaryTermGetPayload<{ include: typeof glossaryDetailInclude }>;

/** A published service, for the delivering-service link. */
export interface ServiceLink {
  slug: string;
  title: string;
  shortDescription: string;
}

export interface GuidesIndexSources {
  contentSetting: unknown;
  guides: readonly GuideCardRecord[];
}

export interface GuideDetailSources {
  guide: GuideDetailRecord;
  /** Other published guides, in display order. */
  others: readonly GuideCardRecord[];
  /** Published glossary terms, so the guide can link the ones it names. */
  terms: readonly GlossaryCardRecord[];
  /** Published services, so the guide can link the one it is about. */
  services: readonly ServiceLink[];
}

export interface GlossaryIndexSources {
  contentSetting: unknown;
  terms: readonly GlossaryCardRecord[];
}

export interface GlossaryTermSources {
  term: GlossaryDetailRecord;
  /** Other published terms, for the related list. */
  others: readonly GlossaryCardRecord[];
}

/** Whitespace collapsed, and at most `max` characters, cut at a word where possible. */
export function clip(text: string, max: number): string {
  const flat = text.trim().replace(/\s+/g, ' ');
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** "32 pages", or nothing when the record does not say how long the guide is. */
function pageCountLabel(pageCount: number | null): string | null {
  return pageCount !== null && pageCount > 0 ? `${String(pageCount)} pages` : null;
}

/** The first line of a guide's summary, as the card's one-line description. */
export function guideCard(guide: GuideCardRecord): GuideCard {
  const [first] = splitParagraphs(guide.summary);
  return {
    slug: guide.slug,
    title: clip(guide.title, 140),
    summary: clip(first ?? guide.title, 300),
    pageCountLabel: pageCountLabel(guide.pageCount),
    cover: present(guide.coverImage) ? { src: guide.coverImage, alt: guide.title } : null,
    topics: [],
    updatedAt: null,
  };
}

function termCard(term: GlossaryCardRecord): GlossaryTermCard {
  return { slug: term.slug, term: clip(term.term, 80), definition: clip(term.shortDefinition, 240) };
}

/**
 * The opening of a guide's summary as its answer block: two or three complete sentences,
 * or nothing when the summary does not start with any.
 */
export function guideAnswer(sections: readonly GuideSection[]): string | null {
  const sentences = splitSentences(sections[0]?.paragraphs[0] ?? '');
  for (const take of [3, 2]) {
    const text = sentences.slice(0, take).join(' ');
    if (answerBlockSchema.safeParse(text).success) return text;
  }
  return null;
}

/** Whether `needle` appears in `haystack` as a whole word, ignoring case. */
export function mentions(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (trimmed.length === 0) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, 'iu').test(haystack);
}

/** Where in `text` a term is first named, or null when it is not named at all. */
function firstMention(text: string, needle: string): number | null {
  if (!mentions(text, needle)) return null;
  return text.toLowerCase().indexOf(needle.trim().toLowerCase());
}

/**
 * `/guides/`: the `guides.index` copy and every published guide. With none published the
 * list is empty and the page renders its empty state.
 */
export function toGuidesIndexView({ contentSetting, guides }: GuidesIndexSources): GuidesIndexView {
  return guidesIndexViewSchema.parse({
    content: guidesIndexContentSchema.parse(contentSetting),
    guides: guides.map(guideCard),
  });
}

/**
 * One guide page. The summary is built from the `summary` column's structure and is always
 * rendered; the gate only stands in front of `fileUrl`. The guide links the glossary terms
 * and the service it names, so a published guide is never an orphan.
 */
export function toGuideDetailView({ guide, others, terms, services }: GuideDetailSources): GuideDetailView {
  const seo = seoSchema.nullable().parse(guide.seo);
  const sections = guideSummarySections(guide.summary)
    .slice(0, GUIDE_SECTION_LIMIT)
    .map((section) => ({
      ...section,
      paragraphs: section.paragraphs.slice(0, GUIDE_BLOCK_LIMIT).map((paragraph) => clip(paragraph, GUIDE_PARAGRAPH_MAX)),
      bullets: section.bullets.slice(0, GUIDE_BLOCK_LIMIT).map((bullet) => clip(bullet, GUIDE_BULLET_MAX)),
    }));
  // A summary with no blocks at all still has to make one section, or the contract rejects it.
  const opening = clip(guide.summary, GUIDE_PARAGRAPH_MAX);
  if (sections.length === 0 && opening.length > 0) {
    sections.push({ id: 'section-1', heading: null, paragraphs: [opening], bullets: [] });
  }
  const named = terms
    .map((term) => ({ term, at: firstMention(guide.summary, term.term) }))
    .filter((entry): entry is { term: GlossaryCardRecord; at: number } => entry.at !== null)
    .sort((a, b) => a.at - b.at)
    .slice(0, GLOSSARY_RELATED_LIMIT)
    .map((entry) => termCard(entry.term));
  const service = services
    .map((item) => ({ item, at: firstMention(guide.summary, item.title) }))
    .filter((entry): entry is { item: ServiceLink; at: number } => entry.at !== null)
    .sort((a, b) => a.at - b.at)[0]?.item;
  const relatedGuides = others.filter((other) => other.id !== guide.id).slice(0, GUIDE_RELATED_LIMIT);

  return guideDetailViewSchema.parse({
    slug: guide.slug,
    title: clip(guide.title, 140),
    updatedAt: null,
    seo: {
      title: seo?.title ?? clip(guide.title, 60),
      description: seo?.description ?? clip(splitParagraphs(guide.summary)[0] ?? guide.title, 155),
      ogImage: seo?.ogImage ?? guide.coverImage ?? null,
    },
    answerBlock: guideAnswer(sections),
    hero: {
      intro: null,
      pageCountLabel: pageCountLabel(guide.pageCount),
      formatLabel: 'PDF',
      ctaLabel: 'Get the guide',
      cover: present(guide.coverImage) ? { src: guide.coverImage, alt: guide.title } : null,
    },
    summary: { heading: 'What does this guide cover?', intro: null, sections },
    takeaways: null,
    gate: {
      heading: 'How do I get the full guide?',
      intro: 'Tell us where to send it and the download opens on this page.',
      submitLabel: 'Send me the guide',
      footnote: null,
      fileUrl: guide.fileUrl,
      fileLabel: pageCountLabel(guide.pageCount) === null ? 'PDF' : `PDF, ${String(guide.pageCount)} pages`,
      success: {
        heading: 'Your guide is ready.',
        body: 'The download link is below. We have your request on file and nobody will chase you about it.',
        downloadLabel: 'Download the guide',
      },
    },
    faq: null,
    service: service
      ? {
          heading: 'Who does this work?',
          intro: null,
          item: { slug: service.slug, title: clip(service.title, 120), line: clip(service.shortDescription, 300) },
        }
      : null,
    related:
      relatedGuides.length > 0 || named.length > 0
        ? { heading: 'What else should I read?', guides: relatedGuides.map(guideCard), terms: named }
        : null,
    sources: null,
  });
}

/** `/glossary/`: the `glossary.index` copy and every published term, grouped A to Z. */
export function toGlossaryIndexView({ contentSetting, terms }: GlossaryIndexSources): GlossaryIndexView {
  const updatedAt = terms
    .map((term) => term.updatedAt.toISOString())
    .sort()
    .at(-1);
  return glossaryIndexViewSchema.parse({
    content: glossaryIndexContentSchema.parse(contentSetting),
    groups: glossaryGroups(terms.map(termCard)),
    updatedAt: updatedAt ?? null,
  });
}

/**
 * One glossary term. Related terms are the other published terms delivered by the same
 * service, which is the relation the record actually carries. A term whose delivering
 * service is unpublished links to no service rather than to a page that 404s.
 */
export function toGlossaryTermView({ term, others }: GlossaryTermSources): GlossaryTermView {
  const seo = seoSchema.nullable().parse(term.seo);
  const service = term.relatedService;
  const published =
    service !== null &&
    service.deletedAt === null &&
    (service.status === 'PUBLISHED' || (service.status === 'SCHEDULED' && service.publishedAt !== null && service.publishedAt <= new Date()));
  const related = others
    .filter((other) => other.id !== term.id && other.relatedServiceId !== null && other.relatedServiceId === term.relatedServiceId)
    .slice(0, GLOSSARY_RELATED_LIMIT)
    .map(termCard);
  // A record's body is required, but an all-whitespace one would leave nothing to render.
  const paragraphs = splitParagraphs(term.body)
    .slice(0, GLOSSARY_BODY_LIMIT)
    .map((paragraph) => clip(paragraph, GLOSSARY_PARAGRAPH_MAX));

  return glossaryTermViewSchema.parse({
    slug: term.slug,
    term: clip(term.term, 80),
    letter: glossaryLetter(term.term),
    updatedAt: term.updatedAt.toISOString(),
    seo: {
      title: seo?.title ?? clip(term.term, 60),
      description: seo?.description ?? clip(term.shortDefinition, 155),
      ogImage: seo?.ogImage ?? null,
    },
    definition: clip(term.shortDefinition, 240),
    answerBlock: glossaryAnswer(term.shortDefinition, term.body),
    body: {
      heading: `What does ${clip(term.term, 60)} mean?`,
      paragraphs: paragraphs.length > 0 ? paragraphs : [clip(term.shortDefinition, 240)],
    },
    commercial: null,
    example: present(term.example)
      ? { heading: 'What does it look like in practice?', body: clip(term.example, GLOSSARY_PARAGRAPH_MAX), caseStudy: null }
      : null,
    service: published
      ? { slug: service.slug, title: clip(service.title, 120), line: clip(service.shortDescription, 300) }
      : null,
    related: related.length > 0 ? { heading: 'Which terms are related?', terms: related } : null,
    sources: [],
  });
}
