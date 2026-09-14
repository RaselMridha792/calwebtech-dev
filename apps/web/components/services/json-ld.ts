import { servicePath, type ServiceDetailView } from '@calwebtech/shared';
import { serviceJsonLd, type JsonLdObject } from '@/lib/seo/json-ld';
import { absoluteUrl } from '@/lib/seo/site';

/**
 * The Service node of a service page with its Offer (docs/04-seo-keyword-map.md, "Schema per
 * template"). A project band is a PriceSpecification with its range; a monthly price is a
 * UnitPriceSpecification per month. Without a structured price there is no Offer, since a
 * text band cannot be read as numbers. FAQPage and BreadcrumbList come from their components.
 */
export function serviceOfferJsonLd(page: Pick<ServiceDetailView, 'slug' | 'title' | 'seo' | 'price'>): JsonLdObject {
  const path = servicePath(page.slug);
  const node = serviceJsonLd({ name: page.title, description: page.seo.description, path });
  const amount = page.price?.amount;
  if (!amount) return node;

  const range = {
    priceCurrency: amount.currency,
    minPrice: amount.min,
    ...(amount.max !== null ? { maxPrice: amount.max } : {}),
  };
  const priceSpecification: JsonLdObject =
    amount.unit === 'MONTH'
      ? {
          '@type': 'UnitPriceSpecification',
          ...range,
          unitCode: 'MON',
          unitText: 'month',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
        }
      : { '@type': 'PriceSpecification', ...range };

  return {
    ...node,
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(path),
      priceCurrency: amount.currency,
      priceSpecification,
    },
  };
}
