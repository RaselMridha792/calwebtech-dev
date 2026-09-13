import { z } from 'zod';

const serverEnvSchema = z.object({
  API_INTERNAL_URL: z.url(),
  TURNSTILE_SITE_KEY: z
    .string()
    .min(1, 'TURNSTILE_SITE_KEY is required: without it the API refuses every lead form submission'),
});

/**
 * Stops the production server when required configuration is missing.
 *
 * Next.js logs an error thrown from instrumentation but keeps the process running, half
 * started, so this exits instead. The container stops, its health check fails and the
 * deploy rolls back, rather than going live and refusing every lead from paid traffic.
 */
export function assertServerEnv(): void {
  const result = serverEnvSchema.safeParse(process.env);
  if (result.success) return;
  console.error(`Invalid web environment:\n${z.prettifyError(result.error)}`);
  process.exit(1);
}
