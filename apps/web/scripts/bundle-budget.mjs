// Per-route budget for our own client JavaScript (CLAUDE.md "Budget").
//
//   pnpm --filter @calwebtech/web budget [--no-build]
//
// Own code is everything that is not React, React DOM or the Next.js runtime: our
// components, workspace packages and any third-party library we add. It must stay
// under 20 kB gzip per route. The framework is reported beside it but has no gate here
// (the 150 kB Lighthouse gate covers the total), so a Next.js upgrade that grows the
// framework shows up as framework growth, not as page bloat.
import { analyzeRoute, buildForAnalysis, kB, routeManifests } from './bundle-lib.mjs';

export const OWN_CODE_BUDGET_BYTES = 20_000;

if (!process.argv.includes('--no-build')) buildForAnalysis();

let failed = false;
console.log('\nroute                          framework        own   budget');
for (const entry of routeManifests()) {
  const { totals, modules } = await analyzeRoute(entry);
  const over = totals.own > OWN_CODE_BUDGET_BYTES;
  failed ||= over;
  console.log(
    `${entry.route.padEnd(28)} ${kB(totals.framework).padStart(9)} kB ${kB(totals.own).padStart(7)} kB  ${over ? 'OVER' : 'ok'}`,
  );
  if (over) {
    for (const item of modules.filter((m) => !m.framework).sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
      console.log(`    ${kB(item.bytes).padStart(6)} kB  ${item.module}`);
    }
  }
}

if (failed) {
  console.error(`\nOwn client JavaScript exceeds ${kB(OWN_CODE_BUDGET_BYTES)} kB on at least one route.`);
  process.exit(1);
}
console.log(`\nEvery route is within the ${kB(OWN_CODE_BUDGET_BYTES)} kB own-code budget.`);
