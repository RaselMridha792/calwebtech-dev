import type { Award, Faq, Partner, Prisma, ReviewSource, Statistic, TeamMember, Technology } from '@calwebtech/db';
import {
  companyAboutViewSchema,
  companyAwardsViewSchema,
  companyPartnersViewSchema,
  companyTeamViewSchema,
  companyTechnologyContentSchema,
  companyTechnologyViewSchema,
  companyTestimonialsViewSchema,
  companyWebUrlSchema,
  siteProofSchema,
  type CompanyAboutView,
  type CompanyAward,
  type CompanyAwardsView,
  type CompanyPartner,
  type CompanyPartnersView,
  type CompanyReviewSummary,
  type CompanyStatistic,
  type CompanyTeamMember,
  type CompanyTeamView,
  type CompanyTechnologyGroup,
  type CompanyTechnologyView,
  type CompanyTestimonial,
  type CompanyTestimonialsView,
  type FaqItem,
} from '@calwebtech/shared';
import { z } from 'zod';
import { image, summariseReviews } from '../landing-pages/landing-page.mapper';

/**
 * Pure functions from records to the company family's page views (docs/10-site-pages.md).
 * Each ends in its view schema's `parse`, so malformed copy or a malformed record fails here
 * rather than rendering half a page. The service passes only published proof; the mappers
 * still leave out testimonials without consent, so a wrong query cannot publish one.
 */

/** Testimonials with the project they belong to, so a quote links to its published case study. */
export const companyTestimonialInclude = {
  project: { select: { slug: true, status: true, deletedAt: true } },
} satisfies Prisma.TestimonialInclude;
export type CompanyTestimonialRecord = Prisma.TestimonialGetPayload<{ include: typeof companyTestimonialInclude }>;

const skillSchema = z.string().trim().min(1).max(60);
const socialSchema = z.object({ label: z.string().trim().min(1).max(40), href: companyWebUrlSchema });

/** The entries of a JSON list that match their shape, up to `max`; anything else is left out. */
function validEntries<T>(value: unknown, schema: z.ZodType<T>, max: number): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry: unknown) => {
      const parsed = schema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    })
    .slice(0, max);
}

const present = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export function statisticView(statistic: Statistic): CompanyStatistic {
  return { value: statistic.value, suffix: statistic.suffix ?? '', label: statistic.label };
}

/**
 * A team member's profile. Skills and profile links that do not match their shape, including
 * links that are not http or https, are left out one by one.
 */
export function teamMemberView(member: TeamMember): CompanyTeamMember {
  return {
    slug: member.slug,
    name: member.name,
    role: member.role,
    bio: present(member.bio),
    photo: image(member.photo, `${member.name}, ${member.role}`),
    skills: validEntries(member.skills, skillSchema, 12),
    socials: validEntries(member.socials, socialSchema, 6),
  };
}

export function awardView(award: Award): CompanyAward {
  return {
    id: award.id,
    name: award.name,
    year: award.year,
    category: present(award.category),
    awardingBody: present(award.awardingBody),
    projectName: present(award.projectName),
    description: present(award.description),
    badge: image(award.badgeUrl, `${award.name} badge`),
  };
}

export function partnerView(partner: Partner): CompanyPartner {
  return {
    id: partner.id,
    name: partner.name,
    logo: image(partner.logoUrl, `${partner.name} logo`),
    tier: present(partner.tier),
    certification: present(partner.certification),
    meaningForClient: present(partner.meaningForClient),
    quote: present(partner.quote),
  };
}

function faqView(faq: Faq): FaqItem {
  return { id: faq.id, question: faq.question, answer: faq.answer };
}

/**
 * A consented testimonial, or nothing without consent. The case study link is set only when
 * the project is published and not deleted.
 */
export function testimonialView(testimonial: CompanyTestimonialRecord): CompanyTestimonial | null {
  if (testimonial.consentAt === null) return null;
  const { project } = testimonial;
  return {
    id: testimonial.id,
    quote: testimonial.quote,
    clientName: testimonial.clientName,
    role: present(testimonial.role),
    company: present(testimonial.company),
    rating: testimonial.rating,
    avatar: testimonial.avatarUrl ? { src: testimonial.avatarUrl } : null,
    source: present(testimonial.source),
    date: testimonial.date ? testimonial.date.toISOString().slice(0, 10) : null,
    featured: testimonial.featured,
    caseStudySlug: project && project.status === 'PUBLISHED' && project.deletedAt === null ? project.slug : null,
  };
}

/** The weighted rating, each platform's count and profile, and the NPS from `site.proof`. */
export function reviewSummary(reviewSources: readonly ReviewSource[], proofSetting: unknown): CompanyReviewSummary {
  const proof = siteProofSchema.nullable().catch(null).parse(proofSetting);
  const summary = summariseReviews(reviewSources, proof?.npsScore ?? null);
  const byPlatform = new Map(reviewSources.map((source) => [source.platform, source]));
  return {
    averageRating: summary.averageRating,
    totalReviews: summary.totalReviews,
    sources: summary.sources.map((source) => {
      const record = byPlatform.get(source.platform);
      const profile = companyWebUrlSchema.safeParse(record?.profileUrl);
      return {
        platform: source.platform,
        rating: source.rating,
        reviewCount: record?.reviewCount ?? 0,
        profileUrl: profile.success ? profile.data : null,
      };
    }),
    npsScore: summary.npsScore,
    npsProjectCount: proof?.npsProjectCount ?? null,
  };
}

/** A category key as a heading when the copy does not name it, e.g. `mobile-and-ai` as "Mobile and ai". */
function categoryLabel(key: string): string {
  const words = key.replace(/[-_]+/g, ' ').trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : 'Other';
}

/**
 * Technologies grouped by category, in the order the copy lists categories, then any others in
 * the order they first appear. Technologies keep their own order within a group.
 */
export function technologyGroups(technologies: readonly Technology[], contentSetting: unknown): CompanyTechnologyGroup[] {
  const content = companyTechnologyContentSchema.safeParse(contentSetting);
  const listed = content.success ? content.data.stack.categories : [];
  const groups = new Map<string, Technology[]>();
  for (const technology of technologies) {
    groups.set(technology.category, [...(groups.get(technology.category) ?? []), technology]);
  }
  const keys = [
    ...listed.map((category) => category.key).filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !listed.some((category) => category.key === key)),
  ];
  return keys.map((key) => {
    const category = listed.find((item) => item.key === key);
    return {
      key,
      label: category?.label ?? categoryLabel(key),
      summary: category?.summary ?? null,
      technologies: (groups.get(key) ?? []).map((technology) => ({
        slug: technology.slug,
        name: technology.name,
        logo: image(technology.logoUrl, `${technology.name} logo`),
        proficiencyNote: present(technology.proficiencyNote),
      })),
    };
  });
}

export interface CompanyAboutSources {
  contentSetting: unknown;
  statistics: Statistic[];
  /** Active team members in order. */
  team: TeamMember[];
  awards: Award[];
  partners: Partner[];
  faqs: Faq[];
}

export function toCompanyAboutView(sources: CompanyAboutSources): CompanyAboutView {
  return companyAboutViewSchema.parse({
    content: sources.contentSetting,
    statistics: sources.statistics.map(statisticView),
    team: sources.team.map(teamMemberView),
    awards: sources.awards.map(awardView),
    partners: sources.partners.map(partnerView),
    faqs: sources.faqs.map(faqView),
  });
}

export interface CompanyTeamSources {
  contentSetting: unknown;
  members: TeamMember[];
  faqs: Faq[];
}

export function toCompanyTeamView(sources: CompanyTeamSources): CompanyTeamView {
  return companyTeamViewSchema.parse({
    content: sources.contentSetting,
    members: sources.members.map(teamMemberView),
    faqs: sources.faqs.map(faqView),
  });
}

export interface CompanyTestimonialsSources {
  contentSetting: unknown;
  proofSetting: unknown;
  reviewSources: ReviewSource[];
  /** Consented testimonials, featured first. */
  testimonials: CompanyTestimonialRecord[];
  faqs: Faq[];
}

export function toCompanyTestimonialsView(sources: CompanyTestimonialsSources): CompanyTestimonialsView {
  return companyTestimonialsViewSchema.parse({
    content: sources.contentSetting,
    reviews: reviewSummary(sources.reviewSources, sources.proofSetting),
    testimonials: sources.testimonials
      .map(testimonialView)
      .filter((testimonial): testimonial is CompanyTestimonial => testimonial !== null),
    faqs: sources.faqs.map(faqView),
  });
}

export interface CompanyAwardsSources {
  contentSetting: unknown;
  awards: Award[];
  partners: Partner[];
  faqs: Faq[];
}

export function toCompanyAwardsView(sources: CompanyAwardsSources): CompanyAwardsView {
  return companyAwardsViewSchema.parse({
    content: sources.contentSetting,
    awards: sources.awards.map(awardView),
    partners: sources.partners.map(partnerView),
    faqs: sources.faqs.map(faqView),
  });
}

export interface CompanyPartnersSources {
  contentSetting: unknown;
  partners: Partner[];
  faqs: Faq[];
}

export function toCompanyPartnersView(sources: CompanyPartnersSources): CompanyPartnersView {
  return companyPartnersViewSchema.parse({
    content: sources.contentSetting,
    partners: sources.partners.map(partnerView),
    faqs: sources.faqs.map(faqView),
  });
}

export interface CompanyTechnologySources {
  contentSetting: unknown;
  /** In category then display order. */
  technologies: Technology[];
  faqs: Faq[];
}

export function toCompanyTechnologyView(sources: CompanyTechnologySources): CompanyTechnologyView {
  return companyTechnologyViewSchema.parse({
    content: sources.contentSetting,
    groups: technologyGroups(sources.technologies, sources.contentSetting),
    faqs: sources.faqs.map(faqView),
  });
}
