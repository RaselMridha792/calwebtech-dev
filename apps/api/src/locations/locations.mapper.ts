import type { Location, Prisma, Testimonial } from '@calwebtech/db';
import {
  LOCATION_CASE_STUDY_MAX,
  LOCATION_FAQ_MAX,
  LOCATION_NEARBY_MAX,
  LOCATION_TIERS,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  locationContentSchema,
  locationDetailViewSchema,
  locationSectionDefaults,
  locationsIndexContentSchema,
  locationsIndexViewSchema,
  seoSchema,
  siteContactSchema,
  type CaseStudyCard,
  type LocationCard,
  type LocationContent,
  type LocationDetailView,
  type LocationsIndexView,
  type TestimonialView,
} from '@calwebtech/shared';
import { z } from 'zod';
import { CONSENTED } from '../common/published';
import { image, outcomeMetricsSchema } from '../landing-pages/landing-page.mapper';

/** A city page's FAQs, in order. */
export const locationDetailInclude = {
  faqs: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.LocationInclude;
export type LocationDetailRecord = Prisma.LocationGetPayload<{ include: typeof locationDetailInclude }>;

/** Relations of a project shown on a city page: its industry tag and one consented quote. */
export const locationProjectInclude = {
  industry: { select: { name: true } },
  testimonials: { where: CONSENTED, orderBy: [{ featured: 'desc' }, { date: 'desc' }], take: 1 },
} satisfies Prisma.ProjectInclude;
export type LocationProjectRecord = Prisma.ProjectGetPayload<{ include: typeof locationProjectInclude }>;

/** The other locations a page links to. */
export type NearbyLocationRecord = Pick<Location, 'id' | 'slug' | 'city' | 'state' | 'serviceArea'>;

export interface LocationDetailSources {
  location: LocationDetailRecord;
  contactSetting: unknown;
  /** Published services among those the page's content names. */
  services: readonly { slug: string; title: string }[];
  /** Published projects among those the page's content names. */
  projects: readonly LocationProjectRecord[];
  /** Published locations among the record's `nearbyIds`. */
  nearby: readonly NearbyLocationRecord[];
}

export interface LocationsIndexSources {
  contentSetting: unknown;
  /** Published locations, by tier then city. */
  locations: readonly Location[];
}

const stringListSchema = z.array(z.string().trim().min(1));

function stringList(value: unknown): string[] {
  const parsed = stringListSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * An optional column as the contract wants it: null when an editor left it blank, so a
 * cleared State or service area never fails a page, least of all another city's page.
 */
function optionalText(value: string | null | undefined): string | null {
  return present(value) ? value : null;
}

/** Copy shortened to `max` characters at a word boundary, for SEO fallbacks. */
function clamp(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > max / 2 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.–-]+$/u, '')}…`;
}

/** The page copy on a record. A record without content still renders from its columns. */
export function locationContent(location: Pick<Location, 'content'>): LocationContent {
  return locationContentSchema.parse(location.content ?? {});
}

/** Which services, projects and locations a city page names, so the service loads only those. */
export function locationReferences(location: Pick<Location, 'content' | 'nearbyIds'>): {
  serviceSlugs: string[];
  projectSlugs: string[];
  nearbyIds: string[];
} {
  const content = locationContent(location);
  const projectSlugs = [...(content.caseStudies?.projectSlugs ?? []), ...(content.testimonial ? [content.testimonial.projectSlug] : [])];
  return {
    serviceSlugs: content.services?.items.map((item) => item.slug) ?? [],
    projectSlugs: [...new Set(projectSlugs)],
    nearbyIds: stringList(location.nearbyIds),
  };
}

/**
 * The location's own number in the E.164 form a `tel:` link needs, or null when it cannot
 * be read as one. US numbers may be written without the country code.
 */
export function locationPhoneE164(phone: string | null): string | null {
  if (!present(phone)) return null;
  const digits = phone.replace(/\D/g, '');
  const candidate = phone.trim().startsWith('+') ? `+${digits}` : digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(candidate) ? candidate : null;
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
function caseStudyCard(project: LocationProjectRecord): CaseStudyCard | null {
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

function cardImage(location: Pick<Location, 'content'>): LocationCard['image'] {
  const content = locationContentSchema.safeParse(location.content ?? {});
  return content.success ? content.data.image : null;
}

/**
 * Builds a city page and validates it against the shared contract, so malformed copy or a
 * record without its local context fails here rather than rendering a thin page. Proof
 * comes only from published records: services, projects with figures, a consented quote
 * from the project the copy names as local, and published nearby locations.
 */
export function toLocationDetailView(sources: LocationDetailSources): LocationDetailView {
  const { location } = sources;
  const content = locationContent(location);
  const defaults = locationSectionDefaults(location.city);
  const seo = seoSchema.nullable().catch(null).parse(location.seo ?? null);
  const siteContact = siteContactSchema.parse(sources.contactSetting);
  const phoneE164 = locationPhoneE164(location.phone);

  const servicesBySlug = new Map(sources.services.map((service) => [service.slug, service]));
  const projectsBySlug = new Map(sources.projects.map((project) => [project.slug, project]));
  const nearbyById = new Map(sources.nearby.map((nearby) => [nearby.id, nearby]));

  const serviceItems =
    content.services?.items.flatMap((item) => {
      const service = servicesBySlug.get(item.slug);
      return service ? [{ slug: service.slug, title: service.title, body: item.body }] : [];
    }) ?? [];

  const caseStudies = (content.caseStudies?.projectSlugs ?? [])
    .map((slug) => projectsBySlug.get(slug))
    .flatMap((project) => (project ? [caseStudyCard(project)] : []))
    .filter((card): card is CaseStudyCard => card !== null)
    .slice(0, LOCATION_CASE_STUDY_MAX);

  const quote = content.testimonial ? projectsBySlug.get(content.testimonial.projectSlug)?.testimonials[0] : undefined;

  const nearby = stringList(location.nearbyIds)
    .filter((id) => id !== location.id)
    .map((id) => nearbyById.get(id))
    .filter((record): record is NearbyLocationRecord => record !== undefined)
    .slice(0, LOCATION_NEARBY_MAX)
    .map((record) => ({
      slug: record.slug,
      city: record.city,
      state: optionalText(record.state),
      serviceArea: optionalText(record.serviceArea),
    }));

  const clients = stringList(location.localClients);
  const faqs = location.faqs
    .slice(0, LOCATION_FAQ_MAX)
    .map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }));

  return locationDetailViewSchema.parse({
    slug: location.slug,
    city: location.city,
    state: optionalText(location.state),
    tier: location.tier,
    seo: {
      title: seo?.title ?? clamp(`Web design and development in ${location.city}`, SEO_TITLE_MAX),
      description: seo?.description ?? clamp(location.answerBlock, SEO_DESCRIPTION_MAX),
      ogImage: seo?.ogImage ?? content.image?.src ?? null,
    },
    updatedAt: location.updatedAt.toISOString(),
    answerBlock: location.answerBlock,
    serviceArea: optionalText(location.serviceArea),
    heroIntro: content.heroIntro,
    image: content.image,
    address: optionalText(location.address),
    contact: phoneE164 && location.phone ? { ...siteContact, phone: location.phone.trim(), phoneE164 } : siteContact,
    localContext: {
      heading: content.localContext?.heading ?? defaults.localContext,
      intro: content.localContext?.intro ?? null,
      paragraphs: location.localContext
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
      industries: stringList(location.localIndustries),
    },
    clients:
      clients.length > 0
        ? { heading: content.clients?.heading ?? defaults.clients, intro: content.clients?.intro ?? null, names: clients }
        : null,
    caseStudies:
      content.caseStudies && caseStudies.length > 0
        ? { heading: content.caseStudies.heading, intro: content.caseStudies.intro, items: caseStudies }
        : null,
    services:
      content.services && serviceItems.length > 0
        ? { heading: content.services.heading, intro: content.services.intro, items: serviceItems }
        : null,
    workingModel: content.workingModel,
    serviceAreaSection:
      present(location.address) || content.places.length > 0
        ? {
            heading: content.serviceArea?.heading ?? defaults.serviceArea,
            intro: content.serviceArea?.intro ?? null,
            places: content.places,
            image: content.areaImage,
          }
        : null,
    testimonial: content.testimonial && quote ? { heading: content.testimonial.heading, item: testimonialView(quote) } : null,
    nearby:
      nearby.length > 0
        ? { heading: content.nearby?.heading ?? defaults.nearby, intro: content.nearby?.intro ?? null, items: nearby }
        : null,
    faq:
      faqs.length > 0 ? { heading: content.faq?.heading ?? defaults.faq, intro: content.faq?.intro ?? null, items: faqs } : null,
    cta: content.cta ?? { heading: defaults.cta, body: null },
  });
}

/**
 * Builds `/locations/` from its copy and the published locations, grouped by tier in
 * order. Tiers without a published location are left out, so the page shows its empty
 * line when nothing is published.
 */
export function toLocationsIndexView(sources: LocationsIndexSources): LocationsIndexView {
  const content = locationsIndexContentSchema.parse(sources.contentSetting);
  const groups = LOCATION_TIERS.map((tier) => ({
    tier,
    heading: content.tiers[tier].heading,
    intro: content.tiers[tier].intro,
    locations: sources.locations
      .filter((location) => location.tier === tier)
      .map((location) => ({
        slug: location.slug,
        city: location.city,
        state: optionalText(location.state),
        tier: location.tier,
        serviceArea: optionalText(location.serviceArea),
        address: optionalText(location.address),
        image: cardImage(location),
        updatedAt: location.updatedAt.toISOString(),
      })),
  })).filter((group) => group.locations.length > 0);

  return locationsIndexViewSchema.parse({ content, groups });
}
