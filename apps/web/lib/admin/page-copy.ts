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
    return 'The site reads this copy from the database: a saved change is live within half a minute.';
  }
  return `Saved here, but the site still shows the committed snapshot until "${family}" is read from the database first (CONTENT_DATABASE_FIRST).`;
}
