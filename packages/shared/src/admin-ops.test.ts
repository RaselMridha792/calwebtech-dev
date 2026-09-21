import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTING_KEYS,
  ADMIN_SETTING_LABELS,
  ADMIN_SETTING_SCHEMAS,
  adminAuditQuerySchema,
  adminSettingKeySchema,
  teamCreateSchema,
} from './admin-ops';
import { SETTING_KEYS } from './site';

describe('the settings the admin may change', () => {
  it('leaves home.content out, because it is the homepage and not a setting', () => {
    // It holds every section of the homepage and belongs to the content editor (M4). A
    // settings form would let someone replace the whole page by pasting into a box.
    expect(adminSettingKeySchema.safeParse(SETTING_KEYS.homeContent).success).toBe(false);
    expect([...ADMIN_SETTING_KEYS]).not.toContain(SETTING_KEYS.homeContent);
  });

  it('has a schema and a label for every key it offers, and no orphans', () => {
    for (const key of ADMIN_SETTING_KEYS) {
      expect(ADMIN_SETTING_SCHEMAS[key]).toBeDefined();
      expect(ADMIN_SETTING_LABELS[key].title.length).toBeGreaterThan(0);
      expect(ADMIN_SETTING_LABELS[key].help.length).toBeGreaterThan(0);
    }
    expect(Object.keys(ADMIN_SETTING_SCHEMAS).sort()).toEqual([...ADMIN_SETTING_KEYS].sort());
  });

  it('validates a value with the schema the API reads it back with', () => {
    const contact = ADMIN_SETTING_SCHEMAS[SETTING_KEYS.contact];
    expect(contact.safeParse({ phone: '+1 (800) 555-0188', phoneE164: '+18005550188', email: 'hi@calwebtech.com' }).success).toBe(true);
    // A display number where the tel: link form belongs would break every phone link.
    expect(contact.safeParse({ phone: '+1 (800) 555-0188', phoneE164: '+1 (800) 555-0188', email: 'hi@calwebtech.com' }).success).toBe(false);

    const recipients = ADMIN_SETTING_SCHEMAS[SETTING_KEYS.leadNotificationRecipients];
    expect(recipients.safeParse({ emails: [] }).success).toBe(true);
    expect(recipients.safeParse({ emails: ['not-an-address'] }).success).toBe(false);

    const indexing = ADMIN_SETTING_SCHEMAS[SETTING_KEYS.siteIndexing];
    expect(indexing.safeParse({ index: true }).success).toBe(true);
    expect(indexing.safeParse({ index: 'yes' }).success).toBe(false);
  });
});

describe('adminAuditQuerySchema', () => {
  it('treats blank filters as absent rather than as filters on empty', () => {
    const parsed = adminAuditQuerySchema.parse({ userId: '', action: '  ', entityType: '' });
    expect(parsed.userId).toBeUndefined();
    expect(parsed.action).toBeUndefined();
    expect(parsed.entityType).toBeUndefined();
  });

  it('defaults to the first page and caps how much one request can ask for', () => {
    expect(adminAuditQuerySchema.parse({}).page).toBe(1);
    expect(adminAuditQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('teamCreateSchema', () => {
  it('normalises the address so one person cannot become two accounts', () => {
    const parsed = teamCreateSchema.parse({ email: '  Someone@Calwebtech.COM ', name: 'Someone', role: 'EDITOR' });
    expect(parsed.email).toBe('someone@calwebtech.com');
  });

  it('refuses a role that is not one of the four', () => {
    expect(teamCreateSchema.safeParse({ email: 'a@b.com', name: 'Someone', role: 'ADMIN' }).success).toBe(false);
  });

  it('asks for a real name, since the audit log quotes it', () => {
    expect(teamCreateSchema.safeParse({ email: 'a@b.com', name: 'X', role: 'VIEWER' }).success).toBe(false);
  });
});
