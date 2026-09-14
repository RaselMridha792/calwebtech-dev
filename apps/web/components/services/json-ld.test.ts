import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceOfferJsonLd } from './json-ld';

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const page = {
  slug: 'website-redesign',
  title: 'Website redesign',
  seo: { title: 'Website redesign', description: 'Rebuild the site without losing what it earns.', ogImage: null },
};

describe('serviceOfferJsonLd', () => {
  it('gives a project band an Offer with a price range', () => {
    const node = serviceOfferJsonLd({
      ...page,
      price: { label: '$12,000 to $25,000', amount: { currency: 'USD', min: 12000, max: 25000, unit: 'PROJECT' } },
    });
    expect(node).toMatchObject({
      '@type': 'Service',
      '@id': 'https://www.calwebtech.com/services/website-redesign/#service',
      name: 'Website redesign',
      provider: { '@id': 'https://www.calwebtech.com/#organization' },
      offers: {
        '@type': 'Offer',
        url: 'https://www.calwebtech.com/services/website-redesign/',
        priceCurrency: 'USD',
        priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'USD', minPrice: 12000, maxPrice: 25000 },
      },
    });
  });

  it('gives a monthly price a UnitPriceSpecification per month, without a top when there is none', () => {
    const node = serviceOfferJsonLd({
      ...page,
      price: { label: 'From $1,500 a month', amount: { currency: 'USD', min: 1500, max: null, unit: 'MONTH' } },
    });
    expect(node.offers).toEqual({
      '@type': 'Offer',
      url: 'https://www.calwebtech.com/services/website-redesign/',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceCurrency: 'USD',
        minPrice: 1500,
        unitCode: 'MON',
        unitText: 'month',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
    });
  });

  it('has no Offer for a text-only price or no price', () => {
    expect(serviceOfferJsonLd({ ...page, price: { label: 'From $12,000', amount: null } })).not.toHaveProperty('offers');
    expect(serviceOfferJsonLd({ ...page, price: null })).not.toHaveProperty('offers');
  });
});
