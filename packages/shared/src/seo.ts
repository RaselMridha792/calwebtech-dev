import { z } from 'zod';
import { mediaSrcSchema } from './media';

export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 155;

/** Per-record SEO fields. Fallbacks are applied at render time. */
export const seoSchema = z.object({
  title: z.string().trim().min(1).max(SEO_TITLE_MAX).optional(),
  description: z.string().trim().min(1).max(SEO_DESCRIPTION_MAX).optional(),
  canonical: z.url().optional(),
  ogImage: mediaSrcSchema.optional(),
});

export type Seo = z.infer<typeof seoSchema>;

/** Slugs are lowercase and hyphenated, matching the URL rules in docs/03-page-specs.md. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');
