import austin from './austin.json';
import locationsIndex from './index.json';
import sacramento from './sacramento.json';

/**
 * The locations family's views while no API is hosted (docs/10-site-pages.md), exactly as
 * `GET /pages/locations` and `GET /pages/locations/:slug` return them. Only the offices in
 * the approved homepage content are here, each with a page written for that city; a city
 * that cannot be written honestly with at least sixty per cent unique copy is left out.
 * Validated by the getters in lib/api/locations.ts and by locations.test.ts.
 */
export const locationsIndexSnapshot: unknown = locationsIndex;

export const locationSnapshots: Readonly<Partial<Record<string, unknown>>> = {
  austin,
  sacramento,
};
