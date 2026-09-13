import { describe, expect, it } from 'vitest';
import { chooseEncoding, edgeSettings } from './edge.mjs';

describe('edgeSettings', () => {
  it('mirrors every setting in the repository edge.yml', () => {
    const settings = edgeSettings();
    expect(settings.tls.minVersion).toBe('TLSv1.2');
    expect(settings.tls.http2).toBe(true);
    expect(settings.tls.allowHTTP1).toBe(true);
    expect(settings.tls.ciphers).toContain('ECDHE-RSA-AES128-GCM-SHA256');
    expect(settings.compress.encodings).toEqual(['br', 'gzip']);
  });

  it('refuses settings it cannot mirror, so a Traefik change forces a review', () => {
    const source = `
tls:
  options:
    default:
      minVersion: VersionTLS12
      cipherSuites: [TLS_RSA_WITH_RC4_128_SHA]
http:
  middlewares:
    edge-compress:
      compress: {}
`;
    expect(() => edgeSettings(source)).toThrow(/unsupported cipher suite/);
  });

  it('refuses unknown option keys', () => {
    const source = `
tls:
  options:
    default:
      sniStrict: true
http:
  middlewares:
    edge-compress:
      compress: {}
`;
    expect(() => edgeSettings(source)).toThrow(/unsupported TLS option "sniStrict"/);
  });

  it('falls back to Traefik defaults for keys left out', () => {
    const settings = edgeSettings(`
tls:
  options:
    default: {}
http:
  middlewares:
    edge-compress:
      compress: {}
`);
    expect(settings.tls.http2).toBe(true);
    expect(settings.compress.encodings).toEqual(['gzip', 'br', 'zstd']);
    expect(settings.compress.minResponseBodyBytes).toBe(1024);
  });
});

describe('chooseEncoding', () => {
  const { compress } = edgeSettings();
  const base = { contentType: 'application/javascript', contentEncoding: undefined, bodyBytes: 50_000 };

  it('picks the first configured encoding the client accepts', () => {
    expect(chooseEncoding(compress, { ...base, acceptEncoding: 'gzip, deflate, br, zstd' })).toBe('br');
    expect(chooseEncoding(compress, { ...base, acceptEncoding: 'gzip' })).toBe('gzip');
  });

  it('skips small, excluded and already encoded responses', () => {
    expect(chooseEncoding(compress, { ...base, acceptEncoding: 'br', bodyBytes: 200 })).toBeNull();
    expect(chooseEncoding(compress, { ...base, acceptEncoding: 'br', contentType: 'image/webp' })).toBeNull();
    expect(chooseEncoding(compress, { ...base, acceptEncoding: 'br', contentEncoding: 'gzip' })).toBeNull();
  });

  it('honours q=0', () => {
    expect(chooseEncoding(compress, { ...base, acceptEncoding: 'br;q=0, gzip' })).toBe('gzip');
  });
});
