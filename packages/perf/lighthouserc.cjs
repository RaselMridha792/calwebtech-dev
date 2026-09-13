/**
 * Lighthouse CI assertions for CLAUDE.md "Budget".
 *
 * Results come from src/collect.mjs, which serves the built apps behind an edge proxy
 * mirroring Traefik and calibrates CPU throttling to the host. This file only asserts
 * on those results and stores them. Every assertion uses the median of five runs.
 */
const median = { aggregationMethod: 'median-run' };

module.exports = {
  ci: {
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
        // Initial JavaScript, transferred (compressed) bytes, framework included.
        'resource-summary:script:size': ['error', { maxNumericValue: 150000, ...median }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
