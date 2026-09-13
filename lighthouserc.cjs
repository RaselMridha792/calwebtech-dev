/**
 * Lighthouse CI budget gate for CLAUDE.md "Budget". `pnpm lh` runs it after
 * `pnpm build`, against a migrated and seeded database. scripts/lh-serve.mjs
 * starts the built API and web app behind a local HTTP/2 + TLS proxy, matching how
 * Traefik serves production. Every assertion uses the median of three runs.
 */
const median = { aggregationMethod: 'median-run' };

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/lh-serve.mjs',
      startServerReadyPattern: 'lh-serve: ready',
      startServerReadyTimeout: 240000,
      url: ['https://localhost:3443/lp/b2b-website-design/'],
      numberOfRuns: 3,
      settings: {
        // Campaign landing pages are noindex by design (docs/08-decisions.md), so
        // the crawlability audit fails on purpose. Indexable routes get a run
        // without this skip once they exist.
        skipAudits: ['is-crawlable'],
        // The proxy uses a throwaway self-signed certificate for localhost.
        chromeFlags: '--no-sandbox --ignore-certificate-errors',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, ...median }],
        'categories:accessibility': ['error', { minScore: 0.9, ...median }],
        'categories:best-practices': ['error', { minScore: 0.9, ...median }],
        'categories:seo': ['error', { minScore: 0.9, ...median }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500, ...median }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, ...median }],
        // INP needs real input. Total Blocking Time is its lab proxy.
        'total-blocking-time': ['error', { maxNumericValue: 200, ...median }],
        // Initial JavaScript, transferred (gzip) bytes.
        'resource-summary:script:size': ['error', { maxNumericValue: 150000, ...median }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
