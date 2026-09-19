import {
  CALCULATOR_SETTING_KEYS,
  SETTING_KEYS,
  calculatorPageContentSchema,
  calculatorPageViewSchema,
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
  },
};
