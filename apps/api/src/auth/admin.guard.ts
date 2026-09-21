import {
  AUTH_ERRORS,
  CSRF_HEADER,
  accessTo,
  type AdminAccess,
  type AdminModule,
  type AuthError,
} from '@calwebtech/shared';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { API_ENV, type ApiEnv } from '../config/env';
import type { AdminRequest } from './admin-request';
import { AuthService } from './auth.service';
import { cookieNames } from './cookies';
import { SessionsService } from './sessions.service';

const REQUIRED_ACCESS = Symbol('admin:required-access');
const SIGNED_IN_ONLY = Symbol('admin:signed-in-only');

interface RequiredAccess {
  module: AdminModule;
  access: AdminAccess;
}

/**
 * Declares what a route needs. `AdminGuard` refuses any route it does not find this on, so
 * a new admin endpoint is unreachable until someone states its module — the build plan's
 * gate the safe way round, because forgetting closes the door rather than opening it.
 */
export const RequireModule = (module: AdminModule, access: AdminAccess = 'full'): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ACCESS, { module, access } satisfies RequiredAccess);

/**
 * For the few routes that belong to whoever is signed in rather than to a module: reading
 * your own account, signing out, listing and revoking your own sessions. Every role reaches
 * these, and no role reaches anyone else's through them, because the handler only ever uses
 * the id on the request.
 */
export const SignedInOnly = (): MethodDecorator & ClassDecorator => SetMetadata(SIGNED_IN_ONLY, true);

/** Methods that change something, and so must carry the CSRF header. */
const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly auth: AuthService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const names = cookieNames(this.env.APP_ENV !== 'development');

    const token = readCookie(request, names.session);
    if (!token) throw unauthenticated();

    const session = await this.sessions.validate(token);
    if (!session) throw unauthenticated();

    const user = await this.auth.currentUser(session.userId);
    // The account was deleted while its session was still open.
    if (!user) throw unauthenticated();

    if (MUTATIONS.has(request.method)) this.assertCsrf(request, names.csrf);

    const signedInOnly = this.reflector.getAllAndOverride<boolean | undefined>(SIGNED_IN_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!signedInOnly) {
      // Read the requirement from the handler first, then the controller, so a controller can
      // set the module once and a single route can ask for more.
      const required = this.reflector.getAllAndOverride<RequiredAccess | undefined>(REQUIRED_ACCESS, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!required) throw forbidden();

      const granted = accessTo(user.role, required.module);
      if (granted === null) throw forbidden();
      if (required.access === 'full' && granted !== 'full') throw forbidden();
    }

    request.auth = { user, sessionId: session.sessionId };
    return true;
  }

  /**
   * Double submit: the header must equal the cookie. SameSite=Strict already stops a
   * cross-site form reaching here, and this is the second lock, for the cases it misses —
   * an old browser, or a same-site page that should not be able to act for the admin.
   */
  private assertCsrf(request: AdminRequest, cookieName: string): void {
    const cookie = readCookie(request, cookieName);
    const header = request.header(CSRF_HEADER);
    if (!cookie || !header || !equals(cookie, header)) {
      const body: AuthError = { error: AUTH_ERRORS.csrfFailed };
      throw new ForbiddenException(body);
    }
  }
}

function readCookie(request: AdminRequest, name: string): string | null {
  const jar = request.cookies as Record<string, string | undefined> | undefined;
  const value = jar?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Constant time, so the comparison cannot be walked character by character. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function unauthenticated(): UnauthorizedException {
  const body: AuthError = { error: AUTH_ERRORS.unauthenticated };
  return new UnauthorizedException(body);
}

function forbidden(): ForbiddenException {
  const body: AuthError = { error: AUTH_ERRORS.forbidden };
  return new ForbiddenException(body);
}
