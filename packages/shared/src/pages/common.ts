import { z } from 'zod';
import { caseResultSchema } from '../landing-page';
import { mediaSrcSchema } from '../media';
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from '../seo';

/**
 * Building blocks for the page view schemas of the site families
 * (`packages/shared/src/pages/<family>.ts`, docs/10-site-pages.md). Compose these rather
 * than redefining them, so every family's pages validate the same rules.
 */

/** Required, trimmed text of at most `max` characters. */
export const requiredText = (max: number) => z.string().trim().min(1).max(max);

/**
 * Sentences in a block of copy: each ends with a full stop, question mark or exclamation
 * mark followed by the end of the text, or by a space and a capital letter, digit or
 * opening quote. "Next.js" and "2.5s" do not end a sentence; "e.g. Shopify" does, so write
 * answer blocks without abbreviations.
 */
export function countSentences(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/u).length;
}

/**
 * The answer block that opens every service, industry and location page (and glossary
 * and article templates): two or three complete sentences that answer the page's query
 * directly, before anything promotional. It is the extraction target for AI answer engines.
 */
export const answerBlockSchema = z
  .string()
  .trim()
  .min(80, 'An answer block is two or three complete sentences')
  .max(600, 'Keep the answer block to two or three sentences')
  .refine((value) => {
    const sentences = countSentences(value);
    return sentences >= 2 && sentences <= 3 && /[.!?]["”’)]?$/u.test(value);
  }, 'An answer block is two or three complete sentences');

/** An H2, H3 or FAQ question on a content page, written as the question a buyer types. */
export const questionSchema = (max = 160) =>
  requiredText(max).refine((value) => value.endsWith('?'), 'Write it as a question a buyer would type, ending with "?"');

/**
 * Per-page SEO. The title is the page's own title without the brand; the metadata builder
 * adds " | Calwebtech" when it fits in 60 characters (apps/web/lib/seo/metadata.ts).
 */
export const pageSeoSchema = z.object({
  title: requiredText(SEO_TITLE_MAX),
  description: requiredText(SEO_DESCRIPTION_MAX),
  /** A site path or URL; the site's default image when null. */
  ogImage: mediaSrcSchema.nullable().default(null),
});

export const faqItemSchema = z.object({
  id: z.string().min(1),
  question: questionSchema(200),
  answer: requiredText(2000),
});

/** A result figure and what it measures, e.g. `{ value: "+312%", label: "Quote requests" }`. */
export const metricSchema = z.object({ value: requiredText(20), label: requiredText(80) });

/** A step with how long it takes, for process timelines on service and process pages. */
export const timedStepSchema = z.object({
  title: requiredText(80),
  duration: requiredText(40),
  body: requiredText(600),
});

/** A case study card: cover image, client, tags, one-line summary and up to three figures. */
export const caseStudyCardSchema = caseResultSchema;

export type PageSeo = z.output<typeof pageSeoSchema>;
export type FaqItem = z.output<typeof faqItemSchema>;
export type Metric = z.output<typeof metricSchema>;
export type TimedStep = z.output<typeof timedStepSchema>;
export type CaseStudyCard = z.output<typeof caseStudyCardSchema>;
