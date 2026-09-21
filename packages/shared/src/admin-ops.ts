import { z } from 'zod';
import { adminRoleSchema } from './auth';
import {
  SETTING_KEYS,
  homepageIndexingSchema,
  leadNotificationRecipientsSchema,
  siteContactSchema,
  siteIndexingSchema,
  siteProofSchema,
} from './site';

/**
 * The three screens that retire the server shell (docs/12-admin-dashboard.md, M2):
 * settings, the audit log, and team and roles.
 *
 * Together they are what lets the site be operated without SSH — which matters beyond
 * convenience, because `settings-cli` writes no audit entry, so today a change to who
 * receives leads leaves no record of who made it.
 */

// ---------------------------------------------------------------- settings

/**
 * The settings the screen may change. `home.content` is deliberately absent: it holds the
 * whole homepage and belongs to the content editor (M4), not to a settings form.
 */
export const ADMIN_SETTING_KEYS = [
  SETTING_KEYS.contact,
  SETTING_KEYS.leadNotificationRecipients,
  SETTING_KEYS.proof,
  SETTING_KEYS.siteIndexing,
  SETTING_KEYS.homepageIndexing,
] as const;
export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];
export const adminSettingKeySchema = z.enum(ADMIN_SETTING_KEYS);

/**
 * The schema each key's value is validated with — the same ones the API and worker read
 * those settings back with, so the screen cannot store something they will later reject.
 */
export const ADMIN_SETTING_SCHEMAS = {
  [SETTING_KEYS.contact]: siteContactSchema,
  [SETTING_KEYS.proof]: siteProofSchema,
  [SETTING_KEYS.leadNotificationRecipients]: leadNotificationRecipientsSchema,
  [SETTING_KEYS.homepageIndexing]: homepageIndexingSchema,
  [SETTING_KEYS.siteIndexing]: siteIndexingSchema,
} as const satisfies Record<AdminSettingKey, z.ZodType>;

/** What each key is, in the words of someone deciding whether to change it. */
export const ADMIN_SETTING_LABELS: Record<AdminSettingKey, { title: string; help: string }> = {
  [SETTING_KEYS.contact]: {
    title: 'Contact details',
    help: 'The phone number, address and mailbox shown across the site and in its structured data.',
  },
  [SETTING_KEYS.leadNotificationRecipients]: {
    title: 'Lead notifications',
    help: 'Who is told when an enquiry arrives. With none set, a lead is stored and nobody hears about it.',
  },
  [SETTING_KEYS.proof]: {
    title: 'Proof figures',
    help: 'The headline numbers and ratings the homepage quotes. Only claims that can be substantiated.',
  },
  [SETTING_KEYS.siteIndexing]: {
    title: 'Show the site to search engines',
    help: 'Off keeps every page noindex and robots.txt closed. Turn it on only once the content is real.',
  },
  [SETTING_KEYS.homepageIndexing]: {
    title: 'Show the homepage to search engines',
    help: 'The same switch for the homepage alone, which has its own setting.',
  },
};

export const adminSettingSchema = z.object({
  key: adminSettingKeySchema,
  /** Null when the key has never been set, which is different from set to empty. */
  value: z.unknown().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});
export type AdminSetting = z.infer<typeof adminSettingSchema>;

export const adminSettingsViewSchema = z.object({ settings: z.array(adminSettingSchema) });
export type AdminSettingsView = z.infer<typeof adminSettingsViewSchema>;

/** The body of a change. The value is checked against the key's own schema by the API. */
export const settingUpdateSchema = z.object({ value: z.unknown() });
export type SettingUpdate = z.infer<typeof settingUpdateSchema>;

// ---------------------------------------------------------------- audit log

export const ADMIN_AUDIT_PAGE_SIZE = 50;

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const adminAuditQuerySchema = z.object({
  userId: z.preprocess(blankToUndefined, z.string().max(60).optional()),
  action: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  entityType: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  from: z.preprocess(blankToUndefined, z.iso.date().optional()),
  to: z.preprocess(blankToUndefined, z.iso.date().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(ADMIN_AUDIT_PAGE_SIZE),
});
export type AdminAuditQuery = z.output<typeof adminAuditQuerySchema>;

export const adminAuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  /** Null for an action with no signed-in actor, such as a failed sign-in. */
  actor: z.object({ id: z.string(), name: z.string(), email: z.email() }).nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

export const adminAuditListSchema = z.object({
  items: z.array(adminAuditEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** The distinct values present, so the filters offer what the log actually contains. */
  actions: z.array(z.string()),
  entityTypes: z.array(z.string()),
  actors: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type AdminAuditList = z.infer<typeof adminAuditListSchema>;

// ---------------------------------------------------------------- team

export const adminTeamMemberSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: adminRoleSchema,
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** How many sessions are open right now, which is what "signed in somewhere" means. */
  activeSessions: z.number().int(),
  /** Soft-deleted accounts stay listed, so the audit log keeps a name for its entries. */
  disabledAt: z.iso.datetime().nullable(),
  /** The caller's own row, which the UI must not offer to disable or demote. */
  isSelf: z.boolean(),
});
export type AdminTeamMember = z.infer<typeof adminTeamMemberSchema>;

export const adminTeamViewSchema = z.object({ members: z.array(adminTeamMemberSchema) });
export type AdminTeamView = z.infer<typeof adminTeamViewSchema>;

/**
 * Adding someone. There is no invitation email yet — the sending domain is not live
 * (Task 6.2) — so the API generates a first password and returns it once, for the owner to
 * pass on out of band. When email works this becomes a real invitation.
 */
export const teamCreateSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'Enter a valid email address' })),
  name: z.string().trim().min(2, 'Enter their full name').max(120),
  role: adminRoleSchema,
});
export type TeamCreate = z.infer<typeof teamCreateSchema>;

export const teamCreatedSchema = z.object({
  member: adminTeamMemberSchema,
  /** Shown once and never stored in readable form. */
  temporaryPassword: z.string(),
});
export type TeamCreated = z.infer<typeof teamCreatedSchema>;

export const teamRoleUpdateSchema = z.object({ role: adminRoleSchema });
export type TeamRoleUpdate = z.infer<typeof teamRoleUpdateSchema>;

/** Why an account change was refused, in words the screen can show as they are. */
export const TEAM_ERRORS = {
  lastOwner: 'last_owner',
  self: 'self',
  duplicate: 'duplicate_email',
} as const;
