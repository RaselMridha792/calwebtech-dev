import { LandingPagesService } from '../../landing-pages/landing-pages.service';
import type { FamilyChecks } from './index';

const SLUG = 'b2b-website-design';

/** The campaign landing page. Null, which fails the comparison, until the page is published. */
export const checks: FamilyChecks = (prisma) => [
  {
    title: `GET /landing-pages/${SLUG}`,
    snapshot: `landing-${SLUG}.json`,
    view: () => new LandingPagesService(prisma).findPublished(SLUG),
  },
];
