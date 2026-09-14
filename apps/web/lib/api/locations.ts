import 'server-only';
import {
  SITE_ROUTES,
  locationDetailViewSchema,
  locationPath,
  locationsIndexViewSchema,
  type LocationDetailView,
  type LocationsIndexView,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { locationSnapshots, locationsIndexSnapshot } from '@/static-content/locations';
import { findView, getView } from './core';

/** `/locations/`: its copy and the published locations, grouped by tier. */
export const getLocationsIndex = cache(
  (): Promise<LocationsIndexView> => getView('/pages/locations', locationsIndexViewSchema, locationsIndexSnapshot),
);

/** A published city page, or null for an unknown slug. */
export const getLocationPage = cache(
  (slug: string): Promise<LocationDetailView | null> =>
    findView(`/pages/locations/${encodeURIComponent(slug)}`, locationDetailViewSchema, locationSnapshots[slug]),
);

/** The index and every published city page, for sitemap.xml and `/sitemap/`. */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const index = await getLocationsIndex();
  return [
    { path: SITE_ROUTES.locations, title: 'Locations', section: 'Locations' },
    ...index.groups.flatMap((group) =>
      group.locations.map((location) => ({
        path: locationPath(location.slug),
        title: location.state ? `${location.city}, ${location.state}` : location.city,
        section: 'Locations',
        lastModified: location.updatedAt,
      })),
    ),
  ];
}
