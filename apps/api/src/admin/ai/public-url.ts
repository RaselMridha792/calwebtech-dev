import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Whether an address a person typed is safe for this server to call (docs/08-decisions.md,
 * 64).
 *
 * A custom AI provider's address is the one place the dashboard lets someone choose where
 * the API sends a request. Unchecked, it would let them point it at the database, Redis, the
 * cloud's metadata service or anything else on the private network behind the proxy. So the
 * address must be https, carry no credentials, and name a host whose every address is on
 * the public internet. It is checked when saved and again before every call, because DNS
 * can change in between.
 */
export async function assertPublicHttps(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeAddressError('That is not a web address.');
  }
  if (url.protocol !== 'https:') throw new UnsafeAddressError('The address must start with https://.');
  if (url.username || url.password) throw new UnsafeAddressError('Put the key in the key field, not in the address.');

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UnsafeAddressError('The address must be on the public internet.');
  }

  const addresses = isIP(host) ? [host] : await resolveAll(host);
  if (addresses.length === 0) throw new UnsafeAddressError('That address does not exist.');
  if (addresses.some(isPrivate)) throw new UnsafeAddressError('The address must be on the public internet.');
  return url;
}

export class UnsafeAddressError extends Error {}

async function resolveAll(host: string): Promise<string[]> {
  try {
    const found = await lookup(host, { all: true, verbatim: true });
    return found.map((entry) => entry.address);
  } catch {
    return [];
  }
}

/** Loopback, private, link-local, carrier-grade NAT, unique-local, multicast and unspecified. */
export function isPrivate(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  // An IPv4 address carried in IPv6 is judged as the IPv4 address it is.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return isPrivate(mapped[1]);
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('ff')
  );
}
