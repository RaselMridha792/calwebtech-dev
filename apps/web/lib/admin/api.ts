import 'server-only';
import type { z } from 'zod';
import { cookies } from 'next/headers';
import { apiUrl } from '../api/core';

/**
 * How admin screens read from the API.
 *
 * The session lives in a first-party httpOnly cookie the API set, so a server component
 * has to hand that cookie back on every read: it is the only thing that says who is
 * asking. `apps/web` never touches Prisma (CLAUDE.md), so this is the whole data path.
 *
 * Mutations do not go through here. They run in the browser against `/api/...` on this
 * origin, because the CSRF header has to be read from a cookie only the browser holds —
 * see `lib/admin/mutate.ts`.
 */

/** Everything the browser sent, forwarded unchanged. */
async function cookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

/**
 * A view the screen cannot render without. Throws `AdminApiError` with the status, so the
 * caller can tell "signed out" (401) from "not yours" (403) from a real failure.
 *
 * Never cached: an admin list that is seconds stale shows someone else's change as their
 * own, and the audit trail then disagrees with the screen.
 */
export async function adminGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.output<Schema>> {
  // Read first, and deliberately so: touching cookies is what marks the route dynamic,
  // and it has to happen before anything that could throw on a machine with no API
  // configured — otherwise a build tries to prerender the admin and fails there instead.
  const cookie = await cookieHeader();
  const response = await fetch(apiUrl(path), { headers: { cookie }, cache: 'no-store' });
  if (!response.ok) {
    throw new AdminApiError(response.status, `API responded ${String(response.status)} for ${path}`);
  }
  return schema.parse(await response.json());
}

/** The same, but a 404 is an answer rather than a failure. */
export async function adminFind<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.output<Schema> | null> {
  const cookie = await cookieHeader();
  const response = await fetch(apiUrl(path), { headers: { cookie }, cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new AdminApiError(response.status, `API responded ${String(response.status)} for ${path}`);
  }
  return schema.parse(await response.json());
}
