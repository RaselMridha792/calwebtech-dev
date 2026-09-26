import type { SiteContact } from '@calwebtech/shared';
import { SITE_NAME, absoluteUrl, siteOrigin } from './site';

export type JsonLdValue = string | number | boolean | null | readonly JsonLdValue[] | { readonly [key: string]: JsonLdValue };
export type JsonLdObject = { readonly [key: string]: JsonLdValue };

// Legal inside JSON strings, but line terminators in older JavaScript parsers.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * JSON for a `<script type="application/ld+json">`. Record text can contain `</script>`
 * or an HTML comment opener, so `<`, `>` and `&` are written as JSON unicode escapes, which
 * parse back to the same characters. The line and paragraph separators are escaped too.
 */
export function serializeJsonLd(data: JsonLdObject | readonly JsonLdObject[]): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

const CONTEXT = 'https://schema.org';

/** The Organization node's id. Other nodes refer to it instead of repeating it. */
export const organizationId = (): string => `${siteOrigin()}/#organization`;

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbListJsonLd(crumbs: readonly Crumb[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function faqPageJsonLd(items: readonly { question: string; answer: string }[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** "1201 J Street, Suite 200" and "Sacramento, CA 95814" on separate lines, as a PostalAddress. */
function postalAddress(office: { city: string; address: string }): JsonLdObject {
  const lines = office.address
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const locality = /^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(lines.at(-1) ?? '');
  if (!locality || lines.length < 2) {
    return { '@type': 'PostalAddress', streetAddress: lines.join(', '), addressLocality: office.city };
  }
  return {
    '@type': 'PostalAddress',
    streetAddress: lines.slice(0, -1).join(', '),
    addressLocality: locality[1] ?? office.city,
    addressRegion: locality[2] ?? '',
    postalCode: locality[3] ?? '',
    addressCountry: 'US',
  };
}

export interface OrganizationJsonLdInput {
  contact: SiteContact;
  offices: readonly { city: string; address: string }[];
  /** Profiles that are verifiably this company, such as review platform pages. */
  sameAs?: readonly string[];
}

/** The site-wide Organization node, rendered once per page by the site layout. */
export function organizationJsonLd({ contact, offices, sameAs = [] }: OrganizationJsonLdInput): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': organizationId(),
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/icon.svg'),
    email: contact.email,
    // A telephone property with no number is worse than none: structured data is read as fact.
    ...(contact.phoneE164 ? { telephone: contact.phoneE164 } : {}),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        ...(contact.phoneE164 ? { telephone: contact.phoneE164 } : {}),
        email: contact.email,
        availableLanguage: ['English'],
      },
    ],
    ...(offices.length > 0 ? { address: offices.map(postalAddress) } : {}),
    ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
  };
}

export interface ServiceJsonLdInput {
  name: string;
  description: string;
  path: string;
  serviceType?: string;
  /** Places served, such as "United States", or the city on a location page. */
  areaServed?: readonly string[];
  /** The published starting price band, in whole currency units. */
  price?: { min: number; max?: number; currency: string };
}

/** Service with an Offer carrying the price range (docs/04-seo-keyword-map.md). */
export function serviceJsonLd(input: ServiceJsonLdInput): JsonLdObject {
  const url = absoluteUrl(input.path);
  const { price } = input;
  return {
    '@context': CONTEXT,
    '@type': 'Service',
    '@id': `${url}#service`,
    name: input.name,
    description: input.description,
    url,
    provider: { '@id': organizationId() },
    ...(input.serviceType ? { serviceType: input.serviceType } : {}),
    ...(input.areaServed && input.areaServed.length > 0
      ? { areaServed: input.areaServed.map((name) => ({ '@type': 'Place', name })) }
      : {}),
    ...(price
      ? {
          offers: {
            '@type': 'Offer',
            url,
            priceCurrency: price.currency,
            priceSpecification: {
              '@type': 'PriceSpecification',
              priceCurrency: price.currency,
              minPrice: price.min,
              ...(price.max !== undefined ? { maxPrice: price.max } : {}),
            },
          },
        }
      : {}),
  };
}
