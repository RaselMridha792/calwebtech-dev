import 'reflect-metadata';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  CSRF_COOKIE_INSECURE,
  SESSION_COOKIE_INSECURE,
  type AdminRole,
  type AdminUser,
} from '@calwebtech/shared';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../config/env';
import { AdminGuard, RequireModule, SignedInOnly } from './admin.guard';
import type { AdminRequest } from './admin-request';
import type { AuthService } from './auth.service';
import { cookieNames } from './cookies';
import type { SessionsService } from './sessions.service';

/**
 * The build plan's gate for Task 5.3: each role reaches exactly the modules assigned to it
 * and nothing more. The matrix itself is tested in packages/shared; this is the half that
 * proves the guard applies it, and refuses anything that forgot to declare a module.
 */

/** Routes standing in for the real controllers, decorated exactly as they would be. */
class Routes {
  @RequireModule('leads', 'read')
  readLeads(): void {}

  @RequireModule('leads')
  writeLeads(): void {}

  @RequireModule('settings')
  ownerOnly(): void {}

  @SignedInOnly()
  whoAmI(): void {}

  /** Deliberately undecorated: the mistake the guard has to close. */
  forgotToDeclare(): void {}
}

const VALID_TOKEN = 'a-valid-session-token';
const CSRF_VALUE = 'a-csrf-token';

function user(role: AdminRole): AdminUser {
  return { id: 'user_1', email: 'someone@calwebtech.com', name: 'Someone', role, avatar: null, lastLoginAt: null, modules: [] };
}

function request(options: {
  cookies?: Record<string, string>;
  method?: string;
  csrfHeader?: string;
}): AdminRequest {
  return {
    cookies: options.cookies ?? {},
    method: options.method ?? 'GET',
    header: (name: string) => (name === CSRF_HEADER ? options.csrfHeader : undefined),
  } as unknown as AdminRequest;
}

function contextFor(handler: keyof Routes, req: AdminRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    // The unbound method is the point: Nest hands the guard exactly this reference, and the
    // metadata the decorators wrote lives on it.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let sessions: { validate: ReturnType<typeof vi.fn> };
  let auth: { currentUser: ReturnType<typeof vi.fn> };
  let role: AdminRole;

  beforeEach(() => {
    role = 'OWNER';
    sessions = {
      validate: vi.fn((token: string) =>
        Promise.resolve(token === VALID_TOKEN ? { sessionId: 's_1', userId: 'user_1' } : null),
      ),
    };
    auth = { currentUser: vi.fn(() => Promise.resolve(user(role))) };
    guard = new AdminGuard(
      new Reflector(),
      sessions as unknown as SessionsService,
      auth as unknown as AuthService,
      { APP_ENV: 'development' } as ApiEnv,
    );
  });

  const signedIn = (extra: Record<string, string> = {}) => ({ [SESSION_COOKIE_INSECURE]: VALID_TOKEN, ...extra });

  describe('authentication', () => {
    it('refuses a request with no session cookie', async () => {
      await expect(guard.canActivate(contextFor('readLeads', request({})))).rejects.toMatchObject({ status: 401 });
    });

    it('refuses a cookie no live session matches', async () => {
      const req = request({ cookies: { [SESSION_COOKIE_INSECURE]: 'expired-or-forged' } });
      await expect(guard.canActivate(contextFor('readLeads', req))).rejects.toMatchObject({ status: 401 });
    });

    it('refuses when the account behind a live session has gone', async () => {
      auth.currentUser.mockResolvedValueOnce(null);
      const req = request({ cookies: signedIn() });
      await expect(guard.canActivate(contextFor('readLeads', req))).rejects.toMatchObject({ status: 401 });
    });

    it('attaches the caller once everything checks out', async () => {
      const req = request({ cookies: signedIn() });
      await expect(guard.canActivate(contextFor('readLeads', req))).resolves.toBe(true);
      expect(req.auth?.sessionId).toBe('s_1');
      expect(req.auth?.user.id).toBe('user_1');
    });
  });

  describe('authorisation', () => {
    it('refuses a route that never declared its module, whoever is signed in', async () => {
      const req = request({ cookies: signedIn() });
      await expect(guard.canActivate(contextFor('forgotToDeclare', req))).rejects.toMatchObject({ status: 403 });
    });

    it('lets a role read a module it reaches', async () => {
      role = 'SALES';
      const req = request({ cookies: signedIn() });
      await expect(guard.canActivate(contextFor('readLeads', req))).resolves.toBe(true);
    });

    it('refuses a module the role does not reach at all', async () => {
      role = 'EDITOR';
      const req = request({ cookies: signedIn() });
      await expect(guard.canActivate(contextFor('readLeads', req))).rejects.toMatchObject({ status: 403 });
    });

    it('refuses a write to a module the role may only read', async () => {
      role = 'VIEWER';
      await expect(guard.canActivate(contextFor('readLeads', request({ cookies: signedIn() })))).resolves.toBe(true);
      // A GET, so this is the access level refusing it and not the CSRF check.
      await expect(guard.canActivate(contextFor('writeLeads', request({ cookies: signedIn() })))).rejects.toMatchObject({
        status: 403,
      });
    });

    it('keeps the owner-only modules to the owner', async () => {
      for (const other of ['EDITOR', 'SALES', 'VIEWER'] as const) {
        role = other;
        const req = request({ cookies: signedIn() });
        await expect(guard.canActivate(contextFor('ownerOnly', req))).rejects.toMatchObject({ status: 403 });
      }
      role = 'OWNER';
      await expect(guard.canActivate(contextFor('ownerOnly', request({ cookies: signedIn() })))).resolves.toBe(true);
    });

    it('lets every role reach the routes that belong to whoever is signed in', async () => {
      for (const any of ['OWNER', 'EDITOR', 'SALES', 'VIEWER'] as const) {
        role = any;
        await expect(guard.canActivate(contextFor('whoAmI', request({ cookies: signedIn() })))).resolves.toBe(true);
      }
    });
  });

  describe('CSRF', () => {
    const post = (cookies: Record<string, string>, csrfHeader?: string) =>
      contextFor('writeLeads', request({ cookies, method: 'POST', csrfHeader }));

    it('lets a mutation through when the header echoes the cookie', async () => {
      const cookies = signedIn({ [CSRF_COOKIE_INSECURE]: CSRF_VALUE });
      await expect(guard.canActivate(post(cookies, CSRF_VALUE))).resolves.toBe(true);
    });

    it('refuses a mutation with no header, a wrong header, or no cookie', async () => {
      const withCookie = signedIn({ [CSRF_COOKIE_INSECURE]: CSRF_VALUE });
      await expect(guard.canActivate(post(withCookie))).rejects.toMatchObject({ status: 403 });
      await expect(guard.canActivate(post(withCookie, 'a-different-token'))).rejects.toMatchObject({ status: 403 });
      await expect(guard.canActivate(post(signedIn(), CSRF_VALUE))).rejects.toMatchObject({ status: 403 });
    });

    it('does not ask a plain read for the header', async () => {
      await expect(guard.canActivate(contextFor('readLeads', request({ cookies: signedIn() })))).resolves.toBe(true);
    });
  });
});

describe('cookie names', () => {
  it('uses the __Host- prefix wherever the cookie is Secure, and only there', () => {
    // __Host- pins the cookie to this exact origin, but the browser rejects it over plain
    // HTTP, which is all development has.
    expect(cookieNames(true)).toEqual({ session: SESSION_COOKIE, csrf: CSRF_COOKIE });
    expect(cookieNames(false).session).toBe(SESSION_COOKIE_INSECURE);
    expect(cookieNames(false).session.startsWith('__Host-')).toBe(false);
  });
});
