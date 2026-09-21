import {
  AUTH_ERRORS,
  adminRoleSchema,
  modulesFor,
  type AdminUser,
  type AuthError,
  type LoginRequest,
} from '@calwebtech/shared';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { UNKNOWN_ACCOUNT_HASH, verifyPassword } from './password';
import { SessionsService } from './sessions.service';

/**
 * Failed attempts allowed against one address before it is locked, and for how long.
 * The controller rate-limits by IP as well; this is the half an attacker cannot escape by
 * changing address, because it counts the account being attacked rather than the attacker.
 */
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

interface Attempts {
  count: number;
  firstAt: number;
  lockedUntil: number | null;
}

@Injectable()
export class AuthService {
  /**
   * In memory, which suits one API instance, as the throttler in app.module.ts already
   * assumes. Moving either to Redis is the same change, and must happen together with it
   * before a second instance runs.
   */
  private readonly attempts = new Map<string, Attempts>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Checks the password and opens a session.
   *
   * Every failure answers the same `invalid_credentials`, and an unknown address is
   * verified against a constant hash so it costs the same time as a known one. Between
   * them the endpoint says nothing about who has an account.
   */
  async signIn(
    input: LoginRequest,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{ token: string; expiresAt: Date; user: AdminUser }> {
    const email = input.email;
    this.assertNotLockedOut(email, ip);

    const record = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, avatar: true, passwordHash: true, deletedAt: true },
    });

    // A soft-deleted account is treated exactly as an absent one, hash check included, so
    // removing someone does not turn sign-in into a way to confirm they once existed.
    const usable = record && !record.deletedAt ? record : null;
    const ok = await verifyPassword(usable?.passwordHash ?? UNKNOWN_ACCOUNT_HASH, input.password);

    if (!usable || !ok) {
      this.recordFailure(email);
      await this.audit.recordQuietly({
        userId: usable?.id ?? null,
        action: 'user.sign_in_failed',
        entityType: 'User',
        entityId: usable?.id ?? null,
        // The address tried, never the password and never whether the address exists.
        after: { email },
        ip,
      });
      const body: AuthError = { error: AUTH_ERRORS.invalidCredentials };
      throw new UnauthorizedException(body);
    }

    this.attempts.delete(email);
    const session = await this.sessions.create(usable.id, ip, userAgent);
    const user = await this.prisma.client.user.update({
      where: { id: usable.id },
      data: { lastLoginAt: new Date() },
      select: { id: true, email: true, name: true, role: true, avatar: true, lastLoginAt: true },
    });
    await this.audit.recordQuietly({
      userId: user.id,
      action: 'user.signed_in',
      entityType: 'User',
      entityId: user.id,
      ip,
    });

    return { token: session.token, expiresAt: session.expiresAt, user: toAdminUser(user) };
  }

  /** The signed-in user, or null when the account vanished under a live session. */
  async currentUser(userId: string): Promise<AdminUser | null> {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, avatar: true, lastLoginAt: true },
    });
    return user ? toAdminUser(user) : null;
  }

  async signOut(sessionId: string, userId: string, ip: string | null): Promise<void> {
    await this.sessions.revoke(sessionId);
    await this.audit.recordQuietly({
      userId,
      action: 'user.signed_out',
      entityType: 'Session',
      entityId: sessionId,
      ip,
    });
  }

  private assertNotLockedOut(email: string, ip: string | null): void {
    const state = this.attempts.get(email);
    if (!state?.lockedUntil) return;
    if (state.lockedUntil <= Date.now()) {
      this.attempts.delete(email);
      return;
    }
    // 429 rather than 401: the caller is being refused for trying too often, and saying so
    // gives away nothing, because the lock is applied whether or not the address exists.
    void this.audit.recordQuietly({
      userId: null,
      action: 'user.sign_in_locked_out',
      entityType: 'User',
      after: { email },
      ip,
    });
    const body: AuthError = { error: AUTH_ERRORS.rateLimited };
    throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }

  private recordFailure(email: string): void {
    const now = Date.now();
    const state = this.attempts.get(email);
    if (!state || now - state.firstAt > ATTEMPT_WINDOW_MS) {
      this.attempts.set(email, { count: 1, firstAt: now, lockedUntil: null });
      return;
    }
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) state.lockedUntil = now + LOCKOUT_MS;
  }
}

/** Never selects `passwordHash`, so the view cannot carry it by accident. */
function toAdminUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  lastLoginAt?: Date | null;
}): AdminUser {
  // Parsed rather than cast: a Role added to the schema and not to packages/shared fails
  // here, loudly, instead of reaching the UI as a role it has no rules for.
  const role = adminRoleSchema.parse(user.role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    avatar: user.avatar,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    modules: modulesFor(role),
  };
}
