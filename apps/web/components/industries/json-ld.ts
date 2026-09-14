import { industryPath, servicePath, type IndustryDetailView } from '@calwebtech/shared';
import { serviceJsonLd, type JsonLdObject } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';

/**
 * The Service node of an industry page (docs/04-seo-keyword-map.md, Schema per template:
 * Service, FAQPage, BreadcrumbList). The FAQPage node comes from `FaqSection` and the
 * trail from `PageHero`; the provider refers to the layout's Organization node.
 */
export function industryServiceJsonLd(page: Pick<IndustryDetailView, 'slug' | 'name' | 'title' | 'seo' | 'services'>): JsonLdObject {
  const service = serviceJsonLd({
    name: page.title,
    description: page.seo.description,
    path: industryPath(page.slug),
    serviceType: 'Website design and development',
  });
  const offered = page.services?.items ?? [];
  return {
    ...service,
    audience: { '@type': 'BusinessAudience', audienceType: page.name },
    ...(offered.length > 0
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `Services for ${page.name}`,
            itemListElement: offered.map((item) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: item.title,
                description: item.body,
                url: absoluteUrl(servicePath(item.slug)),
              },
            })),
          },
        }
      : {}),
  };
}
