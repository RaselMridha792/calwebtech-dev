/**
 * Where a process runs. Only `production` treats a missing third-party key as fatal;
 * `staging` and `development` start without one, so a stack can deploy before the
 * client's keys exist. An unset APP_ENV means production, so a misconfigured server fails
 * closed.
 */
export const APP_ENVS = ['production', 'staging', 'development'] as const;
export type AppEnv = (typeof APP_ENVS)[number];
