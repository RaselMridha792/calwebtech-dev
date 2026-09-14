// Regenerates static-content/site-chrome.json from static-content/home.json with the same
// builder the API uses (buildSiteChrome in packages/shared), so the demo chrome always
// matches the demo homepage. static-content/static-content.test.ts fails until it is rerun.
//
//   pnpm --filter @calwebtech/shared build && node apps/web/scripts/site-chrome-snapshot.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(app, 'package.json'));
const shared = require('@calwebtech/shared');

const home = shared.homePageViewSchema.parse(JSON.parse(readFileSync(path.join(app, 'static-content/home.json'), 'utf8')));
const chrome = shared.siteChromeViewSchema.parse(
  shared.buildSiteChrome({
    indexable: false,
    content: home.content,
    contact: home.contact,
    reviews: home.reviews,
    serviceGroups: home.serviceGroups,
    services: home.services,
    industries: home.industries,
    projects: home.projects,
    offices: home.locations,
  }),
);
writeFileSync(path.join(app, 'static-content/site-chrome.json'), `${JSON.stringify(chrome, null, 2)}\n`);
console.log('static-content/site-chrome.json written');
