import type { AdminUser } from '@calwebtech/shared';
import type { Request } from 'express';

/** What the session guard attaches once it has proved who is calling. */
export interface AdminAuth {
  user: AdminUser;
  sessionId: string;
}

/**
 * An admin request after the guard has run. Declared here rather than by augmenting
 * Express's own `Request`, so nothing outside the admin can read `auth` off a request the
 * guard never touched and believe it.
 */
export interface AdminRequest extends Request {
  auth?: AdminAuth;
}

/**
 * The authenticated caller. Throws rather than returning undefined: reaching this without
 * the guard is a wiring mistake, and a 500 is the right answer to it — never an anonymous
 * request quietly treated as someone.
 */
export function requireAuth(request: AdminRequest): AdminAuth {
  if (!request.auth) {
    throw new Error('requireAuth called on a request that AdminGuard did not authenticate');
  }
  return request.auth;
}
