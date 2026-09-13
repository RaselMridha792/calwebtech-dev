import { z } from 'zod';

/** Keys of rows in the `Setting` table, each validated by the schema beside it. */
export const SETTING_KEYS = {
  contact: 'site.contact',
  proof: 'site.proof',
  leadNotificationRecipients: 'leads.notificationRecipients',
} as const;

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
