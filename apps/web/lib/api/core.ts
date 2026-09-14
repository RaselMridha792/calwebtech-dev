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

export function apiUrl(path: string): string {
  const { API_INTERNAL_URL } = apiEnvSchema.parse(process.env);
  return `${API_INTERNAL_URL.replace(/\/$/, '')}${path}`;
}

/**
 * A view the page cannot render without, such as the site chrome or an index page:
 * `GET path` validated by `schema`, or `snapshot` when API_INTERNAL_URL is unset.
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
  if (!hasApi()) return schema.parse(snapshot);
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
  if (!hasApi()) return snapshot === null || snapshot === undefined ? null : schema.parse(snapshot);
  const response = await fetch(apiUrl(path), { cache: 'no-store' });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    throw new Error(`API responded ${String(response.status)} for ${path}`);
  }
  return schema.parse(await response.json());
}
