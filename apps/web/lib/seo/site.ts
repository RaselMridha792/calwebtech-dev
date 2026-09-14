export const SITE_NAME = 'Calwebtech';

const LOCAL_ORIGIN = 'http://localhost:3000';

/** The public origin, from APP_ORIGIN at request time, so one image serves every environment. */
export function siteOrigin(): string {
  return new URL(process.env.APP_ORIGIN?.trim() || LOCAL_ORIGIN).origin;
}

/** An absolute URL on the public origin for a site path; absolute URLs pass through. */
export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, `${siteOrigin()}/`).toString();
}

/**
 * A site path as every URL on the site is written: starting with "/", lowercase, with a
 * trailing slash, and an optional query for a deliberate filter target.
 */
export function sitePath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Expected a site path starting with "/", got "${path}"`);
  }
  const url = new URL(path, LOCAL_ORIGIN);
  if (url.pathname !== url.pathname.toLowerCase()) {
    throw new Error(`Site paths are lowercase, got "${path}"`);
  }
  const pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return `${pathname}${url.search}`;
}
