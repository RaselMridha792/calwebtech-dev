import type { Utm } from '@calwebtech/shared';

const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

/** Reads utm_* parameters. Type-only imports keep this safe for client bundles. */
export function utmFromSearchParams(params: URLSearchParams): Utm | undefined {
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)?.trim();
    if (value) utm[key] = value.slice(0, 200);
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}
