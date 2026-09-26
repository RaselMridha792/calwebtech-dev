import { z } from 'zod';
import { linkSchema } from '../home-page';
import { decorativeImageSchema, imageSchema } from '../media';
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, slugSchema } from '../seo';
import { SITE_ROUTES } from '../site-paths';
import { answerBlockSchema, caseStudyCardSchema, pageSeoSchema, questionSchema, requiredText } from './common';

/**
 * The insights family (docs/10-site-pages.md): `/insights/`, `/insights/<category>/` and
 * `/insights/<slug>/`. Articles come from `Post` records, their topics from `PostCategory`
 * and their authors from `TeamMember`. The copy around them lives in the `insights.copy`
 * setting, validated by `insightsCopySchema`.
 *
 * `Post.body` is authored Markdown. Everything a page needs beyond the columns is read out
 * of that one field with the helpers below, so an editor writes an article in one place:
 *
 * - the key takeaways are a `## Key takeaways` list, lifted out of the body;
 * - the table of contents is the article's `##` and `###` headings, past
 *   `INSIGHTS_TOC_MIN_WORDS` words;
 * - the contextual service call to action and the related services are the service pages
 *   the article links to, in the order it links to them;
 * - the related case study is the first case study the article links to.
 */

/** Setting key of the family's copy. */
export const INSIGHTS_COPY_SETTING_KEY = 'insights.copy';

/** Article cards per page on `/insights/` and `/insights/<category>/`; more than this paginates. */
export const INSIGHTS_PAGE_SIZE = 12;

/** An article longer than this gets a table of contents (docs/03-page-specs.md). */
export const INSIGHTS_TOC_MIN_WORDS = 1200;

/** Reading speed behind "7 min read" when a record carries no reading time of its own. */
export const INSIGHTS_WORDS_PER_MINUTE = 220;

/** Related articles, related services and linked case studies shown on an article. */
export const INSIGHTS_RELATED_LIMIT = 3;

/** Where the inline subscribe block sits: the heading nearest this share of the article. */
export const INSIGHTS_SUBSCRIBE_SHARE = 0.6;

/** The heading whose list becomes the key takeaways block, and is never rendered as a section. */
export const INSIGHTS_TAKEAWAYS_HEADING = 'Key takeaways';

export const INSIGHTS_ROUTE = SITE_ROUTES.insights;

/** `/insights/<slug>/`: an article, or a topic. One slug space, so the two never collide. */
export const insightsArticlePath = (slug: string): string => `${INSIGHTS_ROUTE}${slug}/`;
export const insightsCategoryPath = (slug: string): string => `${INSIGHTS_ROUTE}${slug}/`;

/** The generated social image of an article or topic page. */
export const insightsOgImagePath = (slug: string): string => `${INSIGHTS_ROUTE}${slug}/opengraph-image/`;

/**
 * A listing URL: the index or a topic, with the page written into the query past the first.
 * `insightsListPath(null, 1)` is `/insights/`; `insightsListPath('strategy', 2)` is
 * `/insights/strategy/?page=2`.
 */
export function insightsListPath(category: string | null, page = 1): string {
  const base = category ? insightsCategoryPath(category) : INSIGHTS_ROUTE;
  return page > 1 ? `${base}?page=${String(page)}` : base;
}

/** The `page` query of a listing URL: 1 when absent, null when it is not a page number. */
export function readInsightsPage(searchParams: Record<string, string | string[] | undefined>): number | null {
  const raw = searchParams.page;
  if (raw === undefined) return 1;
  if (Array.isArray(raw)) return null;
  if (!/^[1-9][0-9]{0,3}$/.test(raw.trim())) return null;
  return Number.parseInt(raw.trim(), 10);
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageCount: number;
}

/**
 * One page of a list, or null when the page is past the end. An empty list has one page,
 * so an index with nothing published still renders its empty state.
 */
export function paginate<T>(items: readonly T[], page: number, size = INSIGHTS_PAGE_SIZE): Paginated<T> | null {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  if (page < 1 || page > pageCount) return null;
  return { items: items.slice((page - 1) * size, page * size), page, pageCount };
}

/* ------------------------------------------------------------------ Markdown helpers */

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const RAW_HTML = /<\/?[A-Za-z][^>]*>/;

interface MarkdownLine {
  text: string;
  /** Inside a fenced code block, where `##` is code rather than a heading. */
  fenced: boolean;
}

/** The lines of a document, each marked as code or prose, so scanners ignore fenced code. */
function readLines(markdown: string): MarkdownLine[] {
  let fence: string | null = null;
  return markdown.split(/\r?\n/).map((text) => {
    const marker = FENCE.exec(text)?.[1];
    if (fence === null && marker !== undefined) {
      fence = marker[0] ?? '`';
      return { text, fenced: true };
    }
    if (fence !== null && marker !== undefined && marker.startsWith(fence)) {
      fence = null;
      return { text, fenced: true };
    }
    return { text, fenced: fence !== null };
  });
}

/**
 * Inline Markdown as a reader sees it: link and image text without their URLs, emphasis,
 * code spans and escapes removed. Used for heading ids, the table of contents and the key
 * takeaways, so they read the same as the rendered article.
 */
export function plainInline(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(?<![\p{L}\p{N}])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\p{N}])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}])/gu, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A heading's anchor: lowercase, hyphenated, and unique within the article. */
export function headingId(text: string, used: Map<string, number> = new Map()): string {
  const base =
    plainInline(text)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '') || 'section';
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${String(seen + 1)}`;
}

export interface ArticleHeading {
  level: number;
  /** The heading as a reader sees it, without inline Markdown. */
  title: string;
  id: string;
}

/**
 * The article's own headings, in order, with the anchor each one gets. Headings inside
 * fenced code, block quotes and list items are left out: the renderer does not turn those
 * into headings either.
 */
export function articleOutline(markdown: string): ArticleHeading[] {
  const used = new Map<string, number>();
  return readLines(markdown).flatMap(({ text, fenced }) => {
    if (fenced) return [];
    const match = ATX.exec(text);
    if (!match) return [];
    const title = plainInline(match[2] ?? '');
    if (title === '') return [];
    return [{ level: (match[1] ?? '#').length, title, id: headingId(title, used) }];
  });
}

/** Words in a body of Markdown, counting the words a reader reads rather than the syntax. */
export function articleWordCount(markdown: string): number {
  const prose = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, '] ')
    .replace(/^ {0,3}\|?[\s|:-]+\|[\s|:-]*$/gm, ' ');
  return (prose.match(/[\p{L}\p{N}]+(?:[’'.,\-/][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** "7 min read" from a word count, never less than a minute. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / INSIGHTS_WORDS_PER_MINUTE));
}

export interface ArticleBodyParts {
  /** The body without its key takeaways section, as the article template renders it. */
  body: string;
  takeaways: string[];
}

/**
 * Lifts the `## Key takeaways` list out of an authored body. The block is rendered on its
 * own, above the article, so it is not left in the body as a section heading that is not a
 * question. A body without the section keeps every line and returns no takeaways.
 */
export function splitKeyTakeaways(markdown: string): ArticleBodyParts {
  const lines = readLines(markdown);
  const start = lines.findIndex(({ text, fenced }) => {
    if (fenced) return false;
    const match = ATX.exec(text);
    return (
      match !== null &&
      (match[1] ?? '').length === 2 &&
      plainInline(match[2] ?? '').toLowerCase() === INSIGHTS_TAKEAWAYS_HEADING.toLowerCase()
    );
  });
  if (start === -1) return { body: markdown.trim(), takeaways: [] };

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.fenced) continue;
    const match = ATX.exec(line.text);
    if (match && (match[1] ?? '').length <= 2) {
      end = index;
      break;
    }
  }

  const takeaways: string[] = [];
  for (const { text, fenced } of lines.slice(start + 1, end)) {
    if (fenced) continue;
    const item = LIST_ITEM.exec(text);
    if (item) {
      takeaways.push(plainInline(item[1] ?? ''));
    } else if (text.trim() !== '' && takeaways.length > 0) {
      // A wrapped list item continues the one before it.
      takeaways[takeaways.length - 1] = `${takeaways[takeaways.length - 1] ?? ''} ${plainInline(text)}`.trim();
    }
  }

  const body = [...lines.slice(0, start), ...lines.slice(end)]
    .map((line) => line.text)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { body, takeaways: takeaways.filter((item) => item !== '') };
}

/**
 * Site paths of a kind the article links to, in the order it links to them, each once:
 * `/services/<slug>/` for the services it covers, `/work/<slug>/` for the case study.
 */
export function articleLinkedSlugs(markdown: string, prefix: '/services/' | '/work/'): string[] {
  const pattern = new RegExp(`\\]\\(${prefix}([a-z0-9]+(?:-[a-z0-9]+)*)/(?:[#?][^)\\s]*)?\\)`, 'g');
  return [...new Set([...markdown.matchAll(pattern)].map((match) => match[1] ?? ''))].filter(
    (slug) => slug !== '',
  );
}

/**
 * What stops an authored body from being published, in the words an editor needs. The
 * article template owns the H1, so a body carries `##` and `###` headings only, each
 * written as a question a buyer types (CLAUDE.md, SEO rules).
 */
export function articleBodyProblems(markdown: string): string[] {
  const problems: string[] = [];
  const lines = readLines(markdown);
  let previous = '';
  let seenLevel = 0;

  for (const { text, fenced } of lines) {
    if (fenced) {
      previous = text;
      continue;
    }
    if (SETEXT.test(text) && previous.trim() !== '' && !LIST_ITEM.test(previous)) {
      problems.push('Write headings as "## Question?", not with a line of = or - under them.');
    }
    if (RAW_HTML.test(text)) {
      problems.push(`HTML is not rendered in an article body: "${text.trim().slice(0, 60)}"`);
    }
    const match = ATX.exec(text);
    previous = text;
    if (!match) continue;

    const level = (match[1] ?? '#').length;
    const title = plainInline(match[2] ?? '');
    if (level === 1) {
      problems.push(`"${title}" is an H1. The article title is the page's only H1, so start at "##".`);
      continue;
    }
    if (level > 3) {
      problems.push(`"${title}" is deeper than H3. Articles use "##" and "###" only.`);
      continue;
    }
    if (seenLevel === 0 && level === 3) {
      problems.push(`"${title}" is an H3 before any H2. Open the article with an "##" heading.`);
    }
    if (title.toLowerCase() === INSIGHTS_TAKEAWAYS_HEADING.toLowerCase()) {
      problems.push('The key takeaways are rendered above the article, so they are not part of the body.');
    } else if (!title.endsWith('?')) {
      problems.push(`"${title}" is not a question. Section headings are the questions buyers type.`);
    }
    seenLevel = level;
  }
  return problems;
}

/* ------------------------------------------------------------------ View schemas */

const isoDateTime = z.iso.datetime();

/** A topic as it is named next to an article and in the topic filter. */
export const insightsCategoryRefSchema = z.object({ slug: slugSchema, name: requiredText(60) });
export type InsightsCategoryRef = z.output<typeof insightsCategoryRefSchema>;

/** The author block: a Calwebtech team member, with their photograph and what qualifies them. */
export const insightsAuthorSchema = z.object({
  slug: slugSchema,
  name: requiredText(120),
  role: requiredText(120),
  bio: requiredText(600).nullable(),
  photo: imageSchema.nullable(),
  credentials: z.array(requiredText(160)).max(6).default([]),
});
export type InsightsAuthor = z.output<typeof insightsAuthorSchema>;

/** An article as it appears in a listing, on a related strip, or as the featured card. */
export const insightsArticleCardSchema = z.object({
  slug: slugSchema,
  title: requiredText(160),
  excerpt: requiredText(400),
  category: insightsCategoryRefSchema.nullable(),
  authorName: requiredText(120).nullable(),
  readingTime: z.number().int().positive(),
  publishedAt: isoDateTime,
  /** The last change, for the sitemap's last-modified date. */
  updatedAt: isoDateTime,
  image: imageSchema.nullable(),
  featured: z.boolean(),
});
export type InsightsArticleCard = z.output<typeof insightsArticleCardSchema>;

/** A service the article links to: the contextual call to action, then the related ones. */
export const insightsServiceLinkSchema = z.object({
  slug: slugSchema,
  title: requiredText(120),
  summary: requiredText(400),
});
export type InsightsServiceLink = z.output<typeof insightsServiceLinkSchema>;

/** The article body, authored as Markdown and rendered on the server. */
export const insightsBodySchema = z
  .string()
  .trim()
  .min(200)
  .max(80_000)
  .superRefine((value, ctx) => {
    for (const message of articleBodyProblems(value)) {
      ctx.addIssue({ code: 'custom', message });
    }
  });

/* ------------------------------------------------------------------ Copy */

const successSchema = z.object({ heading: requiredText(120), body: requiredText(400) });

/** The inline subscribe block. It stores a RESOURCE lead with the page it was filled on. */
export const insightsNewsletterCopySchema = z.object({
  heading: requiredText(120),
  body: requiredText(400),
  emailLabel: requiredText(40),
  submitLabel: requiredText(40),
  privacyNote: requiredText(300),
  /** Shown in place of the form. No email is sent: a subscriber gets none (decision 53). */
  success: successSchema,
  /** Shown when the API is not reachable, so the block never pretends to have sent. */
  unavailable: requiredText(300),
});
export type InsightsNewsletterCopy = z.output<typeof insightsNewsletterCopySchema>;

export const insightsArticleCopySchema = z.object({
  byLabel: requiredText(20),
  publishedLabel: requiredText(20),
  updatedLabel: requiredText(20),
  readingTimeLabel: requiredText(20),
  tocLabel: requiredText(60),
  takeawaysLabel: requiredText(60),
  authorLabel: requiredText(60),
  serviceCta: z.object({
    eyebrow: requiredText(60),
    body: requiredText(300),
    linkLabel: requiredText(60),
    contactCta: linkSchema,
  }),
  servicesHeading: questionSchema(160),
  caseStudyLinkLabel: requiredText(60),
  relatedHeading: questionSchema(160),
  relatedLink: linkSchema,
  newsletter: insightsNewsletterCopySchema,
});
export type InsightsArticleCopy = z.output<typeof insightsArticleCopySchema>;

export const insightsIndexCopySchema = z.object({
  seo: pageSeoSchema,
  eyebrow: requiredText(60).nullable().default(null),
  title: requiredText(120),
  intro: requiredText(500).nullable().default(null),
  backdrop: decorativeImageSchema.nullable().default(null),
  featuredLabel: requiredText(40),
  listHeading: questionSchema(160),
  topicsLabel: requiredText(60),
  allTopicsLabel: requiredText(40),
  readingTimeLabel: requiredText(20),
  cardLinkLabel: requiredText(60),
  empty: requiredText(300),
  emptyAction: linkSchema.nullable().default(null),
  pagination: z.object({
    label: requiredText(40),
    previous: requiredText(40),
    next: requiredText(40),
    /** "Page {page} of {pages}", with both placeholders. */
    status: requiredText(60),
  }),
});
export type InsightsIndexCopy = z.output<typeof insightsIndexCopySchema>;

/** A topic page's own copy. Topics without an entry fall back to `categoryFallback`. */
export const insightsCategoryCopySchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(120),
  intro: requiredText(500).nullable().default(null),
  listHeading: questionSchema(160),
});
export type InsightsCategoryCopy = z.output<typeof insightsCategoryCopySchema>;

/**
 * Copy for a topic nobody has written page copy for yet, so a new `PostCategory` has a
 * complete page the moment an article is published in it. `{topic}` becomes its name.
 */
export const insightsCategoryFallbackSchema = z.object({
  seoTitle: requiredText(60),
  seoDescription: requiredText(155),
  title: requiredText(120),
  intro: requiredText(500).nullable().default(null),
  listHeading: questionSchema(160),
});

export const insightsCopySchema = z.object({
  index: insightsIndexCopySchema,
  article: insightsArticleCopySchema,
  categoryFallback: insightsCategoryFallbackSchema,
  /** Page copy per topic slug. */
  categories: z.record(slugSchema, insightsCategoryCopySchema).default({}),
});
export type InsightsCopy = z.output<typeof insightsCopySchema>;
export type InsightsCopyInput = z.input<typeof insightsCopySchema>;

/**
 * Cuts filled text to a field's own limit, on a word boundary where there is one. A topic
 * name is up to 60 characters and an editor may write the template up to its own limit, so
 * the sum overflows long before either half is unreasonable.
 */
function clampFilled(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trim();
}

/** The same cut for a heading, keeping the question mark that makes it a question. */
function clampQuestion(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max && trimmed.endsWith('?')) return trimmed;
  return `${clampFilled(trimmed.replace(/[?\s]+$/u, ''), max - 1)}?`;
}

/**
 * Fills `{topic}` in the fallback copy of a topic that has no page copy of its own.
 *
 * Total by construction: every field is cut to its own limit and the result is checked
 * rather than asserted, because this runs inside the index mapper. A topic whose name or
 * whose editor-written template makes the copy invalid must still get a page, not turn
 * `/insights/`, every topic page and every article page into a 500 at once.
 */
export function insightsCategoryCopyFor(copy: InsightsCopy, category: InsightsCategoryRef): InsightsCategoryCopy {
  const own = Object.hasOwn(copy.categories, category.slug) ? copy.categories[category.slug] : undefined;
  if (own) return own;
  const fallback = copy.categoryFallback;
  const fill = (value: string) => value.replaceAll('{topic}', category.name);
  const filled = insightsCategoryCopySchema.safeParse({
    seo: {
      title: clampFilled(fill(fallback.seoTitle), SEO_TITLE_MAX),
      description: clampFilled(fill(fallback.seoDescription), SEO_DESCRIPTION_MAX),
      ogImage: null,
    },
    title: clampFilled(fill(fallback.title), 120),
    intro: fallback.intro === null ? null : clampFilled(fill(fallback.intro), 500),
    listHeading: clampQuestion(fill(fallback.listHeading), 160),
  });
  if (filled.success) return filled.data;

  // Last resort: the topic's own name and copy that is already validated, so the page is
  // plain rather than missing. `copy.index` came through `insightsCopySchema`.
  const safe = insightsCategoryCopySchema.safeParse({
    seo: { title: clampFilled(category.name, SEO_TITLE_MAX), description: copy.index.seo.description, ogImage: null },
    title: clampFilled(category.name, 120),
    intro: null,
    listHeading: copy.index.listHeading,
  });
  if (safe.success) return safe.data;
  return { seo: copy.index.seo, title: copy.index.title, intro: null, listHeading: copy.index.listHeading };
}

/* ------------------------------------------------------------------ Views */

/** A topic on the index: how many articles it holds, and the copy of its own page. */
export const insightsCategoryViewSchema = insightsCategoryRefSchema.extend({
  articleCount: z.number().int().nonnegative(),
  copy: insightsCategoryCopySchema,
});
export type InsightsCategoryView = z.output<typeof insightsCategoryViewSchema>;

/**
 * What `GET /pages/insights` returns: every published article as a card, every topic, and
 * the page copy. Filtering by topic and pagination happen on the page, from the URL.
 */
export const insightsIndexViewSchema = z
  .object({
    copy: insightsIndexCopySchema,
    categories: z.array(insightsCategoryViewSchema),
    /** Newest first. */
    articles: z.array(insightsArticleCardSchema),
    /** The article shown above the list on the first page of the unfiltered index. */
    featuredSlug: slugSchema.nullable().default(null),
  })
  .superRefine((view, ctx) => {
    const slugs = new Set(view.articles.map((article) => article.slug));
    if (view.featuredSlug !== null && !slugs.has(view.featuredSlug)) {
      ctx.addIssue({ code: 'custom', message: `The featured article "${view.featuredSlug}" is not in the list.` });
    }
    const topics = new Set(view.categories.map((category) => category.slug));
    for (const article of view.articles) {
      if (article.category && !topics.has(article.category.slug)) {
        ctx.addIssue({ code: 'custom', message: `"${article.slug}" is in a topic the index does not list.` });
      }
    }
  });
export type InsightsIndexView = z.output<typeof insightsIndexViewSchema>;

/** What `GET /pages/insights/<slug>` returns for a published article. */
export const insightsArticleViewSchema = z
  .object({
    slug: slugSchema,
    title: requiredText(160),
    excerpt: requiredText(400),
    answerBlock: answerBlockSchema,
    seo: pageSeoSchema,
    category: insightsCategoryRefSchema.nullable(),
    author: insightsAuthorSchema.nullable(),
    publishedAt: isoDateTime,
    /** The last substantive change; equal to `publishedAt` when nothing has changed since. */
    updatedAt: isoDateTime,
    readingTime: z.number().int().positive(),
    wordCount: z.number().int().positive(),
    cover: imageSchema.nullable(),
    takeaways: z.array(requiredText(300)).max(8).default([]),
    body: insightsBodySchema,
    /** The services the article links to; the first one is the contextual call to action. */
    services: z.array(insightsServiceLinkSchema).max(INSIGHTS_RELATED_LIMIT).default([]),
    caseStudy: caseStudyCardSchema.nullable().default(null),
    relatedArticles: z.array(insightsArticleCardSchema).max(INSIGHTS_RELATED_LIMIT).default([]),
    copy: insightsArticleCopySchema,
  })
  .superRefine((view, ctx) => {
    if (view.relatedArticles.some((article) => article.slug === view.slug)) {
      ctx.addIssue({ code: 'custom', message: 'An article cannot be related to itself.' });
    }
    if (view.wordCount !== articleWordCount(view.body)) {
      ctx.addIssue({ code: 'custom', message: 'wordCount does not match the body.' });
    }
  });
export type InsightsArticleView = z.output<typeof insightsArticleViewSchema>;

/** The table of contents of an article, empty until it is long enough to need one. */
export function articleToc(view: Pick<InsightsArticleView, 'body' | 'wordCount'>): ArticleHeading[] {
  if (view.wordCount <= INSIGHTS_TOC_MIN_WORDS) return [];
  return articleOutline(view.body);
}
