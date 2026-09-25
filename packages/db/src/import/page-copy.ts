import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  SETTING_KEYS,
  STATIC_SETTING_KEYS,
  STATIC_THANK_YOU_TYPES,
  homePageViewSchema,
  staticThankYouContentSchema,
  staticThankYouPageSchema,
  staticThankYouViewSchema,
} from '@calwebtech/shared';
import type { SnapshotImporter } from './index';

/**
 * Page copy that belongs to no record: the homepage's (`home.content`) and the thank-you
 * pages' (`static.thank-you`) (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 59).
 *
 * The launch never wrote them (decision 43), so there was nothing for the dashboard to edit;
 * this writes the approved copy from the snapshots as a starting point. Both are written
 * only where no row exists: copy somebody has since changed in the dashboard stays theirs,
 * even when the import is forced. Neither changes what the site shows until the family is
 * named in `CONTENT_DATABASE_FIRST`.
 */
export const pageCopyImporter: SnapshotImporter = {
  family: 'page-copy',
  async run(ctx) {
    const home = ctx.read('home.json', homePageViewSchema);
    await ctx.setSettingOnce(SETTING_KEYS.homeContent, home.content);

    // Each thank-you snapshot is one type's page with the copy every type shares and the
    // site's contact details; the setting is the shared copy and the pages, without contact.
    const views = STATIC_THANK_YOU_TYPES.filter((type) =>
      existsSync(path.join(ctx.dir, 'static', 'thank-you', `${type}.json`)),
    ).map((type) => ctx.read(`static/thank-you/${type}.json`, staticThankYouViewSchema));
    const [first] = views;
    if (!first) throw new Error('import: static/thank-you has no page to take the copy from');
    // The page schema keeps a page's own fields and drops the shared ones and the contact.
    const pages = views.map((view) => staticThankYouPageSchema.parse(view));
    await ctx.setSettingOnce(
      STATIC_SETTING_KEYS.thankYou,
      staticThankYouContentSchema.parse({ image: first.image, callLabel: first.callLabel, pages }),
    );

    ctx.log(`import: page-copy: the homepage and ${String(pages.length)} thank-you pages, where none was stored`);
  },
};
