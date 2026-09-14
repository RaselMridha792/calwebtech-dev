import { z } from 'zod';
import { LOCATION_TIERS } from '../home-page';
import { testimonialViewSchema } from '../landing-page';
import { imageSchema } from '../media';
import { slugSchema } from '../seo';
import { siteContactSchema } from '../site';
import {
  answerBlockSchema,
  caseStudyCardSchema,
  faqItemSchema,
  pageSeoSchema,
  questionSchema,
  requiredText,
} from './common';

/**
 * The locations family (docs/10-site-pages.md): `/locations/`, grouped by tier, and one
 * page per city (docs/03-page-specs.md, "Location"). A city page is published only where
 * at least sixty per cent of its body can be written honestly for that city
 * (docs/04-seo-keyword-map.md, "Location rules"), so most of its copy lives on the
 * `Location` record: the answer block, the service area statement, the local context, the
 * local industries and clients, and its FAQs. Page copy beyond those columns is
 * `Location.content`, validated by `locationContentSchema`.
 */

export type LocationTier = (typeof LOCATION_TIERS)[number];

/** Setting rows owned by the locations family. */
export const LOCATIONS_SETTING_KEYS = {
  /** Copy of `/locations/`, validated by `locationsIndexContentSchema`. */
  index: 'locations.index',
} as const;

/** Location pages link to at most six other locations (docs/04, "Internal linking"). */
export const LOCATION_NEARBY_MAX = 6;
/**
 * Four to five genuinely local questions (docs/03). The view contract accepts fewer, so an
 * already published page never turns into an error; `locationCompleteness` holds the
 * minimum for publishing, the editor and the API's warning.
 */
export const LOCATION_FAQ_MIN = 4;
export const LOCATION_FAQ_MAX = 5;
export const LOCATION_CASE_STUDY_MAX = 3;
export const LOCATION_SERVICE_MAX = 6;
export const LOCATION_PLACES_MAX = 12;

const nullableIntro = requiredText(600).nullable().default(null);

/** A section heading, written as the question a buyer types, and an optional introduction. */
const locationSectionCopySchema = z.object({ heading: questionSchema(), intro: nullableIntro });

const locationPointSchema = z.object({ title: requiredText(80), body: requiredText(600) });

/**
 * `Location.content`. Every field is optional, so a record with only its columns still
 * renders: the sections built from columns take a default heading from
 * `locationSectionDefaults`, and sections that exist only in this copy are left out.
 */
export const locationContentSchema = z.object({
  /** A photograph of the city: the card on `/locations/` and the backdrop of the hero. */
  image: imageSchema.nullable().default(null),
  /** A line under the answer block and the service area statement. */
  heroIntro: requiredText(400).nullable().default(null),
  /** Heading for the local context, `localContext` and `localIndustries`. */
  localContext: locationSectionCopySchema.nullable().default(null),
  /** Heading for `localClients`. */
  clients: locationSectionCopySchema.nullable().default(null),
  /** Services framed for this market; each slug must be a published service. */
  services: locationSectionCopySchema
    .extend({
      items: z
        .array(z.object({ slug: slugSchema, body: requiredText(400) }))
        .min(1)
        .max(LOCATION_SERVICE_MAX),
    })
    .nullable()
    .default(null),
  /** Published projects shown as case studies, in this order. */
  caseStudies: locationSectionCopySchema
    .extend({ projectSlugs: z.array(slugSchema).min(1).max(LOCATION_CASE_STUDY_MAX) })
    .nullable()
    .default(null),
  /** How we work with clients here: meeting model, timezone, response. */
  workingModel: locationSectionCopySchema
    .extend({ points: z.array(locationPointSchema).min(2).max(4) })
    .nullable()
    .default(null),
  /** Heading for the service area and address, and the places covered. */
  serviceArea: locationSectionCopySchema.nullable().default(null),
  places: z.array(requiredText(80)).max(LOCATION_PLACES_MAX).default([]),
  /** A photograph beside the service area and address. */
  areaImage: imageSchema.nullable().default(null),
  /**
   * The local quote: the first consented testimonial of this project. Only a client in
   * this market counts, so it is chosen here rather than taken from the case studies.
   */
  testimonial: z.object({ heading: questionSchema(), projectSlug: slugSchema }).nullable().default(null),
  /** Headings for the links to other locations and for the FAQs. */
  nearby: locationSectionCopySchema.nullable().default(null),
  faq: locationSectionCopySchema.nullable().default(null),
  /** The band with the local number. */
  cta: z
    .object({ heading: questionSchema(120), body: requiredText(300).nullable().default(null) })
    .nullable()
    .default(null),
});

export type LocationContent = z.output<typeof locationContentSchema>;
export type LocationContentInput = z.input<typeof locationContentSchema>;

/** Headings for sections built from a record's columns when its content sets none. */
export function locationSectionDefaults(city: string) {
  return {
    localContext: `What is the market like for businesses in ${city}?`,
    clients: `Who have we worked with in and around ${city}?`,
    serviceArea: `Which areas around ${city} do we cover?`,
    nearby: `Where else do we work besides ${city}?`,
    faq: `What do ${city} businesses ask before hiring us?`,
    cta: `Planning a website project in ${city}?`,
  };
}

const citySchema = requiredText(120);
const stateSchema = requiredText(40).nullable();
const addressSchema = requiredText(300).nullable();

/** A location as a card or a link: the index page, nearby links, the sitemap. */
export const locationCardSchema = z.object({
  slug: slugSchema,
  city: citySchema,
  state: stateSchema,
  tier: z.enum(LOCATION_TIERS),
  serviceArea: requiredText(400).nullable(),
  /** Street and locality on separate lines. */
  address: addressSchema,
  image: imageSchema.nullable(),
  updatedAt: z.iso.datetime(),
});

const sectionViewSchema = z.object({ heading: questionSchema(), intro: requiredText(600).nullable() });

/** What `GET /pages/locations/:slug` returns. */
export const locationDetailViewSchema = z.object({
  slug: slugSchema,
  city: citySchema,
  state: stateSchema,
  tier: z.enum(LOCATION_TIERS),
  seo: pageSeoSchema,
  updatedAt: z.iso.datetime(),
  answerBlock: answerBlockSchema,
  /** The service area statement in the hero. */
  serviceArea: requiredText(400).nullable(),
  heroIntro: requiredText(400).nullable(),
  image: imageSchema.nullable(),
  address: addressSchema,
  /** The location's own number when it has one, otherwise the company's. */
  contact: siteContactSchema,
  localContext: sectionViewSchema.extend({
    paragraphs: z.array(requiredText(2000)).min(1),
    industries: z.array(requiredText(80)).max(12),
  }),
  /** Clients served here, from `localClients`. */
  clients: sectionViewSchema.extend({ names: z.array(requiredText(120)).min(1).max(12) }).nullable(),
  /** Published case studies chosen for this market; rendered beside the clients. */
  caseStudies: sectionViewSchema
    .extend({ items: z.array(caseStudyCardSchema).min(1).max(LOCATION_CASE_STUDY_MAX) })
    .nullable(),
  services: sectionViewSchema
    .extend({
      items: z
        .array(z.object({ slug: slugSchema, title: requiredText(120), body: requiredText(400) }))
        .min(1)
        .max(LOCATION_SERVICE_MAX),
    })
    .nullable(),
  workingModel: sectionViewSchema.extend({ points: z.array(locationPointSchema).min(2).max(4) }).nullable(),
  serviceAreaSection: sectionViewSchema
    .extend({ places: z.array(requiredText(80)).max(LOCATION_PLACES_MAX), image: imageSchema.nullable() })
    .nullable(),
  testimonial: z.object({ heading: questionSchema(), item: testimonialViewSchema }).nullable(),
  nearby: sectionViewSchema
    .extend({
      items: z
        .array(locationCardSchema.pick({ slug: true, city: true, state: true, serviceArea: true }))
        .min(1)
        .max(LOCATION_NEARBY_MAX),
    })
    .nullable(),
  faq: sectionViewSchema.extend({ items: z.array(faqItemSchema).min(1).max(LOCATION_FAQ_MAX) }).nullable(),
  cta: z.object({ heading: questionSchema(120), body: requiredText(300).nullable() }),
});

/** Copy of `/locations/`, stored in the `locations.index` setting. */
export const locationsIndexContentSchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(80),
  answerBlock: answerBlockSchema,
  intro: requiredText(400).nullable().default(null),
  /** A heading and introduction per tier; a tier without published locations is left out. */
  tiers: z.object({
    TIER_1: locationSectionCopySchema,
    TIER_2: locationSectionCopySchema,
    TIER_3: locationSectionCopySchema,
  }),
  /** Shown instead of the list while no location is published. */
  empty: requiredText(200),
  /** How locations are chosen and how remote clients are served. */
  approach: locationSectionCopySchema
    .extend({ points: z.array(locationPointSchema).min(1).max(4) })
    .nullable()
    .default(null),
});

export type LocationsIndexContent = z.output<typeof locationsIndexContentSchema>;
export type LocationsIndexContentInput = z.input<typeof locationsIndexContentSchema>;

/** What `GET /pages/locations` returns. */
export const locationsIndexViewSchema = z.object({
  content: locationsIndexContentSchema,
  /** Tiers in order, each with at least one published location. */
  groups: z.array(
    z.object({
      tier: z.enum(LOCATION_TIERS),
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      locations: z.array(locationCardSchema).min(1),
    }),
  ),
});

/** A city page needs at least this share of its body copy to be its own (docs/04, "Location rules"). */
export const LOCATION_UNIQUE_SHARE_MIN = 0.6;

/** Runs of four words, with every place name written the same way. */
function locationShingles(text: string, places: readonly string[]): Set<string> {
  let normalised = text.toLowerCase();
  // Longest names first, so "West Sacramento" is replaced before "Sacramento".
  for (const place of [...places].sort((a, b) => b.length - a.length)) {
    const name = place.trim().toLowerCase();
    if (name) normalised = normalised.replaceAll(name, ' place ');
  }
  const words = normalised.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const runs = new Set<string>();
  for (let start = 0; start + 4 <= words.length; start += 1) runs.add(words.slice(start, start + 4).join(' '));
  return runs;
}

/**
 * The share of a city page's body copy, from 0 to 1, that no other city page repeats:
 * the runs of four words in `own` that appear in none of `others`. City and place names
 * are treated as one word, so a page cloned from another with the city swapped scores
 * close to zero. The snapshot test gates on it, and the location editor can warn with it
 * before a record is published (docs/06-build-plan.md, 3.1).
 */
export function locationUniqueShare(own: string, others: readonly string[], places: readonly string[]): number {
  const runs = locationShingles(own, places);
  if (runs.size === 0) return 0;
  const repeated = new Set(others.flatMap((other) => [...locationShingles(other, places)]));
  const shared = [...runs].filter((run) => repeated.has(run)).length;
  return 1 - shared / runs.size;
}

/** The body copy a visitor reads on a city page, without the headings the template shares. */
export function locationBodyCopy(view: LocationDetailView): string {
  return [
    view.answerBlock,
    view.serviceArea,
    view.heroIntro,
    ...view.localContext.paragraphs,
    ...view.localContext.industries,
    view.clients?.intro,
    ...(view.clients?.names ?? []),
    view.caseStudies?.intro,
    view.services?.intro,
    ...(view.services?.items.map((item) => item.body) ?? []),
    view.workingModel?.intro,
    ...(view.workingModel?.points.flatMap((point) => [point.title, point.body]) ?? []),
    view.serviceAreaSection?.intro,
    ...(view.serviceAreaSection?.places ?? []),
    view.nearby?.intro,
    ...(view.faq?.items.flatMap((item) => [item.question, item.answer]) ?? []),
    view.cta.body,
  ]
    .filter((part): part is string => typeof part === 'string')
    .join('\n');
}

/** What a city page still lacks before it counts as complete (docs/06-build-plan.md, 3.1). */
export interface LocationCompleteness {
  complete: boolean;
  faqCount: number;
  /** Null when no other city page was given to compare with. */
  uniqueShare: number | null;
  /** One plain sentence per shortfall, for the editor and the API log. */
  issues: string[];
}

export interface LocationCompletenessOptions {
  /** The other city pages, for the unique share. Without them only the FAQs are checked. */
  others?: readonly LocationDetailView[];
  /**
   * Place names beyond each page's city and service area places, such as state names.
   * Whole names only: a short code like "CA" would also match inside ordinary words.
   */
  places?: readonly string[];
}

/**
 * Whether a city page meets the location rules beyond its contract: four to five local
 * FAQs, and at least sixty per cent of its body its own when other pages are given. The
 * location publish endpoint rejects a record that fails it, the editor warns with it, the
 * API logs a warning when a published record falls short, and the snapshot test gates on it.
 */
export function locationCompleteness(view: LocationDetailView, options: LocationCompletenessOptions = {}): LocationCompleteness {
  const issues: string[] = [];
  const faqCount = view.faq?.items.length ?? 0;
  if (faqCount < LOCATION_FAQ_MIN) {
    issues.push(`It has ${String(faqCount)} FAQs; a city page needs ${String(LOCATION_FAQ_MIN)} to ${String(LOCATION_FAQ_MAX)} local questions.`);
  }

  let uniqueShare: number | null = null;
  const others = (options.others ?? []).filter((other) => other.slug !== view.slug);
  if (others.length > 0) {
    const places = [
      ...[view, ...others].flatMap((page) => [page.city, ...(page.serviceAreaSection?.places ?? [])]),
      ...(options.places ?? []),
    ];
    uniqueShare = locationUniqueShare(locationBodyCopy(view), others.map(locationBodyCopy), places);
    if (uniqueShare < LOCATION_UNIQUE_SHARE_MIN) {
      issues.push(
        `Only ${String(Math.round(uniqueShare * 100))}% of its body copy is its own; a city page needs ${String(LOCATION_UNIQUE_SHARE_MIN * 100)}%.`,
      );
    }
  }

  return { complete: issues.length === 0, faqCount, uniqueShare, issues };
}

export type LocationCard = z.output<typeof locationCardSchema>;
export type LocationDetailView = z.output<typeof locationDetailViewSchema>;
export type LocationsIndexView = z.output<typeof locationsIndexViewSchema>;
