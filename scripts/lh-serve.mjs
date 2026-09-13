// Starts the built API and web app for Lighthouse CI, waits until both answer,
// warms the page and its images, then prints the line lighthouserc.cjs waits for.
// Warming measures steady state: in production the ISR and image caches are warm
// after the first visitor, and a cold optimiser would only measure the build box.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const WEB = 'http://localhost:3000';
const PAGE = `${WEB}/lp/b2b-website-design/`;
const env = {
  ...process.env,
  NODE_ENV: 'production',
  API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? 'http://localhost:4000',
  APP_ORIGIN: process.env.APP_ORIGIN ?? WEB,
};

const children = [
  spawn(process.execPath, ['dist/main.js'], { cwd: path.join(root, 'apps/api'), env, stdio: 'inherit' }),
  spawn(
    process.execPath,
    [path.join(root, 'apps/web/node_modules/next/dist/bin/next'), 'start', '--port', '3000'],
    { cwd: path.join(root, 'apps/web'), env, stdio: 'inherit' },
  ),
];

const stop = () => {
  for (const child of children) if (child.exitCode === null) child.kill();
};
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}
process.on('exit', stop);
for (const child of children) {
  child.on('exit', (code) => {
    if (code) {
      console.error(`lh-serve: a server exited with code ${code}`);
      stop();
      process.exit(1);
    }
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error(`lh-serve: timed out waiting for ${url}`);
}

async function warm() {
  const html = await (await fetch(PAGE)).text();
  const images = [
    ...new Set(
      // With trailingSlash the optimiser URL is /_next/image/?url=...
      [...html.matchAll(/\/_next\/image\/?\?[^"'\s,]+/g)].map((match) => match[0].replaceAll('&amp;', '&')),
    ),
  ];
  // Lighthouse emulates a 412px phone at 1.75x, so it never asks for 1200px and up.
  const queue = images.filter((src) => Number(new URLSearchParams(src.split('?')[1]).get('w')) < 1200);
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      await fetch(`${WEB}${next}`).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`lh-serve: warmed page and ${images.length} image variants`);
}

try {
  await waitFor('http://localhost:4000/health', 90000);
  await waitFor(`${WEB}/health/`, 90000);
  await warm();
  console.log('lh-serve: ready');
} catch (error) {
  console.error(error);
  stop();
  process.exit(1);
}
