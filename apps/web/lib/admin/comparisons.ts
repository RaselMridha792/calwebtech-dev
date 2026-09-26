import { isDatabaseFirst, usesSnapshots } from '@/lib/api/core';
import { BEFORE_AND_AFTER_FAMILY } from '@/lib/api/work';

/**
 * Whether the comparisons edited in the dashboard are what visitors see, in words for the
 * screen (docs/08-decisions.md, 70). While pages render from the snapshots, they are only
 * once `CONTENT_DATABASE_FIRST` names the `before-and-after` family.
 */
export function comparisonsLiveNote(): string {
  if (!usesSnapshots() || isDatabaseFirst(BEFORE_AND_AFTER_FAMILY)) {
    return 'Live: a saved change shows on /before-and-after/ and the homepage within half a minute.';
  }
  // The switch is a server setting, so it is named for whoever the owner asks to turn it on.
  return `Saved here, but visitors still see the site's built-in comparison until the "${BEFORE_AND_AFTER_FAMILY}" pages are switched to read from the dashboard (the CONTENT_DATABASE_FIRST server setting).`;
}
