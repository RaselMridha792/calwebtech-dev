import 'server-only';
import {
  SITE_ROUTES,
  serviceDetailViewSchema,
  servicePath,
  servicesIndexViewSchema,
  type ServicesIndexView,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { serviceSnapshot, servicesIndexSnapshot } from '@/static-content/services';
import { apiUrl, findViewDatabaseFirst, getView, isDatabaseFirst } from './core';

/**
 * The services family reads the database first and falls back to its snapshot while
 * `CONTENT_DATABASE_FIRST` names it (decision 44). A service created in the admin is live
 * at once; the ten that were never imported keep rendering from the snapshot exactly as
 * they do today.
 */
const FAMILY = 'services';

/**
 * `/services/`: every published service, grouped by category.
 *
 * While the family is database-first the two lists are merged, because a visitor should see
 * one index — not the database's services on the detail pages and the snapshot's list on
 * the way there. A slug in both belongs to the database: it is the one an editor can change.
 */
export const getServicesIndex = cache(async (): Promise<ServicesIndexView> => {
  if (!isDatabaseFirst(FAMILY)) {
    return getView('/pages/services', servicesIndexViewSchema, servicesIndexSnapshot);
  }

  const response = await fetch(apiUrl('/pages/services'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for /pages/services`);
  const fromDatabase = servicesIndexViewSchema.parse(await response.json());
  const fromSnapshot = servicesIndexViewSchema.parse(servicesIndexSnapshot);
  return mergeIndexes(fromDatabase, fromSnapshot);
});

/** `/services/<slug>/`, or null when neither the database nor the snapshot has one. */
export const getServicePage = cache((slug: string) =>
  findViewDatabaseFirst(
    FAMILY,
    `/pages/services/${encodeURIComponent(slug)}`,
    serviceDetailViewSchema,
    serviceSnapshot(slug),
  ),
);

/**
 * The database's groups first, then any snapshot service whose slug the database does not
 * have, in the group it belongs to. A category that exists only in the snapshot is carried
 * over with it, or its services would have nowhere to sit.
 */
function mergeIndexes(database: ServicesIndexView, snapshot: ServicesIndexView): ServicesIndexView {
  const known = new Set(database.groups.flatMap((group) => group.services.map((service) => service.slug)));
  const groups = database.groups.map((group) => ({ ...group, services: [...group.services] }));

  for (const snapshotGroup of snapshot.groups) {
    const extra = snapshotGroup.services.filter((service) => !known.has(service.slug));
    if (extra.length === 0) continue;

    const existing = groups.find((group) => group.slug === snapshotGroup.slug);
    if (existing) existing.services.push(...extra);
    else groups.push({ ...snapshotGroup, services: extra });
  }

  return { ...database, groups: groups.filter((group) => group.services.length > 0) };
}

export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const index = await getServicesIndex();
  const services = index.groups.flatMap((group) => group.services);
  const lastModified = services.map((service) => service.updatedAt).sort().at(-1) ?? null;
  return [
    { path: SITE_ROUTES.services, title: 'Services', section: 'Services', lastModified },
    ...services.map((service) => ({
      path: servicePath(service.slug),
      title: service.title,
      section: 'Services',
      lastModified: service.updatedAt,
    })),
  ];
}
