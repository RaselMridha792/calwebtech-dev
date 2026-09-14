import type {
  Award,
  ClientLogo,
  Faq,
  Guide,
  Industry,
  Location,
  PricingTier,
  Prisma,
  ProcessStep,
  ReviewSource,
  Service,
  Statistic,
  Technology,
  Testimonial,
} from '@calwebtech/db';
import {
  homePageViewSchema,
  homepageIndexingSchema,
  siteProofSchema,
  type HomePageView,
  type HomeProject,
  type TestimonialView,
} from '@calwebtech/shared';
import { z } from 'zod';
import {
  beforeAfterMetricsSchema,
  image,
  outcomeMetricsSchema,
  summariseReviews,
} from '../landing-pages/landing-page.mapper';

/** Relations loaded for featured projects: the industry for the filter, one consented quote. */
export const homeProjectInclude = {
  industry: { select: { name: true } },
  testimonials: {
    where: { consentAt: { not: null } },
    orderBy: [{ featured: 'desc' }, { date: 'desc' }],
    take: 1,
  },
} satisfies Prisma.ProjectInclude;
export type HomeProjectRecord = Prisma.ProjectGetPayload<{ include: typeof homeProjectInclude }>;

export const homeCategoryInclude = {
  services: {
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: { order: 'asc' },
    select: { slug: true, title: true },
  },
} satisfies Prisma.ServiceCategoryInclude;
export type HomeCategoryRecord = Prisma.ServiceCategoryGetPayload<{ include: typeof homeCategoryInclude }>;

export const homePostInclude = { category: { select: { name: true } } } satisfies Prisma.PostInclude;
export type HomePostRecord = Prisma.PostGetPayload<{ include: typeof homePostInclude }>;

export interface HomePageSources {
  contentSetting: unknown;
  contactSetting: unknown;
  proofSetting: unknown;
  indexingSetting: unknown;
  reviewSources: ReviewSource[];
  clientLogos: ClientLogo[];
  statistics: Statistic[];
  categories: HomeCategoryRecord[];
  services: Service[];
  industries: Industry[];
  problemRouter: Faq[];
  /** Featured, published projects, newest first. */
  projects: HomeProjectRecord[];
  technologies: Technology[];
  processSteps: ProcessStep[];
  /** Testimonials with consent to publish, featured first. */
  testimonials: Testimonial[];
  awards: Award[];
  posts: HomePostRecord[];
  guide: Guide | null;
  locations: Location[];
  pricingTiers: PricingTier[];
}

export const HOME_PROJECT_LIMIT = 5;
export const HOME_TESTIMONIAL_LIMIT = 3;

const TECHNOLOGY_CATEGORY_LABELS: Partial<Record<string, string>> = {
  frontend: 'Front end',
  backend: 'Back end',
  cms: 'Content',
  ecommerce: 'Ecommerce',
  infrastructure: 'Infrastructure',
  tooling: 'Tooling',
};

const deliverablesSchema = z.array(z.string().trim().min(1));

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

/** A project card, or nothing when the record has no outcome figures to show. Also the chrome's Work menu. */
export function projectView(project: HomeProjectRecord): HomeProject | null {
  const metrics = outcomeMetricsSchema.safeParse(project.outcomeMetrics);
  if (!metrics.success || metrics.data.length === 0) return null;
  const quote = project.testimonials[0];
  return {
    slug: project.slug,
    clientName: project.clientAlias ?? project.clientName,
    summary: project.summary,
    tags: [project.location, project.segment, project.industry?.name].filter(present),
    filter: project.industry?.name ?? null,
    image: image(project.coverImageUrl, project.coverImageAlt),
    metrics: metrics.data.slice(0, 3),
    quote: quote ? testimonialView(quote) : null,
  };
}

/** The first featured project with both screenshots. Unfeatured projects never appear here. */
function beforeAfterView(projects: readonly HomeProjectRecord[]): HomePageView['beforeAfter'] {
  for (const project of projects) {
    const clientName = project.clientAlias ?? project.clientName;
    const before = image(project.beforeImageUrl, `${clientName} website before the redesign`);
    const after = image(project.afterImageUrl, `${clientName} website after the redesign`);
    if (!before || !after) continue;
    const metrics = beforeAfterMetricsSchema.safeParse(project.beforeAfterMetrics ?? []);
    return { clientName, before, after, metrics: metrics.success ? metrics.data.slice(0, 4) : [] };
  }
  return null;
}

function technologyGroups(technologies: readonly Technology[]): HomePageView['technologyGroups'] {
  const groups = new Map<string, string[]>();
  for (const technology of technologies) {
    groups.set(technology.category, [...(groups.get(technology.category) ?? []), technology.name]);
  }
  return [...groups].map(([category, names]) => ({
    category: TECHNOLOGY_CATEGORY_LABELS[category] ?? category,
    names,
  }));
}

/**
 * The weighted rating with each platform's review count and the NPS sample size. Shared by
 * the homepage and the site chrome's rating badge.
 */
export function homeReviewSummary(reviewSources: readonly ReviewSource[], proofSetting: unknown): HomePageView['reviews'] {
  const proof = siteProofSchema.nullable().catch(null).parse(proofSetting);
  const reviews = summariseReviews(reviewSources, proof?.npsScore ?? null);
  const reviewCounts = new Map(reviewSources.map((source) => [source.platform, source.reviewCount]));
  return {
    ...reviews,
    sources: reviews.sources.map((source) => ({ ...source, reviewCount: reviewCounts.get(source.platform) ?? null })),
    npsProjectCount: proof?.npsProjectCount ?? null,
  };
}

/**
 * Builds the public homepage and validates it against the shared contract, so malformed
 * copy or a malformed record fails here rather than rendering half a page. The homepage
 * is noindex unless the `homepage.indexing` setting says otherwise.
 */
export function toHomePageView(sources: HomePageSources): HomePageView {
  const indexing = homepageIndexingSchema.safeParse(sources.indexingSetting);

  const projects = sources.projects
    .map(projectView)
    .filter((project): project is HomeProject => project !== null)
    .slice(0, HOME_PROJECT_LIMIT);
  // A quote already shown on a project card is not repeated further down the page.
  const onProjectCards = new Set(projects.flatMap((project) => (project.quote ? [project.quote.id] : [])));
  const quotes = sources.testimonials.filter((testimonial) => !onProjectCards.has(testimonial.id));
  const pullQuote = quotes.find((testimonial) => testimonial.featured) ?? null;
  const testimonials = quotes.filter((testimonial) => testimonial !== pullQuote).slice(0, HOME_TESTIMONIAL_LIMIT);

  const services = sources.services.map((service) => {
    const deliverables = deliverablesSchema.safeParse(service.deliverables);
    return {
      slug: service.slug,
      title: service.title,
      summary: service.shortDescription,
      deliverables: deliverables.success ? deliverables.data.slice(0, 3) : [],
    };
  });

  return homePageViewSchema.parse({
    indexable: indexing.success && indexing.data.index,
    content: sources.contentSetting,
    contact: sources.contactSetting,
    reviews: homeReviewSummary(sources.reviewSources, sources.proofSetting),
    statistics: sources.statistics
      .slice(0, 4)
      .map((statistic) => ({ label: statistic.label, value: statistic.value, suffix: statistic.suffix ?? '' })),
    clients: sources.clientLogos.map((logo) => ({ name: logo.name, logo: image(logo.logoUrl, logo.logoAlt) })),
    serviceGroups: sources.categories
      .filter((category) => category.services.length > 0)
      .map((category) => ({ name: category.name, services: category.services })),
    services,
    industries: sources.industries.map((industry) => ({
      slug: industry.slug,
      name: industry.name,
      line: industry.heroCopy,
    })),
    problemRouter: sources.problemRouter.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer })),
    projects,
    pullQuote: pullQuote ? testimonialView(pullQuote) : null,
    beforeAfter: beforeAfterView(sources.projects),
    technologyGroups: technologyGroups(sources.technologies),
    processSteps: sources.processSteps.map((step) => ({ title: step.title, timing: step.timing, summary: step.summary })),
    testimonials: testimonials.map(testimonialView),
    awards: sources.awards.map((award) => ({
      name: award.name,
      detail: [award.projectName ?? award.category, String(award.year)].filter(present).join(', '),
    })),
    expertise: services.map((service) => service.title),
    posts: sources.posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category?.name ?? null,
      readingTime: post.readingTime !== null && post.readingTime > 0 ? post.readingTime : null,
    })),
    guide: sources.guide
      ? {
          slug: sources.guide.slug,
          title: sources.guide.title,
          summary: sources.guide.summary,
          fileUrl: sources.guide.fileUrl,
        }
      : null,
    locations: sources.locations.map((location) => ({
      slug: location.slug,
      city: location.city,
      state: location.state,
      tier: location.tier,
      serviceArea: location.serviceArea,
      address: location.address,
    })),
    pricingTiers: sources.pricingTiers.map((tier) => ({
      name: tier.name,
      priceLabel: tier.priceLabel,
      summary: tier.summary,
      highlighted: tier.highlighted,
    })),
  });
}
