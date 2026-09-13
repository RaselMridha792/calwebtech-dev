/**
 * Runs once when the server starts. In production a missing required variable stops the
 * process (lib/server-env.ts). Skipped during `next build`, which runs without secrets,
 * and imported only in the Node.js runtime, where process.exit exists.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build') return;
  const { assertServerEnv } = await import('./lib/server-env');
  assertServerEnv();
}
