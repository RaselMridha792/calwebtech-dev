import type { Prisma, Testimonial } from '@calwebtech/db';
import {
  INDUSTRY_CASE_STUDY_LIMIT,
  INDUSTRY_FAQ_LIMIT,
  INDUSTRY_METRIC_LIMIT,
  INDUSTRY_SERVICE_LIMIT,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  imageSchema,
  industriesIndexContentSchema,
  industriesIndexViewSchema,
  industryContentSchema,
  industryDetailViewSchema,
  seoSchema,
  workFilterPath,
  type CaseStudyCard,
  type Image,
  type IndustriesIndexView,
  type IndustryDetailView,
  type IndustryMetric,
  type TestimonialView,
} from '@calwebtech/shared';
import { z } from 'zod';
import { CONSENTED, publishedAsOf } from '../common/published';
import { image, outcomeMetricsSchema } from '../landing-pages/landing-page.mapper';

/** Section headings used when a record has proof or items but no copy of its own yet. */
export const INDUSTRY_FALLBACK_HEADINGS = {
  painPoints: 'Which problems does the website need to solve?',
  services: 'Which services fit this industry?',
  caseStudies: 'Which projects have we delivered in this industry?',
  caseStudiesLink: 'See all work in this industry',
  results: 'What did those projects change?',
  integrations: 'Which systems does the website connect to?',
  faq: 'What do buyers ask before starting a project?',
} as const;

/**
 * Relations loaded for an industry page. Unpublished services and projects, soft-deleted
 * records and testimonials without consent are filtered out here.
 */
export function industryDetailInclude(now: Date) {
  return {
    services: {
      where: { ...publishedAsOf(now), deletedAt: null },
      orderBy: { order: 'asc' },
      select: { slug: true, title: true, shortDescription: true },
    },
    // More than are shown, so projects without outcome figures can be skipped.
    projects: {
      where: { status: 'PUBLISHED', deletedAt: null },
      orderBy: [{ featured: 'desc' }, { year: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: 12,
      include: {
        technologies: { orderBy: { order: 'asc' }, select: { name: true }, take: 2 },
        testimonials: { where: CONSENTED, orderBy: [{ featured: 'desc' }, { date: 'desc' }], take: 1 },
      },
    },
    faqs: { orderBy: { order: 'asc' } },
  } satisfies Prisma.IndustryInclude;
}

export type IndustryDetailRecord = Prisma.IndustryGetPayload<{ include: ReturnType<typeof industryDetailInclude> }>;
type IndustryProjectRecord = IndustryDetailRecord['projects'][number];

/** The columns of a published industry that its card needs. */
export const industryCardSelect = {
  slug: true,
  name: true,
  heroCopy: true,
  content: true,
} satisfies Prisma.IndustrySelect;
export type IndustryCardRecord = Prisma.IndustryGetPayload<{ select: typeof industryCardSelect }>;

export interface IndustriesIndexSources {
  /** The `industries.index` setting. */
  contentSetting: unknown;
  /** Published industries in order. */
  industries: IndustryCardRecord[];
}

const stringListSchema = z.array(z.string().trim().min(1)).nullable();
const cardImageSchema = z.object({ image: imageSchema.nullable().catch(null).default(null) });

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Shortens text to `max` characters at a word boundary, for SEO fallbacks. */
export function shorten(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(' ');
  return (boundary > max * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.–-]+$/u, '');
}

/** The card image an industry's copy carries, or none when the copy is missing or malformed. */
function cardImage(content: unknown): Image | null {
  const parsed = cardImageSchema.safeParse(content ?? {});
  return parsed.success ? parsed.data.image : null;
}

/**
 * Builds `/industries/` and validates it against the shared contract. Malformed index copy
 * fails here; a malformed card image on one industry only drops that image.
 */
export function toIndustriesIndexView(sources: IndustriesIndexSources): IndustriesIndexView {
  return industriesIndexViewSchema.parse({
    content: industriesIndexContentSchema.parse(sources.contentSetting),
    industries: sources.industries.map((industry) => ({
      slug: industry.slug,
      name: industry.name,
      line: present(industry.heroCopy) ? industry.heroCopy : null,
      image: cardImage(industry.content),
    })),
  });
}

function testimonialView(testimonial: Testimonial): TestimonialView {
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

interface CaseStudy {
  card: CaseStudyCard;
  /** Every outcome figure, for the metrics band; the card shows the first three. */
  metrics: { value: string; label: string }[];
  testimonial: Testimonial | null;
}

/** A case study, or nothing when the project has no outcome figures to show. */
function caseStudy(project: IndustryProjectRecord): CaseStudy | null {
  const metrics = outcomeMetricsSchema.safeParse(project.outcomeMetrics);
  if (!metrics.success || metrics.data.length === 0) return null;
  const clientName = project.clientAlias ?? project.clientName;
  return {
    card: {
      slug: project.slug,
      clientName,
      summary: project.summary,
      tags: [project.location, project.segment, ...project.technologies.map((technology) => technology.name)]
        .filter(present)
        .slice(0, 4),
      image: image(project.coverImageUrl, project.coverImageAlt),
      metrics: metrics.data.slice(0, 3),
    },
    metrics: metrics.data,
    testimonial: project.testimonials[0] ?? null,
  };
}

/** Figures shared out across the case studies, so one client with many figures cannot fill the band. */
function sectorMetrics(studies: readonly CaseStudy[]): IndustryMetric[] {
  if (studies.length === 0) return [];
  const perClient = Math.max(1, Math.floor(INDUSTRY_METRIC_LIMIT / studies.length));
  return studies
    .flatMap((study) =>
      study.metrics.slice(0, perClient).map((metric) => ({ ...metric, clientName: study.card.clientName })),
    )
    .slice(0, INDUSTRY_METRIC_LIMIT);
}

/**
 * Builds an industry page and validates it against the shared contract, so malformed copy
 * or a malformed record fails here rather than rendering half a page. Sections with neither
 * copy nor records are null and left out of the page.
 */
export function toIndustryDetailView(industry: IndustryDetailRecord): IndustryDetailView {
  const content = industry.content === null ? null : industryContentSchema.parse(industry.content);
  const seo = seoSchema.nullable().parse(industry.seo);
  const title = content?.title ?? industry.name;

  const columnPainPoints = stringListSchema.parse(industry.painPoints) ?? [];
  const painPoints = content
    ? { heading: content.painPoints.heading, intro: content.painPoints.intro, items: content.painPoints.items }
    : columnPainPoints.length > 0
      ? {
          heading: INDUSTRY_FALLBACK_HEADINGS.painPoints,
          intro: null,
          items: columnPainPoints.slice(0, 4).map((point) => ({ title: point, body: null })),
        }
      : null;

  const translations = new Map((content?.services.items ?? []).map((item) => [item.slug, item.body]));
  const serviceItems = industry.services.slice(0, INDUSTRY_SERVICE_LIMIT).map((service) => ({
    slug: service.slug,
    title: service.title,
    body: translations.get(service.slug) ?? service.shortDescription,
  }));

  const studies = industry.projects
    .map(caseStudy)
    .filter((study): study is CaseStudy => study !== null)
    .slice(0, INDUSTRY_CASE_STUDY_LIMIT);
  const quote = studies.find((study) => study.testimonial !== null)?.testimonial ?? null;

  const columnIntegrations = stringListSchema.parse(industry.integrations) ?? [];
  const integrationItems = content
    ? content.integrations.items
    : columnIntegrations.map((name) => ({ name, body: null }));

  const faqs = industry.faqs
    .slice(0, INDUSTRY_FAQ_LIMIT)
    .map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }));

  return industryDetailViewSchema.parse({
    slug: industry.slug,
    name: industry.name,
    title,
    seo: {
      title: seo?.title ?? shorten(title, SEO_TITLE_MAX),
      description: seo?.description ?? shorten(industry.answerBlock, SEO_DESCRIPTION_MAX),
      ogImage: seo?.ogImage ?? content?.image?.src ?? null,
    },
    answerBlock: industry.answerBlock,
    updatedAt: industry.updatedAt.toISOString(),
    hero: {
      intro: content?.hero.intro ?? (present(industry.heroCopy) ? industry.heroCopy : null),
      primaryCta: content?.hero.primaryCta ?? null,
      secondaryCta: content?.hero.secondaryCta ?? null,
      highlights: content?.hero.highlights ?? [],
      backdrop: content?.hero.backdrop ?? null,
      line: present(industry.heroCopy) ? industry.heroCopy : null,
    },
    painPoints,
    services:
      serviceItems.length > 0
        ? {
            heading: content?.services.heading ?? INDUSTRY_FALLBACK_HEADINGS.services,
            intro: content?.services.intro ?? null,
            items: serviceItems,
          }
        : null,
    compliance: content?.compliance ?? null,
    caseStudies:
      studies.length > 0
        ? {
            heading: content?.caseStudies.heading ?? INDUSTRY_FALLBACK_HEADINGS.caseStudies,
            intro: content?.caseStudies.intro ?? null,
            items: studies.map((study) => study.card),
            link: {
              label: content?.caseStudies.linkLabel ?? INDUSTRY_FALLBACK_HEADINGS.caseStudiesLink,
              href: workFilterPath({ industry: industry.slug }),
            },
          }
        : null,
    results:
      studies.length > 0
        ? {
            heading: content?.results.heading ?? INDUSTRY_FALLBACK_HEADINGS.results,
            intro: content?.results.intro ?? null,
            note: content?.results.note ?? null,
            metrics: sectorMetrics(studies),
            testimonial: quote ? testimonialView(quote) : null,
          }
        : null,
    integrations:
      integrationItems.length > 0
        ? {
            heading: content?.integrations.heading ?? INDUSTRY_FALLBACK_HEADINGS.integrations,
            intro: content?.integrations.intro ?? null,
            items: integrationItems,
          }
        : null,
    faq:
      faqs.length > 0
        ? {
            heading: content?.faq.heading ?? INDUSTRY_FALLBACK_HEADINGS.faq,
            intro: content?.faq.intro ?? null,
            items: faqs,
          }
        : null,
  });
}
