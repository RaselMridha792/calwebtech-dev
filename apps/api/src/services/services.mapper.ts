import type { Prisma, Testimonial } from '@calwebtech/db';
import {
  SERVICE_CASE_STUDY_LIMIT,
  SERVICE_ENQUIRY_ANCHOR,
  SERVICE_FAQ_LIMIT,
  SERVICE_RELATED_LIMIT,
  faqItemSchema,
  formatServicePrice,
  groupHeadingFallback,
  seoSchema,
  serviceContentSchema,
  serviceDetailViewSchema,
  servicePriceSchema,
  servicesIndexContentSchema,
  servicesIndexViewSchema,
  timedStepSchema,
  workFilterPath,
  type CaseStudyCard,
  type FaqItem,
  type ServiceCard,
  type ServiceContent,
  type ServiceDetailView,
  type ServicesIndexView,
  type TestimonialView,
} from '@calwebtech/shared';
import { z } from 'zod';
import { CONSENTED } from '../common/published';
import { image, outcomeMetricsSchema } from '../landing-pages/landing-page.mapper';
import { DEFAULT_ACKNOWLEDGEMENT } from '../leads/leads.service';

/**
 * Relations loaded for a service page. Unpublished projects and industries and unconsented
 * testimonials are filtered out here, so no mapper can show them.
 */
export const serviceDetailInclude = {
  category: { select: { slug: true, name: true } },
  technologies: { orderBy: [{ order: 'asc' }, { name: 'asc' }] },
  projects: {
    where: { status: 'PUBLISHED', deletedAt: null },
    include: {
      industry: { select: { name: true } },
      testimonials: { where: CONSENTED, orderBy: [{ featured: 'desc' }, { date: 'desc' }] },
    },
    orderBy: [{ featured: 'desc' }, { year: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
  },
  industries: { where: { status: 'PUBLISHED' }, orderBy: [{ order: 'asc' }, { name: 'asc' }] },
  faqs: { orderBy: { order: 'asc' } },
} satisfies Prisma.ServiceInclude;
export type ServiceDetailRecord = Prisma.ServiceGetPayload<{ include: typeof serviceDetailInclude }>;

/** The columns a service card needs: the index, related services and the sitemap. */
export const serviceCardSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  startingPriceBand: true,
  content: true,
  categoryId: true,
  updatedAt: true,
} satisfies Prisma.ServiceSelect;
export type ServiceCardRecord = Prisma.ServiceGetPayload<{ select: typeof serviceCardSelect }>;

export interface ServiceDetailSources {
  service: ServiceDetailRecord;
  /** Other published services, in display order, for the related services section. */
  others: readonly ServiceCardRecord[];
}

export interface ServicesIndexSources {
  contentSetting: unknown;
  categories: readonly { id: string; slug: string; name: string; description: string | null }[];
  /** Published services in display order. */
  services: readonly ServiceCardRecord[];
}

const TECHNOLOGY_CATEGORY_LABELS: Partial<Record<string, string>> = {
  frontend: 'Front end',
  backend: 'Back end',
  cms: 'Content',
  ecommerce: 'Ecommerce',
  infrastructure: 'Infrastructure',
  tooling: 'Tooling',
};

const deliverablesSchema = z.array(z.string().trim().min(1)).nullable();
const processStepsSchema = z.array(timedStepSchema).nullable();

/**
 * The template's copy for a service published without `content`, so a new record renders a
 * complete page with no deploy (docs/06, Task 1.3). Sections only the record's copy can
 * supply are left out. The success copy is the one the confirmation email falls back to.
 */
export function templateServiceContent(service: { shortDescription: string }): ServiceContent {
  return {
    hero: { outcome: service.shortDescription, primaryCtaLabel: 'Get a quote', secondaryCta: null },
    price: null,
    problem: null,
    included: { heading: 'What is included?', intro: null },
    process: { heading: 'How does the work run, step by step?', intro: null, backdrop: null },
    technology: { heading: 'Which technologies does it use?', intro: null },
    proof: { heading: 'What results has this work delivered?', intro: null, linkLabel: 'See all related work' },
    comparison: null,
    pricing: null,
    industries: { heading: 'Which industries is it built for?', intro: null },
    testimonial: { heading: 'What do clients say about the work?' },
    faq: { heading: 'What do buyers ask before they start?', intro: null },
    enquiry: {
      heading: 'How do I get a quote?',
      intro: 'Tell us what you need and someone from our team will reply to you by email.',
      submitLabel: 'Send my enquiry',
      footnote: null,
    },
    formSuccess: DEFAULT_ACKNOWLEDGEMENT,
    related: { heading: 'Which services often go with it?', intro: null },
  };
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

/** The structured price in `content`, or else the `startingPriceBand` column as text. */
function priceView(content: unknown, startingPriceBand: string | null): ServiceDetailView['price'] {
  const stored = typeof content === 'object' && content !== null && 'price' in content ? content.price : null;
  const amount = servicePriceSchema.safeParse(stored);
  if (amount.success) return { label: formatServicePrice(amount.data), amount: amount.data };
  return present(startingPriceBand) ? { label: startingPriceBand.trim(), amount: null } : null;
}

export function serviceCard(service: ServiceCardRecord): ServiceCard {
  return {
    slug: service.slug,
    title: service.title,
    summary: service.shortDescription,
    priceLabel: priceView(service.content, service.startingPriceBand)?.label ?? null,
    updatedAt: service.updatedAt.toISOString(),
  };
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

/** A case study card, or nothing when the project has no outcome figures to show. */
function caseStudyCard(project: ServiceDetailRecord['projects'][number]): CaseStudyCard | null {
  const metrics = outcomeMetricsSchema.safeParse(project.outcomeMetrics);
  if (!metrics.success || metrics.data.length === 0) return null;
  return {
    slug: project.slug,
    clientName: project.clientAlias ?? project.clientName,
    summary: project.summary,
    tags: [project.location, project.segment, project.industry?.name].filter(present).slice(0, 4),
    image: image(project.coverImageUrl, project.coverImageAlt),
    metrics: metrics.data.slice(0, 3),
  };
}

/** Same-category services first, then the rest, in display order. */
function relatedServices(service: ServiceDetailRecord, others: readonly ServiceCardRecord[]): ServiceCardRecord[] {
  const candidates = others.filter((other) => other.id !== service.id);
  const sameCategory = service.categoryId ? candidates.filter((other) => other.categoryId === service.categoryId) : [];
  const rest = candidates.filter((other) => !sameCategory.includes(other));
  return [...sameCategory, ...rest].slice(0, SERVICE_RELATED_LIMIT);
}

/**
 * Builds the public view of one service page and validates it against the shared contract,
 * so malformed copy or a malformed record fails here rather than rendering half a page.
 * FAQs that are not written as questions are left out rather than failing the page.
 */
export function toServiceDetailView({ service, others }: ServiceDetailSources): ServiceDetailView {
  const copy = service.content === null ? templateServiceContent(service) : serviceContentSchema.parse(service.content);
  const seo = seoSchema.nullable().parse(service.seo);
  const deliverables = deliverablesSchema.parse(service.deliverables) ?? [];
  const steps = processStepsSchema.parse(service.processSteps) ?? [];

  const caseStudies = service.projects
    .map(caseStudyCard)
    .filter((card): card is CaseStudyCard => card !== null)
    .slice(0, SERVICE_CASE_STUDY_LIMIT);
  const quotes = service.projects.flatMap((project) => project.testimonials);
  const quote = quotes.find((testimonial) => testimonial.featured) ?? quotes[0] ?? null;
  const faqs = service.faqs
    .map((faq) => faqItemSchema.safeParse({ id: faq.id, question: faq.question, answer: faq.answer }))
    .flatMap((result): FaqItem[] => (result.success ? [result.data] : []))
    .slice(0, SERVICE_FAQ_LIMIT);
  const related = relatedServices(service, others);

  return serviceDetailViewSchema.parse({
    slug: service.slug,
    title: service.title,
    updatedAt: service.updatedAt.toISOString(),
    seo: {
      title: seo?.title ?? clip(service.title, 60),
      description: seo?.description ?? clip(service.shortDescription, 155),
      ogImage: seo?.ogImage ?? null,
    },
    category: service.category,
    answerBlock: service.answerBlock,
    hero: {
      outcome: copy.hero.outcome,
      primaryCta: { label: copy.hero.primaryCtaLabel, href: `#${SERVICE_ENQUIRY_ANCHOR}` },
      secondaryCta: copy.hero.secondaryCta,
      backdrop: present(service.heroMediaUrl) ? { src: service.heroMediaUrl } : null,
    },
    price: priceView(service.content, service.startingPriceBand),
    problem: copy.problem
      ? {
          heading: copy.problem.heading,
          intro: present(service.problemStatement) ? service.problemStatement : null,
          situations: copy.problem.situations,
        }
      : null,
    included: deliverables.length > 0 ? { ...copy.included, items: deliverables } : null,
    process: steps.length > 0 ? { ...copy.process, steps } : null,
    technology:
      service.technologies.length > 0
        ? {
            ...copy.technology,
            items: service.technologies.map((technology) => ({
              name: technology.name,
              category: TECHNOLOGY_CATEGORY_LABELS[technology.category] ?? null,
            })),
          }
        : null,
    proof:
      caseStudies.length > 0
        ? {
            heading: copy.proof.heading,
            intro: copy.proof.intro,
            caseStudies,
            link: { label: copy.proof.linkLabel, href: workFilterPath({ service: service.slug }) },
          }
        : null,
    comparison: copy.comparison,
    pricing: copy.pricing,
    industries:
      service.industries.length > 0
        ? {
            ...copy.industries,
            items: service.industries.map((industry) => ({
              slug: industry.slug,
              name: industry.name,
              line: present(industry.heroCopy) ? clip(industry.heroCopy, 300) : null,
            })),
          }
        : null,
    testimonial: quote ? { heading: copy.testimonial.heading, quote: testimonialView(quote) } : null,
    faq: faqs.length > 0 ? { ...copy.faq, items: faqs } : null,
    enquiry: { ...copy.enquiry, success: copy.formSuccess },
    related: related.length > 0 ? { ...copy.related, items: related.map(serviceCard) } : null,
  });
}

/**
 * `/services/`: the `services.index` copy and every published service, grouped by category
 * in category order, with uncategorised services in a last group. Empty categories are left out.
 * Each group's heading is the question the copy gives its category, or a question built from its name.
 */
export function toServicesIndexView({ contentSetting, categories, services }: ServicesIndexSources): ServicesIndexView {
  const content = servicesIndexContentSchema.parse(contentSetting);
  const known = new Set(categories.map((category) => category.id));
  const headings = new Map(Object.entries(content.groupHeadings));
  const groups: ServicesIndexView['groups'] = categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    heading: headings.get(category.slug) ?? groupHeadingFallback(category.name),
    description: present(category.description) ? category.description : null,
    services: services.filter((service) => service.categoryId === category.id).map(serviceCard),
  }));
  const other = services.filter((service) => service.categoryId === null || !known.has(service.categoryId));
  if (other.length > 0) {
    groups.push({
      slug: null,
      name: content.otherGroupName,
      heading: content.otherGroupHeading ?? groupHeadingFallback(content.otherGroupName),
      description: null,
      services: other.map(serviceCard),
    });
  }
  return servicesIndexViewSchema.parse({ content, groups: groups.filter((group) => group.services.length > 0) });
}
