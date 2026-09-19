import { HomePageService } from '../../home/home-page.service';
import { SiteChromeService } from '../../site/site-chrome.service';
import type { FamilyChecks } from './index';

/**
 * The homepage, and the site chrome built from the same copy and records (site-chrome.json
 * is derived from home.json by `buildSiteChrome`, so it follows once the homepage does).
 */
export const checks: FamilyChecks = (prisma) => [
  { title: 'GET /pages/home', snapshot: 'home.json', view: () => new HomePageService(prisma).find() },
  { title: 'GET /site/chrome', snapshot: 'site-chrome.json', view: () => new SiteChromeService(prisma).find() },
];
