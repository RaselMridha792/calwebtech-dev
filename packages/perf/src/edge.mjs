// Reads Traefik's edge configuration (infra/traefik/dynamic/edge.yml) and turns it
// into settings for the local proxy, so the Lighthouse gate measures with the same
// TLS and compression as production. Any setting the proxy cannot mirror throws,
// which makes a Traefik change fail the perf tests until someone reviews it here.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const EDGE_CONFIG = path.resolve(import.meta.dirname, '../../../infra/traefik/dynamic/edge.yml');

const TLS_VERSIONS = { VersionTLS12: 'TLSv1.2', VersionTLS13: 'TLSv1.3' };

// Traefik uses Go / IANA names; Node uses OpenSSL names.
const CIPHER_SUITES = {
  TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256: 'ECDHE-ECDSA-AES128-GCM-SHA256',
  TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256: 'ECDHE-RSA-AES128-GCM-SHA256',
  TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384: 'ECDHE-ECDSA-AES256-GCM-SHA384',
  TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384: 'ECDHE-RSA-AES256-GCM-SHA384',
  TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256: 'ECDHE-ECDSA-CHACHA20-POLY1305',
  TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256: 'ECDHE-RSA-CHACHA20-POLY1305',
};

const CURVES = { X25519: 'X25519', CurveP256: 'P-256', CurveP384: 'P-384', CurveP521: 'P-521' };

const ENCODINGS = new Set(['br', 'gzip', 'zstd']);
const TLS_KEYS = new Set(['minVersion', 'maxVersion', 'cipherSuites', 'curvePreferences', 'alpnProtocols']);
const COMPRESS_KEYS = new Set([
  'encodings',
  'minResponseBodyBytes',
  'excludedContentTypes',
  'includedContentTypes',
  'defaultEncoding',
]);

// Traefik's documented defaults, used only when edge.yml leaves a key out.
const TRAEFIK_DEFAULT_ALPN = ['h2', 'http/1.1', 'acme-tls/1'];
const TRAEFIK_DEFAULT_ENCODINGS = ['gzip', 'br', 'zstd'];

function unsupported(what) {
  throw new Error(
    `Traefik edge config: ${what}. Teach packages/perf/src/edge.mjs to mirror it before changing edge.yml.`,
  );
}

function mapEach(values, table, label) {
  return values.map((value) => table[value] ?? unsupported(`unsupported ${label} "${value}"`));
}

/**
 * @param {string} [source] YAML text; defaults to the repository's edge.yml
 */
export function edgeSettings(source = readFileSync(EDGE_CONFIG, 'utf8')) {
  const config = parse(source);

  const tls = config?.tls?.options?.default ?? unsupported('tls.options.default is missing');
  for (const key of Object.keys(tls)) {
    if (!TLS_KEYS.has(key)) unsupported(`unsupported TLS option "${key}"`);
  }

  const compress =
    config?.http?.middlewares?.['edge-compress']?.compress ??
    unsupported('http.middlewares.edge-compress.compress is missing');
  for (const key of Object.keys(compress)) {
    if (!COMPRESS_KEYS.has(key)) unsupported(`unsupported compress option "${key}"`);
  }

  const alpn = tls.alpnProtocols ?? TRAEFIK_DEFAULT_ALPN;
  const encodings = compress.encodings ?? TRAEFIK_DEFAULT_ENCODINGS;
  for (const encoding of encodings) {
    if (!ENCODINGS.has(encoding)) unsupported(`unsupported encoding "${encoding}"`);
  }

  return {
    tls: {
      minVersion: TLS_VERSIONS[tls.minVersion ?? 'VersionTLS12'] ?? unsupported(`TLS version "${tls.minVersion}"`),
      maxVersion: tls.maxVersion
        ? (TLS_VERSIONS[tls.maxVersion] ?? unsupported(`TLS version "${tls.maxVersion}"`))
        : 'TLSv1.3',
      ciphers: tls.cipherSuites ? mapEach(tls.cipherSuites, CIPHER_SUITES, 'cipher suite').join(':') : undefined,
      ecdhCurve: tls.curvePreferences ? mapEach(tls.curvePreferences, CURVES, 'curve').join(':') : undefined,
      http2: alpn.includes('h2'),
      allowHTTP1: alpn.includes('http/1.1'),
    },
    compress: {
      encodings,
      minResponseBodyBytes: compress.minResponseBodyBytes ?? 1024,
      excludedContentTypes: compress.excludedContentTypes ?? [],
      includedContentTypes: compress.includedContentTypes ?? [],
      defaultEncoding: compress.defaultEncoding ?? '',
    },
  };
}

function mediaType(contentType) {
  return String(contentType ?? '').split(';')[0].trim().toLowerCase();
}

/**
 * Chooses the response encoding the way Traefik's compress middleware does: the first
 * configured encoding the client accepts, subject to size and content-type rules.
 * @returns {string | null}
 */
export function chooseEncoding(compress, { acceptEncoding, contentType, contentEncoding, bodyBytes }) {
  if (contentEncoding) return null;
  if (bodyBytes < compress.minResponseBodyBytes) return null;
  const type = mediaType(contentType);
  if (compress.excludedContentTypes.map(mediaType).includes(type)) return null;
  if (compress.includedContentTypes.length > 0 && !compress.includedContentTypes.map(mediaType).includes(type)) {
    return null;
  }
  if (acceptEncoding === undefined) return compress.defaultEncoding || null;
  const accepted = new Set(
    String(acceptEncoding)
      .split(',')
      .map((part) => part.trim().split(';'))
      .filter(([, q]) => !q || Number(q.split('=')[1]) > 0)
      .map(([name]) => name.trim().toLowerCase()),
  );
  return compress.encodings.find((encoding) => accepted.has(encoding) || accepted.has('*')) ?? null;
}
