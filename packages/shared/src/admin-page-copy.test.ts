import { describe, expect, it } from 'vitest';
import { ADMIN_SETTING_KEYS } from './admin-ops';
import { PAGE_COPY_KEYS, PAGE_COPY_LABELS, PAGE_COPY_SCHEMAS, pageCopyKeySchema } from './admin-page-copy';

describe('the page copy the dashboard edits', () => {
  it('names a schema, a title and help for every key', () => {
    for (const key of PAGE_COPY_KEYS) {
      expect(PAGE_COPY_SCHEMAS[key], key).toBeDefined();
      expect(PAGE_COPY_LABELS[key].title.length, key).toBeGreaterThan(0);
      expect(PAGE_COPY_LABELS[key].help.length, key).toBeGreaterThan(0);
    }
  });

  it('holds what the brief asked for, and leaves the settings screen its own keys', () => {
    expect(PAGE_COPY_KEYS).toEqual(expect.arrayContaining(['home.content', 'booking.page', 'static.thank-you']));
    for (const key of ADMIN_SETTING_KEYS) expect(pageCopyKeySchema.safeParse(key).success, key).toBe(false);
  });

  it('refuses a key it does not edit', () => {
    expect(pageCopyKeySchema.safeParse('site.contact').success).toBe(false);
    expect(pageCopyKeySchema.safeParse('snapshots.import').success).toBe(false);
  });
});
