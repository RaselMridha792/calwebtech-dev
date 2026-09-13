import type { ClientLogo, Prisma, PricingTier, ProcessStep, ReviewSource } from '@calwebtech/db';
import {
  type Image,
  type LandingPageView,
  type ReviewSummary,
  landingPageViewSchema,
  siteContactSchema,
  siteProofSchema,
} from '@calwebtech/shared';
import { z } from 'zod';

/** Relations loaded for a landing page. Unpublished or unconsented proof is filtered out here. */
export const landingPageInclude = {
  results: {
    where: { status: 'PUBLISHED', deletedAt: null },
    include: { industry: { select: { name: true } } },
    orderBy: [{ featured: 'desc' }, { year: 'desc' }],
  },
  beforeAfterProject: true,
  testimonials: {
    where: { consentAt: { not: null } },
    orderBy: [{ featured: 'desc' }, { date: 'desc' }],
  },
  team: { where: { active: true }, orderBy: { order: 'asc' } },
  partners: { orderBy: { order: 'asc' } },
  technologies: { orderBy: { order: 'asc' } },
  faqs: { orderBy: { order: 'asc' } },
} satisfies Prisma.LandingPageInclude;

export type LandingPageRecord = Prisma.LandingPageGetPayload<{
  include: typeof landingPageInclude;
}>;

export interface LandingPageSources {
  page: LandingPageRecord;
  contactSetting: unknown;
  proofSetting: unknown;
  reviewSources: ReviewSource[];
  clientLogos: ClientLogo[];
  processSteps: ProcessStep[];
  pricingTiers: PricingTier[];
}

export const outcomeMetricsSchema = z.array(z.object({ value: z.string(), label: z.string() }));
export const beforeAfterMetricsSchema = z.array(
  z.object({ label: z.string(), before: z.string(), after: z.string() }),
);

export function image(src: string | null, alt: string | null): Image | null {
  return src && alt ? { src, alt } : null;
}

/** Weighted average across platforms, so a 5.0 from 3 reviews cannot outweigh 96 at 4.9. */
export function summariseReviews(
  sources: readonly ReviewSource[],
  npsScore: number | null,
): ReviewSummary {
  const totalReviews = sources.reduce((sum, source) => sum + source.reviewCount, 0);
  const weighted = sources.reduce(
    (sum, source) => sum + source.rating.toNumber() * source.reviewCount,
    0,
  );
  return {
    averageRating: totalReviews > 0 ? Math.round((weighted / totalReviews) * 10) / 10 : null,
    totalReviews,
    sources: [...sources]
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .map((source) => ({ platform: source.platform, rating: source.rating.toNumber() })),
    npsScore,
  };
}

/**
 * Builds the public view of a landing page and validates it against the shared
 * contract, so a malformed record fails here rather than rendering half a page.
 */
export function toLandingPageView(sources: LandingPageSources): LandingPageView {
  const { page } = sources;
  const proof = siteProofSchema.nullable().catch(null).parse(sources.proofSetting);
  const beforeAfter = page.beforeAfterProject;
  const beforeImage = beforeAfter
    ? image(beforeAfter.beforeImageUrl, `${beforeAfter.clientName} website before the redesign`)
    : null;
  const afterImage = beforeAfter
    ? image(beforeAfter.afterImageUrl, `${beforeAfter.clientName} website after the redesign`)
    : null;

  return landingPageViewSchema.parse({
    slug: page.slug,
    name: page.name,
    noindex: page.noindex,
    seo: page.seo ?? null,
    updatedAt: page.updatedAt.toISOString(),
    content: page.content,
    contact: siteContactSchema.parse(sources.contactSetting),
    reviews: summariseReviews(sources.reviewSources, proof?.npsScore ?? null),
    clients: sources.clientLogos.map((logo) => ({
      name: logo.name,
      logo: image(logo.logoUrl, logo.logoAlt),
    })),
    results: page.results.map((project) => ({
      slug: project.slug,
      clientName: project.clientAlias ?? project.clientName,
      summary: project.summary,
      tags: [project.location, project.industry?.name].filter(
        (tag): tag is string => typeof tag === 'string' && tag.length > 0,
      ),
      image: image(project.coverImageUrl, project.coverImageAlt),
      metrics: outcomeMetricsSchema.parse(project.outcomeMetrics),
    })),
    processSteps: sources.processSteps.map((step) => ({
      title: step.title,
      timing: step.timing,
      heading: step.heading,
      body: step.body,
      youGet: step.youGet,
      weNeed: step.weNeed,
      image: image(step.imageUrl, step.imageAlt),
    })),
    beforeAfter:
      beforeAfter?.status === 'PUBLISHED' && beforeImage && afterImage
        ? {
            clientName: beforeAfter.clientAlias ?? beforeAfter.clientName,
            before: beforeImage,
            after: afterImage,
            metrics: beforeAfterMetricsSchema.parse(beforeAfter.beforeAfterMetrics ?? []),
          }
        : null,
    partners: page.partners.map((partner) => ({
      name: partner.name,
      note: partner.certification ?? partner.tier,
    })),
    technologies: page.technologies.map((technology) => ({ name: technology.name })),
    team: page.team.map((member) => ({
      name: member.name,
      role: member.role,
      bio: member.bio,
      photo: image(member.photo, `${member.name}, ${member.role}`),
    })),
    testimonials: page.testimonials.map((testimonial) => ({
      id: testimonial.id,
      quote: testimonial.quote,
      clientName: testimonial.clientName,
      role: testimonial.role,
      company: testimonial.company,
      rating: testimonial.rating,
      avatar: testimonial.avatarUrl ? { src: testimonial.avatarUrl } : null,
    })),
    pricingTiers: sources.pricingTiers.map((tier) => ({
      name: tier.name,
      priceLabel: tier.priceLabel,
      summary: tier.summary,
      highlighted: tier.highlighted,
    })),
    faqs: page.faqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer })),
  });
}
