import { z } from 'zod';
import { linkSchema } from '../home-page';
import { testimonialViewSchema } from '../landing-page';
import { decorativeImageSchema, imageSchema } from '../media';
import { slugSchema } from '../seo';
import {
  answerBlockSchema,
  caseStudyCardSchema,
  faqItemSchema,
  metricSchema,
  pageSeoSchema,
  questionSchema,
  requiredText,
} from './common';

/**
 * The industries family (docs/10-site-pages.md): `/industries/` and `/industries/<slug>/`,
 * per docs/03-page-specs.md "Industry detail". Copy lives in `Industry.content` and the
 * `industries.index` setting; proof (case studies, figures, testimonials, FAQs) comes from
 * the Project, Testimonial and Faq content types.
 */

export const INDUSTRY_SETTING_KEYS = {
  /** Copy of `/industries/`, validated by `industriesIndexContentSchema`. */
  index: 'industries.index',
} as const;

/** Most case studies an industry page shows; the rest are one click away on /work/. */
export const INDUSTRY_CASE_STUDY_LIMIT = 3;
/** Most result figures in an industry's metrics band. */
export const INDUSTRY_METRIC_LIMIT = 6;
/** Most matched services on an industry page. */
export const INDUSTRY_SERVICE_LIMIT = 6;
/** Most FAQs on an industry page; docs/03 asks for five or six. */
export const INDUSTRY_FAQ_LIMIT = 8;

const industryPointSchema = z.object({ title: requiredText(80), body: requiredText(400) });

const sectionIntroSchema = requiredText(400).nullable().default(null);

/**
 * Page copy of one industry, stored in `Industry.content`. Section order and layout are
 * fixed by the template; this is not a page builder. A section whose copy is missing is
 * left out, except where the records alone can carry it (services, case studies, FAQs).
 */
export const industryContentSchema = z.object({
  /** The H1, written for the page's target query, e.g. "Manufacturing website design". */
  title: requiredText(80),
  /** The industry's photograph, on its card on the index. The share image when SEO names none. */
  image: imageSchema.nullable().default(null),
  hero: z.object({
    intro: requiredText(400),
    primaryCta: linkSchema.nullable().default(null),
    secondaryCta: linkSchema.nullable().default(null),
    /** What the build handles for this sector, as check marks beside the hero copy. */
    highlights: z.array(requiredText(120)).max(4).default([]),
    /** A photograph under the hero's overlays. Null leaves the ink ground plain. */
    backdrop: decorativeImageSchema.nullable().default(null),
  }),
  /** Four problems in the sector's own vocabulary. */
  painPoints: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    items: z.array(industryPointSchema).length(4),
  }),
  /** The matched services, each described for this sector. Keyed by service slug. */
  services: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    items: z.array(z.object({ slug: slugSchema, body: requiredText(400) })).max(INDUSTRY_SERVICE_LIMIT),
  }),
  /** Compliance or integration notes the build has to get right. Null leaves the section out. */
  compliance: z
    .object({
      heading: questionSchema(),
      intro: sectionIntroSchema,
      notes: z.array(industryPointSchema).min(1).max(4),
    })
    .nullable()
    .default(null),
  caseStudies: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    /** Label of the link to /work/ filtered by this industry. */
    linkLabel: requiredText(60),
  }),
  results: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    /** How the figures were measured, under them. */
    note: sectionIntroSchema,
  }),
  integrations: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    items: z.array(z.object({ name: requiredText(80), body: requiredText(300) })).min(1).max(12),
  }),
  faq: z.object({ heading: questionSchema(), intro: sectionIntroSchema }),
});
export type IndustryContent = z.output<typeof industryContentSchema>;
export type IndustryContentInput = z.input<typeof industryContentSchema>;

/** A card for an industry: on the index, and wherever another page lists industries. */
export const industryCardSchema = z.object({
  slug: slugSchema,
  name: requiredText(80),
  /** One line on what the build handles for this sector (`Industry.heroCopy`). */
  line: requiredText(200).nullable(),
  image: imageSchema.nullable(),
});

/** Copy of `/industries/`, stored in the `industries.index` setting. */
export const industriesIndexContentSchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(80),
  answerBlock: answerBlockSchema,
  intro: sectionIntroSchema,
  primaryCta: linkSchema.nullable().default(null),
  backdrop: decorativeImageSchema.nullable().default(null),
  list: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    /** Shown while no industry is published. */
    empty: requiredText(200),
    /** Visual cue on each card; the industry name is the link. */
    cardLinkLabel: requiredText(40),
  }),
  /** The closing card for sectors without a page of their own. */
  notListed: z.object({ heading: requiredText(80), body: requiredText(300), cta: linkSchema }),
  /** What changes when a build starts from the sector. Empty leaves the section out. */
  approach: z.object({
    heading: questionSchema(),
    intro: sectionIntroSchema,
    items: z.array(industryPointSchema).max(4),
  }),
});
export type IndustriesIndexContent = z.output<typeof industriesIndexContentSchema>;
export type IndustriesIndexContentInput = z.input<typeof industriesIndexContentSchema>;

/** What `GET /pages/industries` returns. */
export const industriesIndexViewSchema = z.object({
  content: industriesIndexContentSchema,
  /** Published industries in order. */
  industries: z.array(industryCardSchema),
});
export type IndustriesIndexView = z.output<typeof industriesIndexViewSchema>;
export type IndustryCard = z.output<typeof industryCardSchema>;

/** A result figure with the client it was measured for, since a band can mix clients. */
export const industryMetricSchema = metricSchema.extend({ clientName: requiredText(120) });

/** What `GET /pages/industries/:slug` returns. Sections without copy or records are null. */
export const industryDetailViewSchema = z.object({
  slug: slugSchema,
  name: requiredText(80),
  /** The H1. */
  title: requiredText(80),
  seo: pageSeoSchema,
  answerBlock: answerBlockSchema,
  updatedAt: z.iso.datetime(),
  hero: z.object({
    intro: requiredText(400).nullable(),
    primaryCta: linkSchema.nullable(),
    secondaryCta: linkSchema.nullable(),
    highlights: z.array(requiredText(120)).max(4),
    backdrop: decorativeImageSchema.nullable(),
    /** The card line, over the highlights. */
    line: requiredText(200).nullable(),
  }),
  painPoints: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      items: z.array(z.object({ title: requiredText(200), body: requiredText(400).nullable() })).min(1).max(4),
    })
    .nullable(),
  services: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      items: z
        .array(z.object({ slug: slugSchema, title: requiredText(120), body: requiredText(400) }))
        .min(1)
        .max(INDUSTRY_SERVICE_LIMIT),
    })
    .nullable(),
  compliance: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      notes: z.array(industryPointSchema).min(1).max(4),
    })
    .nullable(),
  caseStudies: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      items: z.array(caseStudyCardSchema).min(1).max(INDUSTRY_CASE_STUDY_LIMIT),
      /** /work/ filtered by this industry. */
      link: linkSchema,
    })
    .nullable(),
  results: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      note: requiredText(400).nullable(),
      metrics: z.array(industryMetricSchema).min(1).max(INDUSTRY_METRIC_LIMIT),
      /** A consented quote from one of the case study clients. */
      testimonial: testimonialViewSchema.nullable(),
    })
    .nullable(),
  integrations: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      items: z.array(z.object({ name: requiredText(120), body: requiredText(300).nullable() })).min(1).max(12),
    })
    .nullable(),
  faq: z
    .object({
      heading: questionSchema(),
      intro: requiredText(400).nullable(),
      items: z.array(faqItemSchema).min(1).max(INDUSTRY_FAQ_LIMIT),
    })
    .nullable(),
});
export type IndustryDetailView = z.output<typeof industryDetailViewSchema>;
export type IndustryMetric = z.output<typeof industryMetricSchema>;
