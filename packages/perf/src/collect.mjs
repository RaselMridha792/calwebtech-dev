// Collects Lighthouse runs for the budget gate with CPU throttling calibrated to the host.
//
//   node src/collect.mjs                       local gate: start the stack, measure it
//   node src/collect.mjs --url <page> --no-serve --out .lighthouseci-staging
//                                              measure an already-running site (staging)
//
// 1. Three calibration runs measure the host's benchmark index; the fastest counts. The
//    CPU multiplier is set from it (calibrate.mjs), so a slower runner is slowed down less.
// 2. Measured runs repeat until there are five healthy ones. A run whose benchmark index
//    left the band around calibration would be judged too strictly or too leniently, and
//    is discarded. Without five healthy runs the gate fails; it never passes on a guess.
// 3. Healthy results are written as lhr-*.json for `lhci assert` and `lhci upload`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { calibrationBenchmark, cpuMultiplierFor, HEALTHY_BAND, isHealthyRun } from './calibrate.mjs';
import { EDGE, PAGES, startStack } from './serve.mjs';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', multiple: true },
    out: { type: 'string', default: '.lighthouseci' },
    'no-serve': { type: 'boolean', default: false },
    runs: { type: 'string', default: '5' },
  },
});

const RUNS = Number(args.runs);
const MAX_ATTEMPTS = RUNS * 2;
const CALIBRATION_RUNS = 3;
const BAND = `${Math.round(HEALTHY_BAND.min * 100)}–${Math.round(HEALTHY_BAND.max * 100)}% of calibration`;
const OUT = path.resolve(import.meta.dirname, '..', args.out);
const URLS = args.url ?? PAGES.map((page) => `${EDGE}${page}`);

// Lighthouse's mobile network profile (mobileSlow4G). Only the CPU multiplier changes.
const MOBILE_NETWORK = {
  rttMs: 150,
  throughputKbps: 1638.4,
  requestLatencyMs: 562.5,
  downloadThroughputKbps: 1474.56,
  uploadThroughputKbps: 675,
};

// For staging behind HTTP basic auth: LH_EXTRA_HEADERS='{"Authorization":"Basic ..."}'.
const extraHeaders = process.env.LH_EXTRA_HEADERS ? JSON.parse(process.env.LH_EXTRA_HEADERS) : undefined;

async function runLighthouse(url, cpuSlowdownMultiplier) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--ignore-certificate-errors'],
  });
  try {
    const result = await lighthouse(
      url,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      {
        extends: 'lighthouse:default',
        settings: {
          formFactor: 'mobile',
          throttlingMethod: 'simulate',
          throttling: { ...MOBILE_NETWORK, cpuSlowdownMultiplier },
          // Campaign pages are noindex by design (docs/08-decisions.md). Every other page
          // keeps the crawlability audit; skipping it there would relax the SEO gate. The
          // homepage keeps it too: it is measured with homepage.indexing switched on.
          skipAudits: new URL(url).pathname.startsWith('/lp/') ? ['is-crawlable'] : [],
          ...(extraHeaders ? { extraHeaders } : {}),
        },
      },
    );
    if (!result) throw new Error('Lighthouse returned no result');
    if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
    return result.lhr;
  } finally {
    try {
      await chrome.kill();
    } catch {
      // Windows sometimes refuses to delete Chrome's temporary profile.
    }
  }
}

function summary(lhr) {
  const audit = (id) => Math.round(lhr.audits[id]?.numericValue ?? Number.NaN);
  return `perf=${lhr.categories.performance?.score} LCP=${audit('largest-contentful-paint')} TBT=${audit('total-blocking-time')} CLS=${lhr.audits['cumulative-layout-shift']?.numericValue}`;
}

// homepage.indexing gives the homepage its meta robots; site.indexing gives robots.txt,
// which disallows all crawling while it is off. is-crawlable fails on either.
const INDEXING_SETTINGS = ['homepage.indexing', 'site.indexing'];
const API_DIR = path.resolve(import.meta.dirname, '../../../apps/api');

function settingsCli(...cliArgs) {
  return execFileSync(process.execPath, ['dist/settings-cli.js', ...cliArgs], { cwd: API_DIR, encoding: 'utf8' });
}

/**
 * Pages are noindex, and robots.txt disallows crawling, until homepage.indexing and
 * site.indexing are on, and both fail the is-crawlable audit by design. The gate measures
 * pages as they ship once indexable, locally and in CI alike, and returns a function that
 * puts the settings back. Done before the stack starts, so the API's short caches cannot
 * serve the old values. Never with --no-serve, which measures a site whose database this
 * process does not own.
 */
function indexPagesForTheRun() {
  const previous = INDEXING_SETTINGS.map((key) => [key, JSON.parse(settingsCli('get', key))]);
  for (const key of INDEXING_SETTINGS) settingsCli('set', key, JSON.stringify({ index: true }));
  // A missing row already means noindex, and the CLI cannot delete one.
  return () => {
    for (const [key, value] of previous) settingsCli('set', key, JSON.stringify(value ?? { index: false }));
  };
}

const report = { urls: URLS, calibration: [], runs: [] };
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const restoreIndexing = args['no-serve'] ? null : indexPagesForTheRun();
let stack = null;

try {
  stack = args['no-serve'] ? null : await startStack();

  for (const url of URLS) {
    const benchmarks = [];
    for (let i = 0; i < CALIBRATION_RUNS; i++) {
      const lhr = await runLighthouse(url, 4);
      benchmarks.push(lhr.environment.benchmarkIndex);
    }
    const calibrated = calibrationBenchmark(benchmarks);
    const multiplier = cpuMultiplierFor(calibrated);
    report.calibration.push({ url, benchmarks, calibrated, multiplier });
    console.log(`collect: ${url} benchmark ${benchmarks.map(Math.round).join('/')} -> cpuSlowdownMultiplier ${multiplier}`);

    let healthy = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && healthy < RUNS; attempt++) {
      let lhr;
      try {
        lhr = await runLighthouse(url, multiplier);
      } catch (error) {
        console.log(`collect: attempt ${attempt} failed: ${String(error)}`);
        report.runs.push({ url, attempt, error: String(error) });
        continue;
      }
      const benchmark = lhr.environment.benchmarkIndex;
      const ok = isHealthyRun(benchmark, calibrated);
      report.runs.push({ url, attempt, benchmark, healthy: ok, summary: summary(lhr) });
      console.log(`collect: attempt ${attempt} benchmark ${Math.round(benchmark)} ${ok ? 'kept' : `discarded (outside ${BAND})`} ${summary(lhr)}`);
      if (!ok) continue;
      healthy += 1;
      writeFileSync(path.join(OUT, `lhr-${Date.now()}.json`), JSON.stringify(lhr));
    }
    if (healthy < RUNS) {
      throw new Error(`collect: only ${healthy} of ${RUNS} healthy runs for ${url} after ${MAX_ATTEMPTS} attempts (kept only runs within ${BAND}); the host's speed was too unstable to measure, so the gate fails rather than guess`);
    }
  }
} finally {
  writeFileSync(path.join(OUT, 'collect-report.json'), JSON.stringify(report, null, 2));
  stack?.stop();
  restoreIndexing?.();
}
