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

/**
 * Families that read the database first and fall back to their snapshot (decision 44).
 *
 * `CONTENT_SOURCE=snapshot` is all-or-nothing, which is why moving one family across used
 * to mean moving all of them. A family named here asks the API for a record, and renders
 * the committed snapshot only when the API has no such record — so a service created in the
 * admin is live at once, while the ten that were never imported keep rendering exactly as
 * they do today.
 *
 * Two sources at the same time is a transition, not a destination: a family leaves this
 * list once its records are all in the database, and `CONTENT_SOURCE=api` takes over.
 */
export function databaseFirstFamilies(): Set<string> {
  const raw = process.env.CONTENT_DATABASE_FIRST?.trim();
  if (!raw || !hasApi()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function isDatabaseFirst(family: string): boolean {
  return databaseFirstFamilies().has(family);
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

/**
 * A record from the database, falling back to the snapshot when the database has no such
 * one. For a family in `CONTENT_DATABASE_FIRST` only; every other family keeps the
 * all-or-nothing behaviour of `findView`.
 *
 * A 404 from the API is the fallback signal, not an error: it means "the database does not
 * have this record", which during the transition is the normal case.
 */
export async function findViewDatabaseFirst<Schema extends z.ZodType>(
  family: string,
  path: string,
  schema: Schema,
  snapshot: unknown,
): Promise<z.output<Schema> | null> {
  if (!isDatabaseFirst(family)) return findView(path, schema, snapshot);

  const response = await fetch(apiUrl(path), { cache: 'no-store' });
  if (response.ok) return schema.parse(await response.json());
  if (response.status === 404 || response.status === 400) {
    return snapshot === null || snapshot === undefined ? null : schema.parse(snapshot);
  }
  throw new Error(`API responded ${String(response.status)} for ${path}`);
}

/**
 * Page copy stored in the database for a page that renders from its snapshot, or null
 * (docs/08-decisions.md, 59). Only while pages render from snapshots and the family is named
 * in `CONTENT_DATABASE_FIRST`: the caller lays the copy over the snapshot's records, so the
 * homepage's words can change from the dashboard while its proof stays where it is. With
 * `CONTENT_SOURCE=api` the API's own view already carries the stored copy.
 */
export async function findStoredCopy<Schema extends z.ZodType>(
  family: string,
  key: string,
  schema: Schema,
): Promise<z.output<Schema> | null> {
  if (!usesSnapshots() || !isDatabaseFirst(family)) return null;
  const response = await fetch(apiUrl(`/pages/copy/${encodeURIComponent(key)}`), { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for the "${key}" copy`);
  return schema.parse(await response.json());
}
