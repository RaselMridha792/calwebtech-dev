import distribution from './distribution.json';
import ecommerceAndD2c from './ecommerce-and-d2c.json';
import education from './education.json';
import healthcare from './healthcare.json';
import hospitality from './hospitality.json';
import index from './index.json';
import lawFirms from './law-firms.json';
import manufacturing from './manufacturing.json';
import mediaAndPublishing from './media-and-publishing.json';
import professionalServices from './professional-services.json';
import realEstate from './real-estate.json';
import saas from './saas.json';
import spaCentres from './spa-centres.json';

/**
 * What `GET /pages/industries` and `GET /pages/industries/:slug` return, for the web app to
 * render while no API is hosted (docs/10-site-pages.md). The getters in lib/api/industries.ts
 * and industries.test.ts validate them with the shared schemas.
 */
export const industriesIndexSnapshot: unknown = index;

/** Industry page views keyed by slug, in the index order. A slug with no entry is a 404. */
export const industrySnapshots: Readonly<Partial<Record<string, unknown>>> = {
  // The owner's order (revision of 2026-09-22), then the rest as they were.
  hospitality,
  'real-estate': realEstate,
  'spa-centres': spaCentres,
  'media-and-publishing': mediaAndPublishing,
  'law-firms': lawFirms,
  healthcare,
  manufacturing,
  distribution,
  'ecommerce-and-d2c': ecommerceAndD2c,
  saas,
  'professional-services': professionalServices,
  education,
};
