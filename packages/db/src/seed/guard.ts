/** Where each seed may run. Anything else, including an unset APP_ENV, is refused. */
const ALLOWED: Record<'launch' | 'fixtures', readonly string[]> = {
  launch: ['staging', 'development'],
  fixtures: ['development'],
};

/**
 * Seeds replace placeholder rows wholesale, so they must never touch real data. The launch
 * seed runs on staging and in development; test fixtures are proof-shaped, so they run in
 * development only, never on a reachable environment. An unset APP_ENV means production
 * everywhere else in the platform (app-env.ts), so it is refused here too.
 */
export function assertSeedAllowed(kind: 'launch' | 'fixtures', appEnv = process.env.APP_ENV): void {
  if (!appEnv || !ALLOWED[kind].includes(appEnv)) {
    throw new Error(
      `Refusing to run the ${kind} seed with APP_ENV=${appEnv ?? '(unset)'}; it runs only with APP_ENV=${ALLOWED[kind].join(' or ')}`,
    );
  }
}
