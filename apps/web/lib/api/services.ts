import 'server-only';
import { SITE_ROUTES, serviceDetailViewSchema, servicePath, servicesIndexViewSchema } from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '@/lib/sitemap';
import { serviceSnapshot, servicesIndexSnapshot } from '@/static-content/services';
import { findView, getView } from './core';

/** `/services/`: the index copy and every published service, grouped by category. */
export const getServicesIndex = cache(() => getView('/pages/services', servicesIndexViewSchema, servicesIndexSnapshot));

/** `/services/<slug>/`, or null when no such service is published. */
export const getServicePage = cache((slug: string) =>
  findView(`/pages/services/${encodeURIComponent(slug)}`, serviceDetailViewSchema, serviceSnapshot(slug)),
);

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
