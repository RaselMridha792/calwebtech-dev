// Reports a route's initial client JavaScript by module.
//
//   pnpm --filter @calwebtech/web analyze [route] [--no-build]
//
// Defaults to /lp/[campaign]. Sizes are gzip, in kB (1000 bytes), from the analysis build.
import { analyzeRoute, buildForAnalysis, kB, routeManifests } from './bundle-lib.mjs';

const args = process.argv.slice(2);
const wanted = args.find((arg) => arg.startsWith('/')) ?? '/lp/[campaign]';
if (!args.includes('--no-build')) buildForAnalysis();

const entry = routeManifests().find((item) => item.route === wanted);
if (!entry) throw new Error(`No client reference manifest for ${wanted}`);
const { chunks, modules, totals } = await analyzeRoute(entry);

console.log(`\nInitial JS for ${wanted}: ${kB(totals.total)} kB (framework ${kB(totals.framework)} kB, own ${kB(totals.own)} kB)\n`);
for (const chunk of chunks) console.log(`${kB(chunk.bytes).padStart(7)} kB  ${String(chunk.modules).padStart(3)} modules  ${chunk.chunk}`);

const groups = new Map();
for (const item of modules) {
  const current = groups.get(item.group) ?? { bytes: 0, framework: item.framework };
  current.bytes += item.bytes;
  groups.set(item.group, current);
}
console.log('\nBy package or folder');
for (const [group, value] of [...groups].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 25)) {
  console.log(`${kB(value.bytes).padStart(7)} kB  ${value.framework ? 'framework' : 'own      '}  ${group}`);
}

console.log('\nOwn code (counts against the per-route budget)');
for (const item of modules.filter((m) => !m.framework).sort((a, b) => b.bytes - a.bytes).slice(0, 30)) {
  console.log(`${kB(item.bytes).padStart(7)} kB  ${item.module}`);
}
