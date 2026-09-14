import { z } from 'zod';

/** Keys of rows in the `Setting` table, each validated by the schema beside it. */
export const SETTING_KEYS = {
  contact: 'site.contact',
  proof: 'site.proof',
  leadNotificationRecipients: 'leads.notificationRecipients',
  homepageIndexing: 'homepage.indexing',
  /** Every page under the site layout, plus robots.txt (docs/10-site-pages.md). */
  siteIndexing: 'site.indexing',
  /** Homepage copy, validated by homePageContentSchema (home-page.ts). */
  homeContent: 'home.content',
} as const;

/**
 * Whether search engines may index the homepage. A missing row or `index: false` means
 * noindex, so the homepage stays out of search until real content replaces the
 * placeholders, and flipping it needs no redeploy.
 */
export const homepageIndexingSchema = z.object({ index: z.boolean() });
export type HomepageIndexing = z.infer<typeof homepageIndexingSchema>;

/**
 * Whether search engines may index the site pages (services, industries, work, company,
 * locations, pricing, legal and the rest). Same shape and rule as homepage.indexing: a
 * missing row or `index: false` means every site page is noindex and robots.txt disallows
 * all crawling. The seed creates it as false and never overwrites it.
 */
export const siteIndexingSchema = z.object({ index: z.boolean() });
export type SiteIndexing = z.infer<typeof siteIndexingSchema>;

export const siteContactSchema = z.object({
  /** Display form, e.g. "+1 (800) 555-0188". */
  phone: z.string().trim().min(1),
  /** E.164 form used in tel: links, e.g. "+18005550188". */
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  email: z.email(),
});

export const siteProofSchema = z.object({
  npsScore: z.number().min(-100).max(100).nullable(),
  npsProjectCount: z.number().int().nonnegative().nullable(),
});

/**
 * Who receives the internal notification for every new lead. Stored as a setting, not
 * an environment variable, so the address changes without a redeploy.
 */
export const leadNotificationRecipientsSchema = z.object({
  emails: z.array(z.email()).max(20),
});

export type SiteContact = z.infer<typeof siteContactSchema>;
export type SiteProof = z.infer<typeof siteProofSchema>;
export type LeadNotificationRecipients = z.infer<typeof leadNotificationRecipientsSchema>;
