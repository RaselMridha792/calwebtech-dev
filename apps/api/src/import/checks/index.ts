import type { PrismaService } from '../../prisma/prisma.service';
import { checks as calculator } from './calculator';
import { checks as company } from './company';
import { checks as forms } from './forms';
import { checks as guidesGlossary } from './guides-glossary';
import { checks as home } from './home';
import { checks as industries } from './industries';
import { checks as insights } from './insights';
import { checks as landing } from './landing';
import { checks as locations } from './locations';
import { checks as services } from './services';
import { checks as staticPages } from './static';
import { checks as work } from './work';

/**
 * What the content import must reproduce: one check per API view, comparing the service's
 * answer, JSON round-tripped as the controller would send it, with the snapshot file the
 * importer read (apps/web/static-content). import.integration.test.ts runs them on a
 * database of its own. Each family keeps its checks in checks/<family>.ts and is listed
 * below, one line per family.
 */
export interface Check {
  /** Shown in the test title, e.g. "GET /pages/services/care-plans". */
  title: string;
  /** The snapshot file, relative to the snapshot directory. */
  snapshot: string;
  /** The view, from a freshly constructed service so no cache from an earlier check is reused. */
  view: () => Promise<unknown>;
}

export type FamilyChecks = (prisma: PrismaService) => Check[];

export const FAMILIES: ReadonlyArray<{ family: string; checks: FamilyChecks }> = [
  { family: 'home', checks: home },
  { family: 'landing', checks: landing },
  { family: 'services', checks: services },
  { family: 'industries', checks: industries },
  { family: 'work', checks: work },
  { family: 'company', checks: company },
  { family: 'static', checks: staticPages },
  { family: 'locations', checks: locations },
  { family: 'insights', checks: insights },
  { family: 'guides-glossary', checks: guidesGlossary },
  { family: 'calculator', checks: calculator },
  { family: 'forms', checks: forms },
];
