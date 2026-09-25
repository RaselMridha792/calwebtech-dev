import { z } from 'zod';
import { BOOKING_SETTING_KEYS, bookingPageContentSchema } from './booking';
import { homePageContentSchema } from './home-page';
import { INDUSTRY_SETTING_KEYS, industriesIndexContentSchema } from './pages/industries';
import { SERVICES_SETTING_KEYS, servicesIndexContentSchema } from './pages/services';
import { STATIC_SETTING_KEYS, staticThankYouContentSchema } from './pages/static';
import { WORK_COPY_SETTING_KEY, workCopySchema } from './pages/work';
import { SETTING_KEYS } from './site';

/**
 * Page copy that belongs to no record (docs/14-remaining-work.md, task 4; docs/08-decisions.md,
 * 59): the homepage, the booking page, the thank-you pages and the copy around the indexes of
 * the families that moved into the database. Each is one `Setting` row validated by the
 * schema its page reads it with, so the screen cannot store something the page will refuse.
 * Until now `settings-cli` on the server was the only way to change them, and it writes no
 * audit entry.
 */
export const PAGE_COPY_KEYS = [
  SETTING_KEYS.homeContent,
  BOOKING_SETTING_KEYS.page,
  STATIC_SETTING_KEYS.thankYou,
  SERVICES_SETTING_KEYS.index,
  INDUSTRY_SETTING_KEYS.index,
  WORK_COPY_SETTING_KEY,
] as const;
export type PageCopyKey = (typeof PAGE_COPY_KEYS)[number];
export const pageCopyKeySchema = z.enum(PAGE_COPY_KEYS);

export const PAGE_COPY_SCHEMAS = {
  [SETTING_KEYS.homeContent]: homePageContentSchema,
  [BOOKING_SETTING_KEYS.page]: bookingPageContentSchema,
  [STATIC_SETTING_KEYS.thankYou]: staticThankYouContentSchema,
  [SERVICES_SETTING_KEYS.index]: servicesIndexContentSchema,
  [INDUSTRY_SETTING_KEYS.index]: industriesIndexContentSchema,
  [WORK_COPY_SETTING_KEY]: workCopySchema,
} as const satisfies Record<PageCopyKey, z.ZodType>;

/**
 * What each is, and the family name that makes the live site read it from the database while
 * pages render from the snapshots (`CONTENT_DATABASE_FIRST`). The booking page has none: it
 * always reads the database.
 */
export const PAGE_COPY_LABELS: Record<PageCopyKey, { title: string; help: string; family: string | null }> = {
  [SETTING_KEYS.homeContent]: {
    title: 'Homepage',
    help: 'Every section of the homepage, and the menus, footer and closing band built from it on every page.',
    family: 'home',
  },
  [BOOKING_SETTING_KEYS.page]: {
    title: 'Booking page',
    help: 'The words on /book-a-consultation/ and the business time zone its hours are written in.',
    family: null,
  },
  [STATIC_SETTING_KEYS.thankYou]: {
    title: 'Thank-you pages',
    help: 'The page each form sends a visitor to once their enquiry is stored, one per type.',
    family: 'thank-you',
  },
  [SERVICES_SETTING_KEYS.index]: {
    title: 'Services index',
    help: 'The copy around the list on /services/.',
    family: 'services',
  },
  [INDUSTRY_SETTING_KEYS.index]: {
    title: 'Industries index',
    help: 'The copy around the list on /industries/.',
    family: 'industries',
  },
  [WORK_COPY_SETTING_KEY]: {
    title: 'Case studies copy',
    help: 'The copy of /work/ and the headings and labels of every case study.',
    family: 'work',
  },
};

export const adminPageCopyListSchema = z.object({
  items: z.array(
    z.object({
      key: pageCopyKeySchema,
      /** False while no row exists: the page renders its snapshot and the screen offers that to start from. */
      stored: z.boolean(),
      updatedAt: z.iso.datetime().nullable(),
    }),
  ),
});
export type AdminPageCopyList = z.infer<typeof adminPageCopyListSchema>;

export const adminPageCopyDetailSchema = z.object({
  key: pageCopyKeySchema,
  /** The stored copy, as stored: the screen shows what is there, even what the page now refuses. */
  value: z.unknown(),
  stored: z.boolean(),
  updatedAt: z.iso.datetime().nullable(),
});
export type AdminPageCopyDetail = z.infer<typeof adminPageCopyDetailSchema>;

/** `PUT /admin/page-copy/:key`: the whole value, validated with the key's schema. */
export const pageCopyUpdateSchema = z.object({ value: z.unknown() });
