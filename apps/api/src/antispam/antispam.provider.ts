import { API_ENV, type ApiEnv } from '../config/env';
import { DnsDomainChecker } from './email-domains';
import { RedisEmailCounter, SubmissionGuard } from './submission-guard';

/**
 * The guard as the public form modules receive it: counting in the stack's Redis, and asking
 * DNS about each address's domain unless `EMAIL_DOMAIN_CHECK=off`.
 */
export const submissionGuardProvider = {
  provide: SubmissionGuard,
  useFactory: (env: ApiEnv) =>
    new SubmissionGuard(
      new RedisEmailCounter(env.REDIS_URL),
      env.EMAIL_DOMAIN_CHECK === 'off' ? null : new DnsDomainChecker(),
    ),
  inject: [API_ENV],
};
