import { z } from 'zod';

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const workerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    /**
     * `resend` sends through Resend. `log` renders every email, writes a line to the log
     * and sends nothing: CI, and local development without a Resend key.
     */
    EMAIL_TRANSPORT: z.enum(['resend', 'log']),
    RESEND_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
    /** Until the sending domain is verified, development uses Resend's test sender. */
    EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
    /**
     * Development safety net. When set, every email goes to this address instead of its
     * real recipients, e.g. delivered@resend.dev. Never set it in production.
     */
    EMAIL_REDIRECT_TO: z.preprocess(blankToUndefined, z.email().optional()),
    EMAIL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
    /**
     * The site's public origin. Email jobs carry site paths, never a host, so links back to
     * a page are built here. Unset, those emails simply carry no link.
     */
    APP_ORIGIN: z.preprocess(blankToUndefined, z.url().optional()),
    /**
     * Signs each campaign recipient's unsubscribe link (`@calwebtech/shared/unsubscribe-token`);
     * the API checks it with the same secret. Without it, or without APP_ORIGIN, no campaign is
     * started: a campaign email without a working unsubscribe link is never sent.
     */
    AUTH_SECRET: z.preprocess(blankToUndefined, z.string().optional()),
    /**
     * Campaign emails per second. Resend's default account limit is 2 a second for everything
     * the account sends, so 1 leaves room for lead and booking emails while a campaign runs.
     */
    CAMPAIGN_SEND_PER_SECOND: z.coerce.number().int().min(1).max(50).default(1),
  })
  .superRefine((env, context) => {
    if (env.EMAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_TRANSPORT=resend',
      });
    }
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid worker environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
