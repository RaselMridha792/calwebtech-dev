/**
 * Cookie and header names for the admin session.
 *
 * Deliberately a module of its own with **no zod import**: client components need these
 * values, and a value import from the barrel drags every schema and zod into the browser
 * bundle. That cost 126 kB against a 20 kB budget once already (commit 59d10b2), so this
 * one is reachable on its own through the package's `./auth-cookies` export.
 *
 * `__Host-` binds a cookie to this exact origin with no Domain and no path games, which is
 * what makes SameSite=Strict worth having. The browser only accepts it over HTTPS, so
 * development over plain HTTP falls back to the unprefixed name and nowhere else.
 */
export const SESSION_COOKIE = '__Host-calwebtech_session';
export const SESSION_COOKIE_INSECURE = 'calwebtech_session';
export const CSRF_COOKIE = '__Host-calwebtech_csrf';
export const CSRF_COOKIE_INSECURE = 'calwebtech_csrf';

/** The header the admin UI echoes the CSRF cookie back in, on every mutation. */
export const CSRF_HEADER = 'x-csrf-token';
