import type { AdminSession } from '@calwebtech/shared';
import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * How long a session survives without being used. A dashboard left open on an unattended
 * screen stops being a way in after this.
 */
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;

/**
 * The longest a session can live however often it is used, so a stolen cookie expires even
 * while the thief keeps it warm. Signing in again is the only way past it.
 */
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sliding expiry is only written when it would move by more than this, so an active admin
 * does not cost one UPDATE per request.
 */
const EXTEND_AFTER_MS = 10 * 60 * 1000;

/** Enough entropy that guessing is not a strategy: 256 bits, url-safe. */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only the hash is stored. Someone who reads the `Session` table therefore holds nothing
 * they can present as a cookie, the same reason passwords are not stored either.
 */
function fingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a session and returns the raw token, which is never stored and never logged. */
  async create(userId: string, ip: string | null, userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
    const token = newToken();
    const expiresAt = new Date(Date.now() + SESSION_IDLE_MS);
    await this.prisma.client.session.create({
      data: {
        userId,
        token: fingerprint(token),
        expiresAt,
        ip,
        // Long enough to recognise a browser, short enough not to become a log of its own.
        userAgent: userAgent?.slice(0, 400) ?? null,
      },
    });
    await this.purgeExpired();
    return { token, expiresAt };
  }

  /**
   * The session this token belongs to, or null when there is none, it has idled out, or it
   * has passed the absolute limit. A valid session has its idle window pushed forward,
   * never past `createdAt + SESSION_ABSOLUTE_MS`.
   */
  async validate(token: string): Promise<AuthenticatedSession | null> {
    const row = await this.prisma.client.session.findUnique({
      where: { token: fingerprint(token) },
      select: { id: true, userId: true, createdAt: true, expiresAt: true, user: { select: { deletedAt: true } } },
    });
    if (!row) return null;

    const now = Date.now();
    const absoluteEnd = row.createdAt.getTime() + SESSION_ABSOLUTE_MS;
    if (row.expiresAt.getTime() <= now || absoluteEnd <= now || row.user.deletedAt) {
      // A session that has run out is removed rather than left to be swept later, so the
      // same cookie cannot be tried again against a row that still exists.
      await this.revoke(row.id);
      return null;
    }

    const nextExpiry = Math.min(now + SESSION_IDLE_MS, absoluteEnd);
    if (nextExpiry - row.expiresAt.getTime() > EXTEND_AFTER_MS) {
      await this.prisma.client.session.update({ where: { id: row.id }, data: { expiresAt: new Date(nextExpiry) } });
    }
    return { sessionId: row.id, userId: row.userId };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { id: sessionId } });
  }

  /** Every session but this one: what "sign out everywhere else" does. */
  async revokeOthers(userId: string, keepSessionId: string): Promise<number> {
    const { count } = await this.prisma.client.session.deleteMany({
      where: { userId, NOT: { id: keepSessionId } },
    });
    return count;
  }

  async revokeAllFor(userId: string): Promise<number> {
    const { count } = await this.prisma.client.session.deleteMany({ where: { userId } });
    return count;
  }

  /** What the account sees on its own security screen. */
  async list(userId: string, currentSessionId: string): Promise<AdminSession[]> {
    const rows = await this.prisma.client.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true, ip: true, userAgent: true },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      ip: row.ip,
      userAgent: row.userAgent,
      current: row.id === currentSessionId,
    }));
  }

  /**
   * Rows past the absolute limit are useless but still readable, and the table is one of
   * the few that grows without bound. Cleared on sign-in, which is rare enough to be free.
   */
  private async purgeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - SESSION_ABSOLUTE_MS);
    await this.prisma.client.session.deleteMany({
      where: { OR: [{ expiresAt: { lte: new Date() } }, { createdAt: { lte: cutoff } }] },
    });
  }
}
