import { PAGE_COPY_LABELS, type PageCopyKey } from '@calwebtech/shared';
import { isDatabaseFirst, usesSnapshots } from '@/lib/api/core';

/**
 * Whether the live site shows a piece of page copy from the database, in words for the screen.
 * Pages render from the snapshots at launch (decision 43); a family named in
 * `CONTENT_DATABASE_FIRST` reads its copy from the database (decisions 44 and 59).
 */
export function pageCopyLiveNote(key: PageCopyKey): string {
  const { family } = PAGE_COPY_LABELS[key];
  if (family === null || !usesSnapshots() || isDatabaseFirst(family)) {
    return 'Live: a saved change shows on the site within half a minute.';
  }
  // The switch is a server setting, so it is named for whoever the owner asks to turn it on.
  return `Saved here, but visitors still see the site's built-in words until the "${family}" pages are switched to read from the dashboard (the CONTENT_DATABASE_FIRST server setting).`;
}
