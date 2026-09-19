import 'server-only';
import { z } from 'zod';

const apiEnvSchema = z.object({ API_INTERNAL_URL: z.url() });

/**
 * Until the API is hosted, the web app can deploy on its own (docs/08-decisions.md, 33).
 * With API_INTERNAL_URL unset, pages render from committed snapshots in
 * `apps/web/static-content`, validated with the same schemas, and lead forms report that
 * they cannot send. Setting API_INTERNAL_URL switches everything back to live data.
 */
export function hasApi(): boolean {
  return Boolean(process.env.API_INTERNAL_URL?.trim());
}

/**
 * Where page content comes from once the API is reachable (docs/08-decisions.md, 43).
 * `api`, the default, reads every view from the API. `snapshot` keeps rendering the
 * committed snapshots while leads, the calculator's estimate and brief drafts still go to
 * the API: the launch mode, until the content families move into the database. Without the
 * API there is nothing else to read, whatever this says.
 */
export function usesSnapshots(): boolean {
  return !hasApi() || process.env.CONTENT_SOURCE?.trim() === 'snapshot';
}

export function apiUrl(path: string): string {
  const { API_INTERNAL_URL } = apiEnvSchema.parse(process.env);
  return `${API_INTERNAL_URL.replace(/\/$/, '')}${path}`;
}

/**
 * A view the page cannot render without, such as the site chrome or an index page:
 * `GET path` validated by `schema`, or `snapshot` when pages render from snapshots
 * (API_INTERNAL_URL unset, or CONTENT_SOURCE=snapshot).
 *
 * Never cached across requests: site pages render per request and the API caches each
 * view for a few seconds (docs/10-site-pages.md). Wrap a getter in React's `cache` so a
 * page and its metadata share one call.
 */
export async function getView<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  snapshot: unknown,
): Promise<z.output<Schema>> {
  if (usesSnapshots()) return schema.parse(snapshot);
  const response = await fetch(apiUrl(path), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API responded ${String(response.status)} for ${path}`);
  }
  return schema.parse(await response.json());
}

/**
 * A record's view, or null when there is no such published record: the API answered 404
 * (or 400 for a malformed slug), or, without the API, `snapshot` is null or undefined.
 * The page then calls `notFound()`. Any other failure throws.
 */
export async function findView<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  snapshot: unknown,
): Promise<z.output<Schema> | null> {
  if (usesSnapshots()) return snapshot === null || snapshot === undefined ? null : schema.parse(snapshot);
  const response = await fetch(apiUrl(path), { cache: 'no-store' });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    throw new Error(`API responded ${String(response.status)} for ${path}`);
  }
  return schema.parse(await response.json());
}
