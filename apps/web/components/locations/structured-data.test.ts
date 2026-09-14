import { locationDetailViewSchema, type LocationDetailView } from '@calwebtech/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import austin from '@/static-content/locations/austin.json';
import sacramento from '@/static-content/locations/sacramento.json';
import { locationJsonLd, locationPostalAddress } from './structured-data';

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const page = (snapshot: unknown): LocationDetailView => locationDetailViewSchema.parse(snapshot);

describe('locationPostalAddress', () => {
  it('reads a US street line and a "City, ST 00000" line', () => {
    expect(locationPostalAddress('1201 J Street, Suite 200\nSacramento, CA 95814', 'Sacramento')).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '1201 J Street, Suite 200',
      addressLocality: 'Sacramento',
      addressRegion: 'CA',
      postalCode: '95814',
      addressCountry: 'US',
    });
  });

  it('keeps an address in another shape as the street address, in the page city', () => {
    expect(locationPostalAddress('Level 3, Harbour House', 'Test City')).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Level 3, Harbour House',
      addressLocality: 'Test City',
    });
  });
});

describe('locationJsonLd', () => {
  it('describes an office as a ProfessionalService, a LocalBusiness type, with its address and the areas it serves', () => {
    const view = page(sacramento);
    const node = locationJsonLd(view);
    expect(node).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      '@id': 'https://www.calwebtech.com/locations/sacramento/#business',
      url: 'https://www.calwebtech.com/locations/sacramento/',
      telephone: view.contact.phoneE164,
      parentOrganization: { '@id': 'https://www.calwebtech.com/#organization' },
      address: { '@type': 'PostalAddress', postalCode: '95814' },
    });
    const areas = node.areaServed as { '@type': string; name: string }[];
    expect(areas[0]).toEqual({ '@type': 'City', name: 'Sacramento, CA' });
    expect(areas.slice(1).map((area) => area.name)).toEqual(view.serviceAreaSection?.places);
  });

  it('gives a location without an address a Service with areaServed, never a business address it does not have', () => {
    const view = { ...page(austin), address: null };
    const node = locationJsonLd(view);
    expect(node['@type']).toBe('Service');
    expect(node).not.toHaveProperty('address');
    expect((node.areaServed as { name: string }[])[0]?.name).toBe('Austin, TX');
  });
});
