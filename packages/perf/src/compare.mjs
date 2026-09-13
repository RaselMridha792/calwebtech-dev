// Compares two sets of Lighthouse results page by page, e.g. the local edge proxy
// against staging behind the real Traefik:
//
//   node src/compare.mjs .lighthouseci .lighthouseci-staging
//
// Exits 1 when a median metric diverges beyond tolerance. That means the lab gate no
// longer predicts production and has to be fixed (docs/09-performance.md).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { median } from './calibrate.mjs';

/** A difference counts only when it exceeds both the floor and the relative share. */
export const TOLERANCES = [
  { label: 'Performance', read: (lhr) => lhr.categories.performance?.score ?? Number.NaN, floor: 0.05, relative: 0 },
  { label: 'FCP (ms)', read: (lhr) => lhr.audits['first-contentful-paint']?.numericValue, floor: 150, relative: 0.15 },
  { label: 'LCP (ms)', read: (lhr) => lhr.audits['largest-contentful-paint']?.numericValue, floor: 150, relative: 0.15 },
  { label: 'TBT (ms)', read: (lhr) => lhr.audits['total-blocking-time']?.numericValue, floor: 50, relative: 0.25 },
  { label: 'CLS', read: (lhr) => lhr.audits['cumulative-layout-shift']?.numericValue, floor: 0.02, relative: 0 },
  {
    label: 'Script (KB)',
    read: (lhr) =>
      (lhr.audits['resource-summary']?.details?.items?.find((item) => item.resourceType === 'script')?.transferSize ?? 0) / 1024,
    floor: 5,
    relative: 0.05,
  },
];

export function diverges(baseline, candidate, { floor, relative }) {
  const difference = Math.abs(candidate - baseline);
  return difference > floor && difference > Math.abs(baseline) * relative;
}

function loadByPage(dir) {
  const pages = new Map();
  for (const file of readdirSync(dir).filter((name) => /^lhr-.*\.json$/.test(name))) {
    const lhr = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    const page = new URL(lhr.finalDisplayedUrl).pathname;
    pages.set(page, [...(pages.get(page) ?? []), lhr]);
  }
  return pages;
}

function main() {
  const [baselineDir, candidateDir] = process.argv.slice(2);
  if (!baselineDir || !candidateDir) {
    console.error('usage: node src/compare.mjs <baseline results> <candidate results>');
    process.exit(2);
  }
  const baseline = loadByPage(path.resolve(baselineDir));
  const candidate = loadByPage(path.resolve(candidateDir));
  let failed = false;

  for (const [page, baseRuns] of baseline) {
    const candidateRuns = candidate.get(page);
    if (!candidateRuns) {
      console.log(`${page}: missing from ${candidateDir}`);
      failed = true;
      continue;
    }
    console.log(`\n${page}  (${baseRuns.length} vs ${candidateRuns.length} runs, medians)`);
    for (const tolerance of TOLERANCES) {
      const a = median(baseRuns.map(tolerance.read));
      const b = median(candidateRuns.map(tolerance.read));
      const off = diverges(a, b, tolerance);
      failed ||= off;
      console.log(`  ${tolerance.label.padEnd(12)} ${a.toFixed(2).padStart(10)} ${b.toFixed(2).padStart(10)}  ${off ? 'DIVERGES' : 'ok'}`);
    }
  }
  if (failed) {
    console.log('\nThe lab gate and the candidate disagree beyond tolerance. Fix the gate before trusting it.');
    process.exit(1);
  }
  console.log('\nWithin tolerance.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
