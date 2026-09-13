import { APP_ENVS } from '@calwebtech/shared';
import { z } from 'zod';

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const serverEnvSchema = z.object({
  /** Unset means production, so a misconfigured server fails closed. */
  APP_ENV: z.enum(APP_ENVS).default('production'),
  API_INTERNAL_URL: z.preprocess(blankToUndefined, z.url().optional()),
  TURNSTILE_SITE_KEY: z.preprocess(blankToUndefined, z.string().optional()),
});

export type ServerEnvCheck = { ok: true; warning?: string } | { ok: false; error: string };

/**
 * Production needs the API and a Turnstile site key. Staging and development start without
 * either, with a warning: without a site key forms post no Turnstile token, and without the
 * API pages render from the static snapshot (lib/api.ts) and forms cannot send.
 */
export function checkServerEnv(source: Readonly<Record<string, string | undefined>>): ServerEnvCheck {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    return { ok: false, error: `Invalid web environment:\n${z.prettifyError(result.error)}` };
  }
  const { APP_ENV, API_INTERNAL_URL, TURNSTILE_SITE_KEY } = result.data;
  if (APP_ENV === 'production') {
    if (!API_INTERNAL_URL) {
      return {
        ok: false,
        error:
          'Invalid web environment:\n  API_INTERNAL_URL is required when APP_ENV is production: without it pages show a static snapshot and no lead can be stored',
      };
    }
    if (!TURNSTILE_SITE_KEY) {
      return {
        ok: false,
        error:
          'Invalid web environment:\n  TURNSTILE_SITE_KEY is required when APP_ENV is production: without it the API refuses every lead form submission',
      };
    }
    return { ok: true };
  }
  const warnings = [
    ...(API_INTERNAL_URL
      ? []
      : [`API_INTERNAL_URL is not set (APP_ENV=${APP_ENV}): pages render from the static snapshot and lead forms cannot send`]),
    ...(TURNSTILE_SITE_KEY
      ? []
      : [`TURNSTILE_SITE_KEY is not set (APP_ENV=${APP_ENV}): lead forms post without a Turnstile token`]),
  ];
  return warnings.length > 0 ? { ok: true, warning: warnings.join('\n') } : { ok: true };
}

/**
 * Stops the production server when required configuration is missing.
 *
 * Next.js logs an error thrown from instrumentation but keeps the process running, half
 * started, so this exits instead. The container stops, its health check fails and the
 * deploy rolls back, rather than going live and refusing every lead from paid traffic.
 */
export function assertServerEnv(): void {
  const check = checkServerEnv(process.env);
  if (!check.ok) {
    console.error(check.error);
    process.exit(1);
  }
  if (check.warning) console.warn(check.warning);
}
