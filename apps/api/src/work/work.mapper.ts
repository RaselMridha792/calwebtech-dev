import type { Prisma, ReviewSource, Statistic, Testimonial } from '@calwebtech/db';
import {
  WORK_MAX_METRICS,
  WORK_MIN_METRICS,
  answerBlockSchema,
  imageSchema,
  mediaSrcSchema,
  metricSchema,
  seoSchema,
  workBeforeAndAfterViewSchema,
  workCaseStudyCardSchema,
  workCaseStudyViewSchema,
  workCopySchema,
  workHeading,
  workIndexViewSchema,
  type Image,
  type Metric,
  type TestimonialView,
  type WorkBeforeAndAfterView,
  type WorkCaseStudyCard,
  type WorkCaseStudyView,
  type WorkCopy,
  type WorkIndexView,
  type WorkTerm,
  type WorkVideoTestimonial,
} from '@calwebtech/shared';
import { z } from 'zod';
import { CONSENTED, publishedAsOf } from '../common/published';
import { image, summariseReviews } from '../landing-pages/landing-page.mapper';

/**
 * Relations loaded for a case study. Only published services and consented testimonials
 * come back; the industry's status is checked in the mapper, so an unpublished industry
 * is neither a filter nor a link.
 */
export function workProjectInclude(now: Date) {
  return {
    industry: { select: { slug: true, name: true, status: true } },
    services: {
      where: { ...publishedAsOf(now), deletedAt: null },
      orderBy: { order: 'asc' },
      select: { slug: true, title: true, shortDescription: true },
    },
    technologies: { orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { slug: true, name: true } },
    testimonials: { where: CONSENTED, orderBy: [{ featured: 'desc' }, { date: 'desc' }], take: 1 },
  } satisfies Prisma.ProjectInclude;
}

export type WorkProjectRecord = Prisma.ProjectGetPayload<{ include: ReturnType<typeof workProjectInclude> }>;

/**
 * The query for a case study's video testimonial: a consented testimonial on the project
 * with a video, featured and newest first. It is its own query because the quote loaded
 * with the project (`take: 1`) is often not the one with a video.
 */
export function workVideoTestimonialQuery(projectId: string) {
  return {
    where: { projectId, ...CONSENTED, videoUrl: { not: null } },
    orderBy: [{ featured: 'desc' }, { date: 'desc' }],
  } satisfies Prisma.TestimonialFindFirstArgs;
}

/** The columns the before and after page reads from a project. */
export const workComparisonSelect = {
  slug: true,
  clientName: true,
  clientAlias: true,
  summary: true,
  answerBlock: true,
  outcomeMetrics: true,
  beforeImageUrl: true,
  afterImageUrl: true,
  beforeAfterMetrics: true,
} satisfies Prisma.ProjectSelect;

export type WorkComparisonRecord = Prisma.ProjectGetPayload<{ select: typeof workComparisonSelect }>;

/** A record or setting that does not meet the contract, named so the log says which to fix. */
export class WorkContractError extends Error {
  constructor(
    readonly record: string,
    cause: unknown,
  ) {
    super(`${record} does not match the work contract`, { cause });
    this.name = 'WorkContractError';
  }
}

function parseAs<Schema extends z.ZodType>(record: string, schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new WorkContractError(record, result.error);
  return result.data;
}

export function parseWorkCopy(setting: unknown): WorkCopy {
  return parseAs('The "work.copy" setting', workCopySchema, setting);
}

const clientOf = (project: { clientName: string; clientAlias: string | null }): string =>
  project.clientAlias ?? project.clientName;

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------------------------------------------------------------- readiness

export type CaseStudyReadiness = { ready: true; metrics: Metric[] } | { ready: false; reason: string };

/**
 * Whether a published project has a case study page: at least three well-formed outcome
 * figures and a two or three sentence answer block. A project without them is left out of
 * `/work/` and its URL answers 404; its before and after pair can still be shown.
 */
export function caseStudyReadiness(project: Pick<WorkProjectRecord, 'outcomeMetrics' | 'answerBlock'>): CaseStudyReadiness {
  const metrics = z.array(metricSchema).safeParse(project.outcomeMetrics);
  if (!metrics.success || metrics.data.length < WORK_MIN_METRICS) {
    return { ready: false, reason: `needs at least ${String(WORK_MIN_METRICS)} well-formed outcome figures` };
  }
  if (!answerBlockSchema.safeParse(project.answerBlock).success) {
    return { ready: false, reason: 'needs an answer block of two or three complete sentences' };
  }
  return { ready: true, metrics: metrics.data };
}

// ---------------------------------------------------------------- terms and cards

function publishedIndustry(project: WorkProjectRecord): WorkTerm | null {
  const industry = project.industry;
  return industry?.status === 'PUBLISHED' ? { slug: industry.slug, name: industry.name } : null;
}

/**
 * Card tags: the location, each comma-separated segment ("B2B, Distribution") and the
 * platforms, at most four.
 */
export function caseStudyTags(project: Pick<WorkProjectRecord, 'location' | 'segment' | 'technologies'>): string[] {
  const segments = (project.segment ?? '').split(',').map((part) => part.trim());
  const tags = [project.location?.trim(), ...segments, ...project.technologies.map((technology) => technology.name)];
  return [...new Set(tags.filter(present))].slice(0, 4);
}

function cardOf(project: WorkProjectRecord, metrics: readonly Metric[]): WorkCaseStudyCard {
  return parseAs(`Project "${project.slug}"`, workCaseStudyCardSchema, {
    slug: project.slug,
    clientName: clientOf(project),
    summary: project.summary,
    tags: caseStudyTags(project),
    image: image(project.coverImageUrl, project.coverImageAlt),
    metrics: metrics.slice(0, 3),
    industry: publishedIndustry(project)?.slug ?? null,
    services: project.services.map((service) => service.slug),
    platforms: project.technologies.map((technology) => technology.slug),
  });
}

/** Ready projects as cards, in the order given. */
export function caseStudyCards(projects: readonly WorkProjectRecord[]): WorkCaseStudyCard[] {
  return projects.flatMap((project) => {
    const readiness = caseStudyReadiness(project);
    return readiness.ready ? [cardOf(project, readiness.metrics)] : [];
  });
}

function uniqueTerms(terms: readonly WorkTerm[]): WorkTerm[] {
  const bySlug = new Map<string, WorkTerm>();
  for (const term of terms) if (!bySlug.has(term.slug)) bySlug.set(term.slug, term);
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

// ---------------------------------------------------------------- index

export interface WorkIndexSources {
  copySetting: unknown;
  /** Published projects, featured and newest first. */
  projects: WorkProjectRecord[];
  statistics: Statistic[];
  reviewSources: ReviewSource[];
}

/** The `/work/` view: every ready case study, the filter values they carry, and the proof band. */
export function toWorkIndexView(sources: WorkIndexSources): WorkIndexView {
  const copy = parseWorkCopy(sources.copySetting);
  const ready = sources.projects.filter((project) => caseStudyReadiness(project).ready);
  const reviews = summariseReviews(sources.reviewSources, null);

  return parseAs('The work index', workIndexViewSchema, {
    copy: copy.index,
    caseStudies: caseStudyCards(ready),
    filters: {
      industries: uniqueTerms(ready.flatMap((project) => publishedIndustry(project) ?? [])),
      services: uniqueTerms(ready.flatMap((project) => project.services.map(({ slug, title }) => ({ slug, name: title })))),
      platforms: uniqueTerms(ready.flatMap((project) => project.technologies)),
    },
    proof: {
      statistics: sources.statistics
        .slice(0, 4)
        .map((statistic) => ({ value: `${statistic.value}${statistic.suffix ?? ''}`, label: statistic.label })),
      rating:
        reviews.averageRating !== null && reviews.totalReviews > 0
          ? { average: reviews.averageRating, reviewCount: reviews.totalReviews }
          : null,
    },
  });
}

// ---------------------------------------------------------------- case study

export interface WorkCaseStudySources {
  copySetting: unknown;
  project: WorkProjectRecord;
  /** Other published projects to pick related case studies from, in order of preference. */
  others: WorkProjectRecord[];
  /** The project's consented testimonial with a video (`workVideoTestimonialQuery`), if any. */
  videoTestimonial?: Testimonial | null;
}

/** Long text columns as paragraphs, split on blank lines. Null when there is nothing to show. */
export function paragraphs(value: string | null): string[] | null {
  const parts = (value ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/** Gallery entries with alt text. The media library requires it, so entries without are left out. */
export function galleryImages(value: Prisma.JsonValue | null): Image[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = imageSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Shortens text to `max` characters at a word boundary, for SEO fallbacks. */
export function fitText(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  // A word that ends right at the limit is kept: the boundary may be the character after it.
  const boundary = text.slice(0, max).lastIndexOf(' ');
  const cut = boundary > (max - 1) * 0.6 ? text.slice(0, boundary) : text.slice(0, max - 1);
  const clean = cut.replace(/[\s,;:.–-]+$/u, '');
  return `${clean}…`;
}

function testimonialView(project: WorkProjectRecord): TestimonialView | null {
  const testimonial = project.testimonials[0];
  // The query loads consented testimonials only; this keeps the rule if a caller does not.
  if (!testimonial?.consentAt) return null;
  return {
    id: testimonial.id,
    quote: testimonial.quote,
    clientName: testimonial.clientName,
    role: testimonial.role,
    company: testimonial.company,
    rating: testimonial.rating,
    avatar: testimonial.avatarUrl ? { src: testimonial.avatarUrl } : null,
  };
}

/**
 * The client on camera, over the case study's cover. Null without consent or without a
 * usable video URL, so the page never offers a play button that does nothing.
 */
export function videoTestimonialView(
  testimonial: Testimonial | null | undefined,
  poster: Image | null,
): WorkVideoTestimonial | null {
  if (!testimonial?.consentAt) return null;
  const videoUrl = mediaSrcSchema.safeParse(testimonial.videoUrl);
  if (!videoUrl.success) return null;
  return {
    clientName: testimonial.clientName,
    role: testimonial.role,
    company: testimonial.company,
    poster,
    videoUrl: videoUrl.data,
  };
}

const beforeAfterPairsSchema = z.array(z.object({ label: z.string(), before: z.string(), after: z.string() }));

/**
 * Up to three other case studies, those sharing the industry, then services, then
 * platforms first; the rest in the order given.
 */
export function relatedCaseStudies(project: WorkProjectRecord, others: readonly WorkProjectRecord[]): WorkCaseStudyCard[] {
  const industry = publishedIndustry(project)?.slug ?? null;
  const services = new Set(project.services.map((service) => service.slug));
  const platforms = new Set(project.technologies.map((technology) => technology.slug));
  const score = (other: WorkProjectRecord) =>
    (industry !== null && publishedIndustry(other)?.slug === industry ? 4 : 0) +
    other.services.filter((service) => services.has(service.slug)).length * 2 +
    other.technologies.filter((technology) => platforms.has(technology.slug)).length;

  const candidates = others
    .filter((other) => other.slug !== project.slug && caseStudyReadiness(other).ready)
    .map((other, order) => ({ other, order, score: score(other) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 3)
    .map(({ other }) => other);
  return caseStudyCards(candidates);
}

/**
 * The `/work/<slug>/` view, or a contract error. Call it only for a ready project
 * (`caseStudyReadiness`): the service answers 404 for the rest.
 */
export function toCaseStudyView(sources: WorkCaseStudySources): WorkCaseStudyView {
  const { project } = sources;
  const record = `Project "${project.slug}"`;
  const readiness = caseStudyReadiness(project);
  if (!readiness.ready) throw new WorkContractError(record, new Error(readiness.reason));

  const copy = parseWorkCopy(sources.copySetting).caseStudy;
  const clientName = clientOf(project);
  const seo = parseAs(record, seoSchema.nullable(), project.seo ?? null);
  const cover = image(project.coverImageUrl, project.coverImageAlt);
  const headings = Object.fromEntries(
    Object.entries(copy.headings).map(([key, template]) => [key, workHeading(template, clientName)]),
  );

  const before = image(project.beforeImageUrl, `${clientName} website before the redesign`);
  const after = image(project.afterImageUrl, `${clientName} website after the redesign`);
  const [headline] = readiness.metrics;

  return parseAs(record, workCaseStudyViewSchema, {
    slug: project.slug,
    clientName,
    title: project.title,
    answerBlock: project.answerBlock,
    summary: project.summary,
    seo: {
      title: seo?.title ?? fitText(`${clientName} case study`, 60),
      description: seo?.description ?? fitText(project.summary, 155),
      ogImage: seo?.ogImage ?? cover?.src ?? null,
    },
    eyebrow: copy.eyebrow,
    cover,
    headline: { label: copy.headlineLabel, metric: headline },
    metrics: readiness.metrics.slice(0, WORK_MAX_METRICS),
    atAGlance: {
      industry: publishedIndustry(project),
      services: project.services.map(({ slug, title }) => ({ slug, name: title })),
      platforms: project.technologies.map(({ slug, name }) => ({ slug, name })),
      location: present(project.location) ? project.location.trim() : null,
      duration: present(project.duration) ? project.duration.trim() : null,
      year: project.year,
      liveUrl: present(project.liveUrl) ? project.liveUrl.trim() : null,
    },
    challenge: paragraphs(project.challenge),
    approach: paragraphs(project.approach),
    build: paragraphs(project.buildNotes),
    gallery: galleryImages(project.gallery).slice(0, 12),
    beforeAfter:
      before && after
        ? { before, after, metrics: parseAs(record, beforeAfterPairsSchema, project.beforeAfterMetrics ?? []).slice(0, 4) }
        : null,
    outcome: paragraphs(project.outcome),
    measurement: copy.measurement,
    quote: testimonialView(project),
    videoTestimonial: videoTestimonialView(sources.videoTestimonial, cover),
    relatedServices: project.services
      .slice(0, 6)
      // A service's description belongs to the services family; fit it to the card rather than fail the page.
      .map((service) => ({ slug: service.slug, name: service.title, summary: fitText(service.shortDescription, 300) })),
    relatedCaseStudies: relatedCaseStudies(project, sources.others),
    headings,
    labels: copy.labels,
    publishedAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
}

// ---------------------------------------------------------------- before and after

export interface WorkBeforeAndAfterSources {
  copySetting: unknown;
  /** Published projects with both screenshots, in display order. */
  projects: WorkComparisonRecord[];
}

/** The `/before-and-after/` view: every published pair, linked to its case study when it has one. */
export function toBeforeAndAfterView(sources: WorkBeforeAndAfterSources): WorkBeforeAndAfterView {
  const { comparisonHeading, ...copy } = parseWorkCopy(sources.copySetting).beforeAndAfter;
  const comparisons = sources.projects.flatMap((project) => {
    const clientName = clientOf(project);
    const before = image(project.beforeImageUrl, `${clientName} website before the redesign`);
    const after = image(project.afterImageUrl, `${clientName} website after the redesign`);
    if (!before || !after) return [];
    return [
      {
        slug: caseStudyReadiness(project).ready ? project.slug : null,
        clientName,
        heading: workHeading(comparisonHeading, clientName),
        summary: project.summary,
        before,
        after,
        metrics: parseAs(`Project "${project.slug}"`, beforeAfterPairsSchema, project.beforeAfterMetrics ?? []).slice(0, 4),
      },
    ];
  });
  return parseAs('The before and after page', workBeforeAndAfterViewSchema, { copy, comparisons });
}
