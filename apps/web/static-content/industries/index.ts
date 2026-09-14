import distribution from './distribution.json';
import ecommerceAndD2c from './ecommerce-and-d2c.json';
import education from './education.json';
import healthcare from './healthcare.json';
import hospitality from './hospitality.json';
import index from './index.json';
import manufacturing from './manufacturing.json';
import professionalServices from './professional-services.json';
import realEstate from './real-estate.json';
import saas from './saas.json';

/**
 * What `GET /pages/industries` and `GET /pages/industries/:slug` return, for the web app to
 * render while no API is hosted (docs/10-site-pages.md). The getters in lib/api/industries.ts
 * and industries.test.ts validate them with the shared schemas.
 */
export const industriesIndexSnapshot: unknown = index;

/** Industry page views keyed by slug, in the index order. A slug with no entry is a 404. */
export const industrySnapshots: Readonly<Partial<Record<string, unknown>>> = {
  manufacturing,
  distribution,
  'ecommerce-and-d2c': ecommerceAndD2c,
  saas,
  healthcare,
  'real-estate': realEstate,
  hospitality,
  'professional-services': professionalServices,
  education,
};
