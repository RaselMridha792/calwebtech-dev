// Starts the built API and web app for Lighthouse CI, puts an HTTP/2 + TLS proxy in
// front of the web app, warms the page and its images, then prints the line
// lighthouserc.cjs waits for.
//
// Why a proxy: production is served over HTTP/2 and TLS by Traefik, but `next start`
// only speaks HTTP/1.1. Lighthouse's simulated throttling models the connections it
// observes, so measuring over HTTP/1.1 scored LCP about 370ms worse than the same
// build over HTTP/2. The budget and throttling method are unchanged; only the
// transport matches production.
//
// Why warm: in production the ISR and image caches are warm after the first visitor,
// and a cold optimiser would only measure the build box.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import http2 from 'node:http2';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const WEB = 'http://localhost:3000';
const PROXY_PORT = 3443;
const PROXY = `https://localhost:${PROXY_PORT}`;
const PAGE = `${WEB}/lp/b2b-website-design/`;
const CHROME_IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';

const env = {
  ...process.env,
  NODE_ENV: 'production',
  API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? 'http://localhost:4000',
  // Canonical URLs must match the origin Lighthouse loads.
  APP_ORIGIN: PROXY,
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

/** A throwaway self-signed certificate for localhost, made with openssl. */
function localCertificate() {
  const dir = path.join(os.tmpdir(), 'calwebtech-lh-tls');
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  if (!existsSync(cert) || !existsSync(key)) {
    mkdirSync(dir, { recursive: true });
    try {
      execFileSync(
        'openssl',
        ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '7', '-subj', '/CN=localhost'],
        { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
      );
    } catch {
      throw new Error('lh-serve: openssl is required to create the local TLS certificate');
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

const TEXT = /text\/|javascript|json|svg|css|xml/;
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-encoding', 'content-length']);

const proxy = http2.createSecureServer(localCertificate(), async (req, res) => {
  try {
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !name.startsWith(':')));
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(await Array.fromAsync(req));
    const upstream = await fetch(`${WEB}${req.url}`, {
      method: req.method,
      headers: { ...headers, host: 'localhost:3000', 'accept-encoding': 'identity' },
      body,
      redirect: 'manual',
    });
    const out = Object.fromEntries([...upstream.headers].filter(([name]) => !HOP_BY_HOP.has(name)));
    let payload = Buffer.from(await upstream.arrayBuffer());
    // Compress text as the production proxy does.
    if (TEXT.test(out['content-type'] ?? '') && /gzip/.test(String(req.headers['accept-encoding'] ?? ''))) {
      payload = gzipSync(payload);
      out['content-encoding'] = 'gzip';
    }
    res.writeHead(upstream.status, out);
    res.end(payload);
  } catch (error) {
    res.writeHead(502);
    res.end(String(error));
  }
});

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
      // The optimiser caches per output format, so ask the way Chrome does.
      await fetch(`${WEB}${next}`, { headers: { accept: CHROME_IMAGE_ACCEPT } }).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`lh-serve: warmed page and ${images.length} image variants`);
}

try {
  await waitFor('http://localhost:4000/health', 90000);
  await waitFor(`${WEB}/health/`, 90000);
  await warm();
  await new Promise((resolve) => proxy.listen(PROXY_PORT, resolve));
  console.log(`lh-serve: HTTP/2 proxy on ${PROXY}`);
  console.log('lh-serve: ready');
} catch (error) {
  console.error(error);
  stop();
  process.exit(1);
}
