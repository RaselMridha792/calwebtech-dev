import about from './about.json';
import awards from './awards.json';
import partners from './partners.json';
import team from './team.json';
import technology from './technology.json';
import testimonials from './testimonials.json';

/**
 * What `GET /pages/<page>` returns for each company page, rendered while no API is hosted
 * (docs/10-site-pages.md). Validated by the shared view schemas in lib/api/company.ts and in
 * company.test.ts beside this file.
 */
export const companySnapshots = { about, team, testimonials, awards, partners, technology } as const;
