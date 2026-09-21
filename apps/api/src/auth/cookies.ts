import {
  CSRF_COOKIE,
  CSRF_COOKIE_INSECURE,
  SESSION_COOKIE,
  SESSION_COOKIE_INSECURE,
} from '@calwebtech/shared';
import type { CookieOptions } from 'express';

/**
 * Cookie names and attributes, as CLAUDE.md's Security section requires: first-party,
 * httpOnly, Secure, SameSite=Strict.
 *
 * `__Host-` is what makes SameSite=Strict worth having — it pins the cookie to this exact
 * origin with no Domain and no path games — but the browser only accepts it over HTTPS.
 * Development runs on plain HTTP, so it falls back to the unprefixed name there and
 * nowhere else. Both names live in packages/shared, because the web app reads them too.
 */
export interface CookieNames {
  session: string;
  csrf: string;
}

export function cookieNames(secure: boolean): CookieNames {
  return secure
    ? { session: SESSION_COOKIE, csrf: CSRF_COOKIE }
    : { session: SESSION_COOKIE_INSECURE, csrf: CSRF_COOKIE_INSECURE };
}

/** The session cookie: unreadable to scripts, so an XSS cannot lift it. */
export function sessionCookieOptions(secure: boolean, expiresAt: Date): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: '/', expires: expiresAt };
}

/**
 * The CSRF cookie is deliberately *not* httpOnly: the admin UI has to read it to echo it
 * back in the header. That is safe because it grants nothing on its own — it is only ever
 * compared with the header, and a cross-site page can set neither.
 */
export function csrfCookieOptions(secure: boolean, expiresAt: Date): CookieOptions {
  return { httpOnly: false, secure, sameSite: 'strict', path: '/', expires: expiresAt };
}

/** Clearing must repeat the attributes the cookie was set with, or the browser keeps it. */
export function clearOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'strict', path: '/' };
}
