// Starts the built API and web app for the Lighthouse gate and the end-to-end tests,
// behind a local edge proxy that mirrors Traefik (infra/traefik/dynamic/edge.yml):
// the same TLS versions, cipher suites, curves, ALPN and compression.
//
// Why a proxy: `next start` only speaks HTTP/1.1, while production is served over
// HTTP/2 and TLS. Lighthouse's simulated throttling models the connections it
// observes, so the transport has to match production.
//
// Why memoise and warm: in production the ISR, image and edge caches are warm after
// the first visitor. Compressing on every request would also steal CPU from Chrome
// while it is being measured, which is a source of run-to-run variance.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import http2 from 'node:http2';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { chooseEncoding, edgeSettings } from './edge.mjs';

const root = path.resolve(import.meta.dirname, '../../..');

export const WEB = 'http://localhost:3000';
export const API = 'http://localhost:4000';
export const EDGE_PORT = 3443;
export const EDGE = `https://localhost:${EDGE_PORT}`;
export const PAGES = ['/lp/b2b-website-design/'];

const CHROME_ACCEPT_ENCODING = 'gzip, deflate, br, zstd';
const CHROME_IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length']);

// Traefik's compress middleware uses default levels: brotli 6, gzip 6.
const COMPRESSORS = {
  br: (body) => zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } }),
  gzip: (body) => zlib.gzipSync(body, { level: 6 }),
  zstd: (body) => zlib.zstdCompressSync(body),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A throwaway self-signed certificate for localhost, made with openssl. */
function localCertificate() {
  const dir = path.join(os.tmpdir(), 'calwebtech-edge-tls');
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
      throw new Error('serve: openssl is required to create the local TLS certificate');
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

function createEdge() {
  const { tls, compress } = edgeSettings();
  const cache = new Map();

  const handler = async (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';
    const key = [
      method,
      url,
      req.headers['accept-encoding'],
      req.headers.accept,
      req.headers.rsc,
      req.headers['next-router-prefetch'],
      req.headers['next-router-state-tree'],
    ].join('|');
    try {
      let response = cache.get(key);
      if (!response) {
        const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !name.startsWith(':')));
        const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(await Array.fromAsync(req));
        // Like Traefik: keep the public Host and add X-Forwarded-*. Next.js checks the
        // Origin of Server Action requests against the forwarded host, so rewriting Host
        // to the upstream would reject every form post.
        const publicHost = String(req.headers[':authority'] ?? req.headers.host ?? `localhost:${EDGE_PORT}`);
        const upstream = await fetch(`${WEB}${url}`, {
          method,
          headers: {
            ...headers,
            host: publicHost,
            'x-forwarded-host': publicHost,
            'x-forwarded-proto': 'https',
            'x-forwarded-for': req.socket.remoteAddress ?? '127.0.0.1',
            'accept-encoding': 'identity',
          },
          body,
          redirect: 'manual',
        });
        const out = Object.fromEntries([...upstream.headers].filter(([name]) => !HOP_BY_HOP.has(name)));
        let payload = Buffer.from(await upstream.arrayBuffer());
        const encoding = chooseEncoding(compress, {
          acceptEncoding: req.headers['accept-encoding'],
          contentType: out['content-type'],
          contentEncoding: out['content-encoding'],
          bodyBytes: payload.length,
        });
        if (encoding) {
          payload = COMPRESSORS[encoding](payload);
          out['content-encoding'] = encoding;
          out.vary = out.vary ? `${out.vary}, Accept-Encoding` : 'Accept-Encoding';
        }
        response = { status: upstream.status, headers: out, payload };
        if ((method === 'GET' || method === 'HEAD') && upstream.status < 400) cache.set(key, response);
      }
      res.writeHead(response.status, response.headers);
      res.end(method === 'HEAD' ? undefined : response.payload);
    } catch (error) {
      res.writeHead(502);
      res.end(String(error));
    }
  };

  const options = {
    ...localCertificate(),
    minVersion: tls.minVersion,
    maxVersion: tls.maxVersion,
    ...(tls.ciphers ? { ciphers: tls.ciphers } : {}),
    ...(tls.ecdhCurve ? { ecdhCurve: tls.ecdhCurve } : {}),
  };
  return tls.http2
    ? http2.createSecureServer({ ...options, allowHTTP1: tls.allowHTTP1 }, handler)
    : https.createServer(options, handler);
}

/** GET through the edge, accepting the local certificate. */
function edgeGet(pathname, headers) {
  return new Promise((resolve) => {
    const request = https.get(
      `${EDGE}${pathname}`,
      { headers, rejectUnauthorized: false },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) });
        });
      },
    );
    request.on('error', () => {
      resolve({ status: 0, body: Buffer.alloc(0) });
    });
  });
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      // A hung request (say, a database that accepts connections but never answers)
      // must not use up the whole wait on its own.
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    await sleep(500);
  }
  throw new Error(`serve: timed out waiting for ${url} (last: ${last})`);
}

/** Loads every page and its assets once through the edge, the way Chrome asks for them. */
async function warm(log) {
  let assets = 0;
  for (const page of PAGES) {
    const { body } = await edgeGet(page, { 'accept-encoding': 'identity' });
    const html = body.toString('utf8');
    await edgeGet(page, { 'accept-encoding': CHROME_ACCEPT_ENCODING, accept: 'text/html' });
    const statics = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
    // Lighthouse emulates a 412px phone at 1.75x, so it never asks for 1200px and up.
    const images = [
      ...new Set([...html.matchAll(/\/_next\/image\/?\?[^"'\s,]+/g)].map((match) => match[0].replaceAll('&amp;', '&'))),
    ].filter((src) => Number(new URLSearchParams(src.split('?')[1]).get('w')) < 1200);
    const queue = [
      ...statics.map((src) => [src, { 'accept-encoding': CHROME_ACCEPT_ENCODING }]),
      ...images.map((src) => [src, { 'accept-encoding': CHROME_ACCEPT_ENCODING, accept: CHROME_IMAGE_ACCEPT }]),
    ];
    assets += queue.length;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) await edgeGet(next[0], next[1]);
      }),
    );
  }
  log(`serve: warmed ${PAGES.length} page(s) and ${assets} assets through the edge`);
}

/**
 * @param {{ log?: (line: string) => void }} [options]
 * @returns {Promise<{ edge: string, stop: () => void }>}
 */
export async function startStack({ log = console.log } = {}) {
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? API,
    // Canonical URLs must match the origin the browser loads.
    APP_ORIGIN: EDGE,
  };

  const children = [
    spawn(process.execPath, ['dist/main.js'], { cwd: path.join(root, 'apps/api'), env, stdio: 'inherit' }),
    spawn(process.execPath, [path.join(root, 'apps/web/node_modules/next/dist/bin/next'), 'start', '--port', '3000'], {
      cwd: path.join(root, 'apps/web'),
      env,
      stdio: 'inherit',
    }),
  ];
  const edge = createEdge();

  const stop = () => {
    edge.close();
    for (const child of children) if (child.exitCode === null) child.kill();
  };
  for (const child of children) {
    child.on('exit', (code) => {
      if (code) {
        log(`serve: a server exited with code ${code}`);
        stop();
        process.exitCode = 1;
      }
    });
  }

  try {
    await waitFor(`${API}/health`, 90_000);
    await waitFor(`${WEB}/health/`, 90_000);
    await new Promise((resolve) => edge.listen(EDGE_PORT, resolve));
    await warm(log);
    // The servers only replay cached work from here on. Let Chrome have the CPU.
    for (const child of children) {
      try {
        if (child.pid) os.setPriority(child.pid, 10);
      } catch {
        // Not permitted on every platform; the gate still works.
      }
    }
  } catch (error) {
    stop();
    throw error;
  }
  return { edge: EDGE, stop };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { edge, stop } = await startStack();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      stop();
      process.exit(0);
    });
  }
  console.log(`serve: edge on ${edge}`);
  console.log('serve: ready');
}
