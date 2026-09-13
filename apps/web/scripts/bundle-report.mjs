// Attributes a route's initial client JavaScript to modules.
//
//   pnpm --filter @calwebtech/web analyze [route]      (default route: /lp/[campaign])
//
// Builds into .next-analyze with named Turbopack module ids, then reads the chunks
// the route loads on first paint: the framework's root main files plus the route's
// layout and page entries. Polyfills are excluded because modern browsers skip the
// nomodule script. Each module's share of a chunk's real gzip size is estimated
// from the gzip size of its own code.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const app = path.resolve(import.meta.dirname, '..');
const dist = path.join(app, '.next-analyze');
const args = process.argv.slice(2);
const route = args.find((arg) => arg.startsWith('/')) ?? '/lp/[campaign]';

if (!args.includes('--no-build')) {
  const next = path.join(app, 'node_modules/next/dist/bin/next');
  const result = spawnSync(process.execPath, [next, 'build'], {
    cwd: app,
    stdio: 'inherit',
    env: { ...process.env, BUNDLE_ANALYZE: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const gz = (text) => gzipSync(text).length;
const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(6);

function findManifest(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = findManifest(full);
      if (found) return found;
    } else if (entry === 'page_client-reference-manifest.js') {
      const segments = path
        .relative(path.join(dist, 'server/app'), dir)
        .split(path.sep)
        .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));
      if (`/${segments.join('/')}` === route) return full;
    }
  }
  return null;
}

const manifestFile = findManifest(path.join(dist, 'server/app'));
if (!manifestFile) throw new Error(`No client reference manifest for ${route}`);
globalThis.self = globalThis;
globalThis.__RSC_MANIFEST = {};
await import(`file://${manifestFile.replaceAll('\\', '/')}`);
const clientManifest = Object.values(globalThis.__RSC_MANIFEST)[0];
const buildManifest = JSON.parse(readFileSync(path.join(dist, 'build-manifest.json'), 'utf8'));

const files = [
  ...new Set([...buildManifest.rootMainFiles, ...Object.values(clientManifest.entryJSFiles).flat()]),
];
const framework = new Set(buildManifest.rootMainFiles);

function label(id) {
  const clean = id.replace(/^\[project\]\//, '').replace(/ \[app-client\].*$/, '');
  const pkg = clean.match(/node_modules\/\.pnpm\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+)\/(.*)$/);
  if (!pkg) return { group: clean.split('/').slice(0, 2).join('/'), module: clean };
  const [, name, rest] = pkg;
  const area = rest.split('/').slice(0, name === 'next' ? 4 : 1).join('/');
  return { group: name === 'next' ? `next/${area}` : name, module: `${name}/${rest}` };
}

const modules = [];
let total = 0;
const chunkRows = [];
for (const file of files) {
  const text = readFileSync(path.join(dist, file), 'utf8');
  const chunkGz = gz(text);
  total += chunkGz;
  const ids = [...text.matchAll(/"(\[project\][^"]*?)",/g)];
  const pieces = ids.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < ids.length ? ids[index + 1].index : text.length;
    return { id: match[1], size: gz(text.slice(start, end)) };
  });
  const estimated = pieces.reduce((sum, piece) => sum + piece.size, 0) || 1;
  for (const piece of pieces) {
    modules.push({ ...label(piece.id), bytes: (piece.size / estimated) * chunkGz, framework: framework.has(file) });
  }
  chunkRows.push({ file, chunkGz, count: pieces.length, framework: framework.has(file) });
}

console.log(`\nInitial JS for ${route}: ${kb(total)} KB gzip across ${files.length} files\n`);
for (const row of chunkRows) {
  console.log(`${kb(row.chunkGz)} KB  ${row.framework ? 'framework' : 'route    '}  ${row.count} modules  ${row.file}`);
}

const groups = new Map();
for (const entry of modules) {
  const current = groups.get(entry.group) ?? { bytes: 0, framework: entry.framework };
  current.bytes += entry.bytes;
  groups.set(entry.group, current);
}
console.log('\nBy package or folder');
for (const [group, value] of [...groups].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 25)) {
  console.log(`${kb(value.bytes)} KB  ${group}`);
}

console.log('\nRoute modules (loaded by the layout and page, not by the framework)');
for (const entry of modules.filter((m) => !m.framework).sort((a, b) => b.bytes - a.bytes).slice(0, 30)) {
  console.log(`${kb(entry.bytes)} KB  ${entry.module}`);
}
