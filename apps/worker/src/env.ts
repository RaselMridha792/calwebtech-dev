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
