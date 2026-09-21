import { loginSchema, type AdminSession, type AdminUser, type LoginRequest } from '@calwebtech/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Module,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { API_ENV, type ApiEnv } from '../config/env';
import { AdminGuard, SignedInOnly } from './admin.guard';
import type { AdminRequest } from './admin-request';
import { requireAuth } from './admin-request';
import { AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { clearOptions, cookieNames, csrfCookieOptions, sessionCookieOptions } from './cookies';
import { SessionsService } from './sessions.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private get secure(): boolean {
    return this.env.APP_ENV !== 'development';
  }

  /**
   * Signs in and sets the session and CSRF cookies. 401 `invalid_credentials` for every
   * kind of failure, 429 `too_many_attempts` once the address is locked.
   *
   * Ten attempts a minute per IP here; the per-account lock in AuthService is the half an
   * attacker cannot escape by changing address.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
    @Ip() ip: string,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminUser> {
    const { token, expiresAt, user } = await this.auth.signIn(body, ip, request.header('user-agent') ?? null);
    const names = cookieNames(this.secure);
    response.cookie(names.session, token, sessionCookieOptions(this.secure, expiresAt));
    // A fresh CSRF token per session, so signing in again cannot replay the old one.
    response.cookie(names.csrf, randomBytes(32).toString('base64url'), csrfCookieOptions(this.secure, expiresAt));
    return user;
  }

  /** Ends this session and clears both cookies. Idempotent: signing out twice is fine. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminGuard)
  @SignedInOnly()
  async logout(
    @Req() request: AdminRequest,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { user, sessionId } = requireAuth(request);
    await this.auth.signOut(sessionId, user.id, ip);
    const names = cookieNames(this.secure);
    response.clearCookie(names.session, clearOptions(this.secure));
    response.clearCookie(names.csrf, { ...clearOptions(this.secure), httpOnly: false });
  }

  /** Who is signed in, and which modules their role reaches. The admin shell's first call. */
  @Get('me')
  @UseGuards(AdminGuard)
  @SignedInOnly()
  me(@Req() request: AdminRequest): AdminUser {
    return requireAuth(request).user;
  }

  /** This account's own sessions, so a forgotten browser can be found and closed. */
  @Get('sessions')
  @UseGuards(AdminGuard)
  @SignedInOnly()
  listSessions(@Req() request: AdminRequest): Promise<AdminSession[]> {
    const { user, sessionId } = requireAuth(request);
    return this.sessions.list(user.id, sessionId);
  }

  /** Signs out everywhere but here. The session making the request is deliberately kept. */
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @SignedInOnly()
  async revokeOthers(@Req() request: AdminRequest): Promise<{ revoked: number }> {
    const { user, sessionId } = requireAuth(request);
    return { revoked: await this.sessions.revokeOthers(user.id, sessionId) };
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionsService, AuditService, AdminGuard],
  // Every admin module reuses these: the guard for its routes, the audit service for its
  // mutations, and sessions for revoking someone else's access from the team screen.
  exports: [AuthService, SessionsService, AuditService, AdminGuard],
})
export class AuthModule {}
