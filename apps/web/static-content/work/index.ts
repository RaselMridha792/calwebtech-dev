import beforeAndAfter from './before-and-after.json';
import cascadiaHealth from './cascadia-health.json';
import index from './index.json';
import meridianParts from './meridian-parts.json';
import northmarkSupply from './northmark-supply.json';
import truviaLabs from './truvia-labs.json';
import veronaHome from './verona-home.json';

/**
 * The work family's views exactly as the API returns them, for rendering with no API
 * (docs/10-site-pages.md). They carry the approved demo proof from home.json; the pages
 * validate them with the same schemas as a live response.
 */
export const workIndexSnapshot: unknown = index;

export const workBeforeAndAfterSnapshot: unknown = beforeAndAfter;

/** Case study views keyed by slug. */
export const workCaseStudySnapshots: Readonly<Record<string, unknown>> = {
  'northmark-supply': northmarkSupply,
  'verona-home': veronaHome,
  'truvia-labs': truviaLabs,
  'cascadia-health': cascadiaHealth,
  'meridian-parts': meridianParts,
};
