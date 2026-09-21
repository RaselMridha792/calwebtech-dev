'use client';
import { CSRF_COOKIE, CSRF_COOKIE_INSECURE, CSRF_HEADER } from '@calwebtech/shared/auth-cookies';

/**
 * How the admin writes.
 *
 * Reads happen in server components (`lib/admin/api.ts`); writes happen here, in the
 * browser, because the CSRF token is a cookie the page has to read and echo back in a
 * header — something a server action cannot do on the browser's behalf. The request goes
 * to `/api/...` on this origin, which Traefik routes to the API in production and a Next
 * rewrite routes in development, so the session cookie stays first-party either way.
 *
 * Imports come from `@calwebtech/shared/auth-cookies`, not the package root: a value
 * import from the barrel would pull every schema and zod into this bundle.
 */

/** The `__Host-` name where the page is served over HTTPS, the plain one in development. */
function csrfToken(): string {
  const jar = document.cookie.split('; ');
  for (const name of [CSRF_COOKIE, CSRF_COOKIE_INSECURE]) {
    const hit = jar.find((entry) => entry.startsWith(`${name}=`));
    if (hit) return decodeURIComponent(hit.slice(name.length + 1));
  }
  return '';
}

export class MutationError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Field-level messages from the API's Zod validation, where it sent any. */
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'MutationError';
  }
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * A write against the API. Throws `MutationError` carrying the status and any field
 * errors, so a form can show them beside the input that caused them.
 */
export async function adminMutate<T>(
  path: string,
  init: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: init.method,
    // Same-origin, so the session cookie rides along without CORS being configured at all.
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      [CSRF_HEADER]: csrfToken(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (response.status === 401) {
    // The session went while the page was open. A full load rather than a router push:
    // this is not a component, and everything rendered for the old session has to go.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/admin/login/');
    throw new MutationError(401, 'Your session has ended. Sign in again.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new MutationError(
      response.status,
      body.message ?? messageFor(response.status, body.error),
      body.fieldErrors ?? {},
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Plain words for the codes the API answers with, so no screen has to invent them. */
function messageFor(status: number, code: string | undefined): string {
  if (code === 'csrf_failed') return 'That request could not be verified. Reload the page and try again.';
  if (code === 'forbidden' || status === 403) return 'Your role does not allow that.';
  if (code === 'stale_status') return 'Someone else changed this lead. Reload before saving.';
  if (status === 409) return 'This record changed while you were editing it. Reload before saving.';
  if (status === 404) return 'That record no longer exists.';
  return 'That could not be saved. Try again.';
}
