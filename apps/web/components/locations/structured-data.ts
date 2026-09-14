import { locationPath, type LocationDetailView } from '@calwebtech/shared';
import { organizationId, serviceJsonLd, type JsonLdObject } from '@/lib/seo/json-ld';
import { SITE_NAME, absoluteUrl } from '@/lib/seo/site';

/**
 * "1201 J Street, Suite 200" and "Sacramento, CA 95814" on separate lines, as a
 * PostalAddress. An address in another shape keeps its lines as the street address.
 */
export function locationPostalAddress(address: string, city: string): JsonLdObject {
  const lines = address
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const locality = /^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(lines.at(-1) ?? '');
  if (!locality || lines.length < 2) {
    return { '@type': 'PostalAddress', streetAddress: lines.join(', '), addressLocality: city };
  }
  return {
    '@type': 'PostalAddress',
    streetAddress: lines.slice(0, -1).join(', '),
    addressLocality: locality[1] ?? city,
    addressRegion: locality[2] ?? '',
    postalCode: locality[3] ?? '',
    addressCountry: 'US',
  };
}

/**
 * The city page's business node (docs/04-seo-keyword-map.md, "Schema per template"): a
 * ProfessionalService with its address and the places it serves, part of the site's
 * Organization. Where the location has no address there is no local business to describe,
 * so the page gets a Service with areaServed instead. FAQPage and BreadcrumbList come from
 * `FaqSection` and `Breadcrumbs`.
 */
export function locationJsonLd(page: LocationDetailView): JsonLdObject {
  const path = locationPath(page.slug);
  const place = page.state ? `${page.city}, ${page.state}` : page.city;
  const places = page.serviceAreaSection?.places ?? [];

  if (!page.address) {
    return serviceJsonLd({
      name: `Web design and development in ${page.city}`,
      description: page.seo.description,
      path,
      areaServed: [place, ...places],
    });
  }

  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${url}#business`,
    name: `${SITE_NAME} ${page.city}`,
    description: page.seo.description,
    url,
    telephone: page.contact.phoneE164,
    email: page.contact.email,
    address: locationPostalAddress(page.address, page.city),
    areaServed: [
      { '@type': 'City', name: place },
      ...places.map((name) => ({ '@type': 'Place', name })),
    ],
    parentOrganization: { '@id': organizationId() },
    ...(page.image ? { image: absoluteUrl(page.image.src) } : {}),
  };
}
