import { z } from 'zod';
import { contentStatusSchema } from './admin-services';
import { answerBlockSchema, questionSchema, requiredText } from './pages/common';
import {
  INDUSTRY_FALLBACK_HEADINGS,
  INDUSTRY_FAQ_LIMIT,
  industryContentSchema,
  type IndustryContentInput,
} from './pages/industries';
import { seoSchema, slugSchema } from './seo';

/**
 * Editing industries (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * An industry page is mostly its copy, so unlike a service the editor writes `content` too.
 * A new industry can be created with a name, an address and an answer block and no copy:
 * the page then shows its hero and answer block alone, until copy is added.
 */

// ---------------------------------------------------------------- listing

export const adminIndustryRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: contentStatusSchema,
  order: z.number().int(),
  updatedAt: z.iso.datetime(),
  /** True when the record has page copy; without it the page shows its hero and answer only. */
  hasContent: z.boolean(),
  /** True while the public page for this slug still comes from the committed snapshot. */
  shadowsSnapshot: z.boolean(),
});
export type AdminIndustryRow = z.infer<typeof adminIndustryRowSchema>;

export const adminIndustryListSchema = z.object({ items: z.array(adminIndustryRowSchema) });
export type AdminIndustryList = z.infer<typeof adminIndustryListSchema>;

// ---------------------------------------------------------------- the record

/** A question on the industry's page. Its order is its place in the list. */
export const industryFaqInputSchema = z.object({
  question: questionSchema(200),
  answer: requiredText(2000),
});

export const industryInputSchema = z.object({
  name: z.string().trim().min(2, 'Give the industry a name').max(80),
  slug: slugSchema,
  /** Two to three sentences answering the page's question directly. Required by CLAUDE.md. */
  answerBlock: answerBlockSchema,
  /** The line on the industry's card and over its hero highlights. */
  heroCopy: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  order: z.coerce.number().int().min(0).max(999).default(0),
  seo: seoSchema.default({}),
  /** The page's copy. Null shows the hero and answer block alone. */
  content: industryContentSchema.nullable().default(null),
  faqs: z.array(industryFaqInputSchema).max(INDUSTRY_FAQ_LIMIT).default([]),
});
export type IndustryInput = z.infer<typeof industryInputSchema>;
export type IndustryInputDraft = z.input<typeof industryInputSchema>;

export const adminIndustryDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  answerBlock: z.string(),
  heroCopy: z.string().nullable(),
  order: z.number().int(),
  seo: seoSchema,
  /** As stored: the editor shows what is there, even copy the page can no longer read. */
  content: z.unknown(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  status: contentStatusSchema,
  updatedAt: z.iso.datetime(),
  shadowsSnapshot: z.boolean(),
});
export type AdminIndustryDetail = z.infer<typeof adminIndustryDetailSchema>;

export const INDUSTRY_ERRORS = {
  duplicateSlug: 'duplicate_slug',
} as const;

/**
 * Copy to start a page from: every heading the template would use and the items it asks for,
 * empty, so an editor fills in fields rather than inventing a structure. It does not pass
 * validation until the required fields are written, which is the point.
 */
export function templateIndustryContent(name: string): IndustryContentInput {
  const point = { title: '', body: '' };
  return {
    title: name,
    image: null,
    hero: { intro: '', primaryCta: null, secondaryCta: null, highlights: [], backdrop: null },
    painPoints: { heading: INDUSTRY_FALLBACK_HEADINGS.painPoints, intro: null, items: [point, point, point, point] },
    services: { heading: INDUSTRY_FALLBACK_HEADINGS.services, intro: null, items: [] },
    compliance: null,
    caseStudies: {
      heading: INDUSTRY_FALLBACK_HEADINGS.caseStudies,
      intro: null,
      linkLabel: INDUSTRY_FALLBACK_HEADINGS.caseStudiesLink,
    },
    results: { heading: INDUSTRY_FALLBACK_HEADINGS.results, intro: null, note: null },
    integrations: { heading: INDUSTRY_FALLBACK_HEADINGS.integrations, intro: null, items: [{ name: '', body: '' }] },
    faq: { heading: INDUSTRY_FALLBACK_HEADINGS.faq, intro: null },
  };
}

/**
 * What the page copy editor may add where the copy has nothing: a new item in an empty list,
 * or a section or piece of copy that is not set. Keyed by path, list positions written `#`
 * (apps/web/components/admin/content/copy-editor.tsx). Only what `industryContentSchema`
 * allows to be empty is here, so the editor cannot add a structure the page cannot render.
 */
export const INDUSTRY_CONTENT_SHAPES: Readonly<Record<string, unknown>> = {
  image: { src: '', alt: '' },
  'hero.primaryCta': { label: '', href: '' },
  'hero.secondaryCta': { label: '', href: '' },
  'hero.highlights.#': '',
  'hero.backdrop': { src: '' },
  'painPoints.intro': '',
  'services.intro': '',
  'services.items.#': { slug: '', body: '' },
  compliance: { heading: '', intro: null, notes: [{ title: '', body: '' }] },
  'compliance.intro': '',
  'compliance.notes.#': { title: '', body: '' },
  'caseStudies.intro': '',
  'results.intro': '',
  'results.note': '',
  'integrations.intro': '',
  'integrations.items.#': { name: '', body: '' },
  'faq.intro': '',
};
