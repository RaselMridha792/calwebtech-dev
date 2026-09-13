// Attributes client JavaScript to modules, shared by bundle-report.mjs and
// bundle-budget.mjs. Reads the analysis build in .next-analyze, which uses named
// Turbopack module ids, so each chunk can be split into the modules it contains.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const APP = path.resolve(import.meta.dirname, '..');
export const DIST = path.join(APP, '.next-analyze');

/** Code that ships on every route and is not ours to shrink. */
export const FRAMEWORK_PACKAGES = new Set([
  'next',
  'react',
  'react-dom',
  'scheduler',
  '@swc/helpers',
  'react-server-dom-turbopack',
]);

export const kB = (bytes) => (bytes / 1000).toFixed(1);

export function buildForAnalysis() {
  const next = path.join(APP, 'node_modules/next/dist/bin/next');
  const result = spawnSync(process.execPath, [next, 'build'], {
    cwd: APP,
    stdio: 'inherit',
    env: { ...process.env, BUNDLE_ANALYZE: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * @param {string} id a Turbopack module id such as
 *   "[project]/node_modules/.pnpm/next@16.3.5_x/node_modules/next/dist/client/app-index.js [app-client] (ecmascript)"
 */
export function describeModule(id) {
  const clean = id.replace(/^\[project\]\//, '').replace(/ \[app-client\].*$/, '');
  const pkg = clean.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)\/(.*)$/);
  if (!pkg) {
    return { module: clean, group: clean.split('/').slice(0, 2).join('/'), framework: false };
  }
  const [, name = '', rest = ''] = pkg;
  const group = name === 'next' ? `next/${rest.split('/').slice(0, 4).join('/')}` : name;
  return { module: `${name}/${rest}`, group, framework: FRAMEWORK_PACKAGES.has(name) };
}

/** Every app route with client components, keyed by its URL pattern. */
export function routeManifests(dist = DIST) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'page_client-reference-manifest.js') {
        const segments = path
          .relative(path.join(dist, 'server/app'), dir)
          .split(path.sep)
          .filter((segment) => segment && !(segment.startsWith('(') && segment.endsWith(')')));
        found.push({ route: `/${segments.join('/')}`, file: full });
      }
    }
  };
  walk(path.join(dist, 'server/app'));
  return found.sort((a, b) => a.route.localeCompare(b.route));
}

async function entryFiles(manifestFile) {
  globalThis.self = globalThis;
  globalThis.__RSC_MANIFEST = {};
  await import(`${pathToFileURL(manifestFile).href}?t=${Date.now()}`);
  const manifest = Object.values(globalThis.__RSC_MANIFEST)[0];
  return Object.values(manifest?.entryJSFiles ?? {}).flat();
}

/**
 * Initial client JavaScript of one route, split into framework and own code.
 * Each module's share of a chunk's real gzip size is estimated from the gzip size
 * of its own code. Chunks without module ids (the Turbopack runtime) are framework.
 */
export async function analyzeRoute({ route, file }, dist = DIST) {
  const build = JSON.parse(readFileSync(path.join(dist, 'build-manifest.json'), 'utf8'));
  const files = [...new Set([...build.rootMainFiles, ...(await entryFiles(file))])];
  const modules = [];
  const chunks = [];
  for (const chunk of files) {
    const text = readFileSync(path.join(dist, chunk), 'utf8');
    const chunkBytes = gzipSync(text).length;
    const ids = [...text.matchAll(/"(\[project\][^"]*?)",/g)];
    chunks.push({ chunk, bytes: chunkBytes, modules: ids.length });
    if (ids.length === 0) {
      modules.push({ module: `${chunk} (runtime)`, group: 'turbopack runtime', framework: true, bytes: chunkBytes });
      continue;
    }
    const pieces = ids.map((match, index) => {
      const start = match.index + match[0].length;
      const end = index + 1 < ids.length ? (ids[index + 1]?.index ?? text.length) : text.length;
      return { id: match[1] ?? '', size: gzipSync(text.slice(start, end)).length };
    });
    const estimated = pieces.reduce((sum, piece) => sum + piece.size, 0) || 1;
    for (const piece of pieces) {
      modules.push({ ...describeModule(piece.id), bytes: (piece.size / estimated) * chunkBytes });
    }
  }
  const framework = modules.filter((m) => m.framework).reduce((sum, m) => sum + m.bytes, 0);
  const own = modules.filter((m) => !m.framework).reduce((sum, m) => sum + m.bytes, 0);
  return { route, chunks, modules, totals: { total: framework + own, framework, own } };
}
