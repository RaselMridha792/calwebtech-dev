import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonLd } from '@/components/seo/json-ld';
import {
  breadcrumbListJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from './json-ld';

const LINE_SEPARATOR = String.fromCharCode(0x2028);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('serializeJsonLd', () => {
  it('cannot close the script element or open a comment, and parses back unchanged', () => {
    const data = { name: `</script><script>alert(1)</script> <!-- & ${LINE_SEPARATOR}` };
    const json = serializeJsonLd(data);
    expect(json).not.toMatch(/[<>&]/);
    expect(json.includes(LINE_SEPARATOR)).toBe(false);
    expect(JSON.parse(json)).toEqual(data);
  });

  it('renders inside one script element', () => {
    const html = renderToStaticMarkup(<JsonLd data={{ '@type': 'Thing', name: '</script>' }} />);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
  });
});

describe('structured data builders', () => {
  it('builds a BreadcrumbList with absolute URLs in order', () => {
    expect(breadcrumbListJsonLd([{ name: 'Home', path: '/' }, { name: 'Services', path: '/services/' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.calwebtech.com/' },
        { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://www.calwebtech.com/services/' },
      ],
    });
  });

  it('builds a FAQPage of questions and accepted answers', () => {
    const faq = faqPageJsonLd([{ question: 'Who owns the code?', answer: 'You do.' }]);
    expect(faq.mainEntity).toEqual([
      { '@type': 'Question', name: 'Who owns the code?', acceptedAnswer: { '@type': 'Answer', text: 'You do.' } },
    ]);
  });

  it('builds the Organization with contact points and structured office addresses', () => {
    const organization = organizationJsonLd({
      contact: { phone: '+1 (555) 010-0100', phoneE164: '+15550100100', email: 'hello@example.com' },
      offices: [{ city: 'Sacramento', address: '1201 J Street, Suite 200\nSacramento, CA 95814' }],
    });
    expect(organization['@id']).toBe('https://www.calwebtech.com/#organization');
    expect(organization.address).toEqual([
      {
        '@type': 'PostalAddress',
        streetAddress: '1201 J Street, Suite 200',
        addressLocality: 'Sacramento',
        addressRegion: 'CA',
        postalCode: '95814',
        addressCountry: 'US',
      },
    ]);
    expect(organization).not.toHaveProperty('sameAs');
  });

  it('builds a Service provided by the Organization, with an Offer when a price band is published', () => {
    const service = serviceJsonLd({
      name: 'Website redesign',
      description: 'Rebuilding a slow site into a fast one.',
      path: '/services/website-redesign/',
      areaServed: ['United States'],
      price: { min: 12000, max: 60000, currency: 'USD' },
    });
    expect(service).toMatchObject({
      '@type': 'Service',
      url: 'https://www.calwebtech.com/services/website-redesign/',
      provider: { '@id': 'https://www.calwebtech.com/#organization' },
      areaServed: [{ '@type': 'Place', name: 'United States' }],
      offers: { '@type': 'Offer', priceSpecification: { minPrice: 12000, maxPrice: 60000, priceCurrency: 'USD' } },
    });
    expect(serviceJsonLd({ name: 'A', description: 'B', path: '/services/a/' })).not.toHaveProperty('offers');
  });
});
