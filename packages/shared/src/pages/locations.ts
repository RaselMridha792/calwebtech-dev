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
/** Four to five genuinely local questions (docs/03). */
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

export type LocationCard = z.output<typeof locationCardSchema>;
export type LocationDetailView = z.output<typeof locationDetailViewSchema>;
export type LocationsIndexView = z.output<typeof locationsIndexViewSchema>;
