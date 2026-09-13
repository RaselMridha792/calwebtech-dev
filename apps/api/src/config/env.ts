import { Global, Module } from '@nestjs/common';
import { z } from 'zod';

export const API_ENV = Symbol('API_ENV');

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Email jobs are added here for the worker. */
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  /**
   * Cloudflare Turnstile secret. Development and CI use Cloudflare's always-pass test
   * secret, 1x0000000000000000000000000000000AA.
   */
  TURNSTILE_SECRET: z.string().min(1, 'TURNSTILE_SECRET is required'),
  /**
   * Proxy hops whose X-Forwarded-For is trusted. The API is only reachable from
   * the web container, which forwards the visitor IP, so the default is one.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid API environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

@Global()
@Module({
  providers: [{ provide: API_ENV, useFactory: (): ApiEnv => loadEnv(process.env) }],
  exports: [API_ENV],
})
export class EnvModule {}
