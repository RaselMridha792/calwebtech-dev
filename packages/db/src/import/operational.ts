import {
  BOOKING_SETTING_KEYS,
  DEFAULT_BOOKING_PAGE,
  DEFAULT_CONSULTATION,
  CALCULATOR_SETTING_KEYS,
  SETTING_KEYS,
  calculatorPageContentSchema,
  calculatorPageViewSchema,
  bookingPageContentSchema,
  homepageIndexingSchema,
  siteIndexingSchema,
  staticContactViewSchema,
} from '@calwebtech/shared';
import type { SnapshotImporter } from './index';

/**
 * The rows the API needs on an empty database for every form on a snapshot-rendered site
 * to work (decision 43). Pages keep their content in the snapshots; this is only what the
 * write paths look up:
 *
 * - `POST /leads` refuses an enquiry type that is not a row (leads.service.ts), and the
 *   contact page offers the types its snapshot lists. Each is created with an empty
 *   mailbox, as the seed does, so routing to a shared mailbox is a decision a person
 *   makes; an existing mailbox is never touched.
 * - A calculator lead's emailed copy is worded from the `calculator.page` setting
 *   (calculator-lead.ts). The page view carries that setting verbatim as `content`, so the
 *   email repeats exactly what the visitor read. Without it the estimate is still stored,
 *   but the page would promise an email that is never sent.
 * - Indexing settings, off, created once: nothing reads them while pages come from the
 *   snapshots, but the day a family moves to the database it must start out of search.
 *
 * Not written here: `leads.notificationRecipients`. The owner sets their own address with
 * settings-cli (docs/11-vps-deploy.md); until then a lead is stored and its timeline says
 * the notification was skipped.
 */
export const operationalImporter: SnapshotImporter = {
  family: 'operational',
  async run(ctx) {
    const contact = ctx.read('static/contact.json', staticContactViewSchema);
    for (const [order, type] of contact.enquiryTypes.entries()) {
      await ctx.db.enquiryType.upsert({
        where: { slug: type.slug },
        create: { slug: type.slug, name: type.name, order, mailbox: '' },
        update: { name: type.name, order },
      });
    }
    ctx.log(`import: operational: ${String(contact.enquiryTypes.length)} enquiry types`);

    const calculator = ctx.read('calculator/page.json', calculatorPageViewSchema);
    await ctx.setSetting(CALCULATOR_SETTING_KEYS.page, calculatorPageContentSchema.parse(calculator.content));
    ctx.log(`import: operational: the "${CALCULATOR_SETTING_KEYS.page}" setting`);

    await ctx.setSettingOnce(SETTING_KEYS.homepageIndexing, homepageIndexingSchema.parse({ index: false }));
    await ctx.setSettingOnce(SETTING_KEYS.siteIndexing, siteIndexingSchema.parse({ index: false }));

    await bookingDefaults(ctx);
  },
};

/**
 * What the booking page needs to exist at all: its copy, the business timezone every
 * availability rule is written in, one consultation type and the hours it can be booked.
 *
 * All of it `once`. The copy below is a working default, not the owner's words, and the
 * timezone is the first office's — both are a setting and a row, changeable from the
 * dashboard without a deploy, and neither is overwritten again once it exists.
 */
async function bookingDefaults(ctx: Parameters<SnapshotImporter['run']>[0]): Promise<void> {
  await ctx.setSettingOnce(BOOKING_SETTING_KEYS.page, bookingPageContentSchema.parse(DEFAULT_BOOKING_PAGE));

  const existing = await ctx.db.consultationType.findUnique({ where: { slug: DEFAULT_CONSULTATION.slug } });
  if (existing) return;
  const type = await ctx.db.consultationType.create({
    data: {
      slug: DEFAULT_CONSULTATION.slug,
      name: DEFAULT_CONSULTATION.name,
      durationMinutes: DEFAULT_CONSULTATION.durationMinutes,
      bufferAfter: DEFAULT_CONSULTATION.bufferAfter,
      description: DEFAULT_CONSULTATION.description,
    },
  });
  await ctx.db.availabilityRule.createMany({
    data: DEFAULT_CONSULTATION.weekdays.map((weekday) => ({
      consultationTypeId: type.id,
      weekday,
      startMinute: DEFAULT_CONSULTATION.startMinute,
      endMinute: DEFAULT_CONSULTATION.endMinute,
      minimumNoticeHours: DEFAULT_CONSULTATION.minimumNoticeHours,
    })),
  });
  ctx.log('import: operational: a consultation type and its weekday hours');
}
