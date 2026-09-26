import { z } from 'zod';
import { beforeAfterViewSchema, testimonialViewSchema, type BeforeAfterView } from '../landing-page';
import { decorativeImageSchema, imageSchema, mediaSrcSchema } from '../media';
import { slugSchema } from '../seo';
import { siteLinkSchema } from '../site-chrome';
import { SITE_ROUTES, WORK_FILTER_PARAMS, workFilterPath, type WorkFilterParam } from '../site-paths';
import { answerBlockSchema, caseStudyCardSchema, metricSchema, pageSeoSchema, questionSchema, requiredText } from './common';

/**
 * The work family (docs/10-site-pages.md): `/work/` with URL filters, `/work/<slug>/` and
 * `/before-and-after/`. Proof comes from `Project` records, and the comparisons on
 * `/before-and-after/` from `Comparison` records (decision 70); the copy around it lives in
 * the `work.copy` setting, validated by `workCopySchema`.
 */

/** Setting key of the family's copy. */
export const WORK_COPY_SETTING_KEY = 'work.copy';

/** Case study cards per page on `/work/`; more than this paginates. */
export const WORK_PAGE_SIZE = 12;

/** A case study page needs at least three outcome figures (docs/06, Task 2.2), and shows at most six. */
export const WORK_MIN_METRICS = 3;
export const WORK_MAX_METRICS = 6;

/** Stands for the client's name in heading templates, e.g. "What did we build for {client}?". */
export const WORK_CLIENT_TOKEN = '{client}';

/** Fills a heading template with the client's name. */
export function workHeading(template: string, clientName: string): string {
  return template.replaceAll(WORK_CLIENT_TOKEN, clientName);
}

// ---------------------------------------------------------------- filters

export type WorkFilters = Partial<Record<WorkFilterParam, string>>;

/** A value a case study can be filtered by: an industry, a service or a platform. */
export const workTermSchema = z.object({ slug: slugSchema, name: requiredText(120) });
export type WorkTerm = z.output<typeof workTermSchema>;

const workFiltersSchema = z
  .object({ industry: slugSchema.optional(), service: slugSchema.optional(), platform: slugSchema.optional() })
  .refine((filters) => WORK_FILTER_PARAMS.some((key) => filters[key] !== undefined), 'Name at least one filter');

/**
 * A filter combination worth its own place in search, such as every Shopify project
 * (docs/04-seo-keyword-map.md, "Filtered views canonicalise to the unfiltered parent unless
 * the combination is a deliberate target"). Only these canonicalise to themselves.
 */
export const workFilterTargetSchema = z.object({
  filters: workFiltersSchema,
  seo: pageSeoSchema,
  /** The H1 on this filtered view. */
  title: requiredText(90),
  intro: requiredText(400),
});
export type WorkFilterTarget = z.output<typeof workFilterTargetSchema>;

// ---------------------------------------------------------------- copy (the work.copy setting)

const workIndexCopySchema = z.object({
  seo: pageSeoSchema,
  eyebrow: requiredText(40),
  /** The H1 of `/work/`. */
  title: requiredText(90),
  intro: requiredText(400),
  backdrop: decorativeImageSchema.nullable().default(null),
  primaryCta: siteLinkSchema.nullable().default(null),
  /** Over the headline results beside the hero. */
  highlightsLabel: requiredText(80),
  summaryLabels: z.object({
    caseStudies: requiredText(40),
    industries: requiredText(40),
    services: requiredText(40),
    platforms: requiredText(40),
  }),
  filters: z.object({
    label: requiredText(60),
    industry: requiredText(40),
    service: requiredText(40),
    platform: requiredText(40),
    all: requiredText(40),
    clear: requiredText(40),
  }),
  resultsHeading: questionSchema(140),
  /** Shown while no case study is published. */
  empty: requiredText(300),
  /** Shown when a filter combination matches no case study. */
  noMatches: requiredText(300),
  caseStudyLabel: requiredText(40),
  proofHeading: questionSchema(140),
  proofIntro: requiredText(400).nullable().default(null),
  /** Beside the average rating, e.g. "Average rating across verified reviews". */
  ratingLabel: requiredText(80),
  targets: z.array(workFilterTargetSchema).max(24).default([]),
});

const questionTemplate = questionSchema(140);

const workCaseStudyCopySchema = z.object({
  eyebrow: requiredText(40),
  headlineLabel: requiredText(60),
  headings: z.object({
    metrics: questionTemplate,
    atAGlance: questionTemplate,
    challenge: questionTemplate,
    approach: questionTemplate,
    build: questionTemplate,
    gallery: questionTemplate,
    beforeAfter: questionTemplate,
    outcome: questionTemplate,
    quote: questionTemplate,
    relatedServices: questionTemplate,
    relatedCaseStudies: questionTemplate,
  }),
  labels: z.object({
    industry: requiredText(40),
    services: requiredText(40),
    platform: requiredText(40),
    location: requiredText(40),
    duration: requiredText(40),
    year: requiredText(40),
    liveSite: requiredText(40),
    visitSite: requiredText(40),
    measurement: requiredText(60),
    serviceLink: requiredText(40),
    caseStudyLink: requiredText(40),
    /** Over the before and after figures, and their column headings. */
    comparison: requiredText(60),
    before: requiredText(20),
    after: requiredText(20),
  }),
  /** How the published figures were measured, shown with the outcome. */
  measurement: requiredText(600),
});

const workBeforeAndAfterCopySchema = z.object({
  seo: pageSeoSchema,
  eyebrow: requiredText(40),
  /** The H1 of `/before-and-after/`. */
  title: requiredText(90),
  intro: requiredText(400),
  backdrop: decorativeImageSchema.nullable().default(null),
  /** Each comparison's H2, e.g. "What changed when {client} was redesigned?". */
  comparisonHeading: questionTemplate,
  metricsLabel: requiredText(60),
  beforeLabel: requiredText(20),
  afterLabel: requiredText(20),
  caseStudyLabel: requiredText(40),
  /** Shown while no comparison is published. */
  empty: requiredText(300),
  emptyAction: siteLinkSchema,
});

/**
 * `Project.content`: what a case study orders its own way (docs/08-decisions.md, 58). The
 * services a project used are one relation shared with the service pages, loaded in the
 * services' own order; the case study lists them in the order its page names here, and a
 * service it does not name follows.
 */
export const workProjectContentSchema = z.object({
  order: z.object({ services: z.array(slugSchema).max(24).default([]) }).default({ services: [] }),
});
export type WorkProjectContent = z.output<typeof workProjectContentSchema>;

/** The `work.copy` setting: copy around the proof on every page of the family. */
export const workCopySchema = z.object({
  index: workIndexCopySchema,
  caseStudy: workCaseStudyCopySchema,
  beforeAndAfter: workBeforeAndAfterCopySchema,
});
export type WorkCopy = z.output<typeof workCopySchema>;
export type WorkCopyInput = z.input<typeof workCopySchema>;

// ---------------------------------------------------------------- views

/**
 * A card on `/work/` and in related case studies: the site's case study card, with exactly
 * three figures and the slugs it is filtered by.
 */
export const workCaseStudyCardSchema = caseStudyCardSchema.extend({
  metrics: z.array(metricSchema).length(3),
  industry: slugSchema.nullable(),
  services: z.array(slugSchema),
  platforms: z.array(slugSchema),
});
export type WorkCaseStudyCard = z.output<typeof workCaseStudyCardSchema>;

/** A proof figure such as "240+ projects shipped since 2014". */
const workStatisticSchema = z.object({ value: requiredText(20), label: requiredText(80) });

/** What `GET /pages/work` returns. Filtering and pagination happen on the page, from the URL. */
export const workIndexViewSchema = z.object({
  copy: workIndexCopySchema,
  /** Every published case study, featured and newest first. */
  caseStudies: z.array(workCaseStudyCardSchema),
  /** Only values at least one published case study carries. */
  filters: z.object({
    industries: z.array(workTermSchema),
    services: z.array(workTermSchema),
    platforms: z.array(workTermSchema),
  }),
  proof: z.object({
    statistics: z.array(workStatisticSchema).max(4),
    rating: z.object({ average: z.number().min(0).max(5), reviewCount: z.number().int().positive() }).nullable(),
  }),
});
export type WorkIndexView = z.output<typeof workIndexViewSchema>;

const paragraphsSchema = z.array(requiredText(1500)).min(1).max(8);

/**
 * The client on camera (docs/03-page-specs.md, "optional video testimonial"): a consented
 * testimonial on the project that has a video. The poster is the case study's cover, or
 * null when it has none; the video plays in a dialog from the play button.
 */
export const workVideoTestimonialSchema = z.object({
  clientName: requiredText(120),
  role: z.string().nullable(),
  company: z.string().nullable(),
  poster: imageSchema.nullable(),
  videoUrl: mediaSrcSchema,
});
export type WorkVideoTestimonial = z.output<typeof workVideoTestimonialSchema>;

/** What `GET /pages/work/:slug` returns. A section with no content is null and not rendered. */
export const workCaseStudyViewSchema = z.object({
  slug: slugSchema,
  clientName: requiredText(120),
  /** The page's H1. */
  title: requiredText(140),
  answerBlock: answerBlockSchema,
  summary: requiredText(300),
  seo: pageSeoSchema,
  eyebrow: requiredText(40),
  cover: imageSchema.nullable(),
  headline: z.object({ label: requiredText(60), metric: metricSchema }),
  metrics: z.array(metricSchema).min(WORK_MIN_METRICS).max(WORK_MAX_METRICS),
  atAGlance: z.object({
    industry: workTermSchema.nullable(),
    services: z.array(workTermSchema),
    platforms: z.array(workTermSchema),
    location: requiredText(120).nullable(),
    duration: requiredText(60).nullable(),
    year: z.number().int().min(1990).max(2100).nullable(),
    liveUrl: z.url().nullable(),
  }),
  challenge: paragraphsSchema.nullable(),
  approach: paragraphsSchema.nullable(),
  build: paragraphsSchema.nullable(),
  gallery: z.array(imageSchema).max(12),
  beforeAfter: beforeAfterViewSchema.omit({ clientName: true }).nullable(),
  outcome: paragraphsSchema.nullable(),
  measurement: requiredText(600),
  quote: testimonialViewSchema.nullable(),
  videoTestimonial: workVideoTestimonialSchema.nullable(),
  relatedServices: z.array(workTermSchema.extend({ summary: requiredText(300) })).max(6),
  relatedCaseStudies: z.array(workCaseStudyCardSchema).max(3),
  /** Headings with the client's name filled in, each written as a question. */
  headings: workCaseStudyCopySchema.shape.headings,
  labels: workCaseStudyCopySchema.shape.labels,
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WorkCaseStudyView = z.output<typeof workCaseStudyViewSchema>;

/** What `GET /pages/before-and-after` returns: every published comparison, in the page's order. */
export const workBeforeAndAfterViewSchema = z.object({
  copy: workBeforeAndAfterCopySchema.omit({ comparisonHeading: true }),
  comparisons: z.array(
    beforeAfterViewSchema.extend({
      /** The case study it links to, or null when it has no page of its own. */
      slug: slugSchema.nullable(),
      heading: questionSchema(200),
      summary: requiredText(300),
      /** Marked for the homepage; the homepage shows the first one marked (decision 70). */
      onHomepage: z.boolean().default(false),
    }),
  ),
});
export type WorkBeforeAndAfterView = z.output<typeof workBeforeAndAfterViewSchema>;
export type WorkComparison = WorkBeforeAndAfterView['comparisons'][number];

/**
 * The comparison the homepage shows: the first on `/before-and-after/` marked for it, or
 * null (docs/08-decisions.md, 70). Both pages read one list, so the homepage never shows a
 * comparison the page does not.
 */
export function homepageComparison(view: Pick<WorkBeforeAndAfterView, 'comparisons'>): BeforeAfterView | null {
  const chosen = view.comparisons.find((comparison) => comparison.onHomepage);
  if (!chosen) return null;
  return { clientName: chosen.clientName, before: chosen.before, after: chosen.after, metrics: chosen.metrics };
}

// ---------------------------------------------------------------- URL state

export type WorkSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

export interface WorkQuery {
  filters: WorkFilters;
  page: number;
}

const MAX_PAGE = 10_000;

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

/**
 * The filters and page in `/work/?industry=…&service=…&platform=…&page=…`. Empty values
 * are ignored. Returns null for a page number that is not a whole number from 1, which the
 * page answers with 404. Unknown filter values are kept: they match nothing.
 */
export function readWorkQuery(params: WorkSearchParams): WorkQuery | null {
  const filters: WorkFilters = {};
  for (const key of WORK_FILTER_PARAMS) {
    const value = first(params[key])?.trim().toLowerCase();
    if (value) filters[key] = value;
  }
  const rawPage = first(params.page)?.trim();
  if (rawPage === undefined || rawPage === '') return { filters, page: 1 };
  if (!/^[1-9]\d{0,4}$/.test(rawPage)) return null;
  const page = Number(rawPage);
  return page > MAX_PAGE ? null : { filters, page };
}

export function hasWorkFilters(filters: WorkFilters): boolean {
  return WORK_FILTER_PARAMS.some((key) => Boolean(filters[key]));
}

/** `/work/` with filters and, past the first, a page: `/work/?service=shopify-development&page=2`. */
export function workIndexPath(filters: WorkFilters, page = 1): string {
  const path = workFilterPath(filters);
  if (page <= 1) return path;
  return `${path}${path.includes('?') ? '&' : '?'}page=${String(page)}`;
}

/** Whether a card carries every filter set. */
export function matchesWorkFilters(
  card: Pick<WorkCaseStudyCard, 'industry' | 'services' | 'platforms'>,
  filters: WorkFilters,
): boolean {
  return (
    (!filters.industry || card.industry === filters.industry) &&
    (!filters.service || card.services.includes(filters.service)) &&
    (!filters.platform || card.platforms.includes(filters.platform))
  );
}

export interface WorkPage<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first and last item shown; 0 when there are none. */
  from: number;
  to: number;
}

/** One page of results, or null for a page past the last (a 404). Page 1 always exists. */
export function paginateWork<T>(items: readonly T[], page: number, size = WORK_PAGE_SIZE): WorkPage<T> | null {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  if (page > pageCount) return null;
  const start = (page - 1) * size;
  const shown = items.slice(start, start + size);
  return {
    items: shown,
    page,
    pageCount,
    total: items.length,
    from: shown.length > 0 ? start + 1 : 0,
    to: start + shown.length,
  };
}

/** The deliberate target with exactly these filters, if there is one. */
export function findWorkFilterTarget(
  targets: readonly WorkFilterTarget[],
  filters: WorkFilters,
): WorkFilterTarget | null {
  return (
    targets.find((target) => WORK_FILTER_PARAMS.every((key) => (target.filters[key] ?? null) === (filters[key] ?? null))) ??
    null
  );
}

export interface WorkIndexIndexing {
  canonicalPath: string;
  noindex: boolean;
  target: WorkFilterTarget | null;
}

/**
 * Canonical and robots for a view of `/work/` (docs/04-seo-keyword-map.md): the unfiltered
 * listing and its pages, and deliberate target combinations, canonicalise to themselves;
 * any other filter combination canonicalises to `/work/` and is kept out of search.
 */
export function workIndexIndexing(query: WorkQuery, targets: readonly WorkFilterTarget[]): WorkIndexIndexing {
  if (!hasWorkFilters(query.filters)) {
    return { canonicalPath: workIndexPath({}, query.page), noindex: false, target: null };
  }
  const target = findWorkFilterTarget(targets, query.filters);
  if (target) return { canonicalPath: workIndexPath(query.filters, query.page), noindex: false, target };
  return { canonicalPath: SITE_ROUTES.work, noindex: true, target: null };
}
