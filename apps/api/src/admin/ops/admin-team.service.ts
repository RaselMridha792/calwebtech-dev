import {
  TEAM_ERRORS,
  adminRoleSchema,
  type AdminRole,
  type AdminTeamMember,
  type AdminTeamView,
  type TeamCreate,
  type TeamCreated,
} from '@calwebtech/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../../auth/audit.service';
import { hashPassword } from '../../auth/password';
import { SessionsService } from '../../auth/sessions.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';

/**
 * Team and roles (docs/12-admin-dashboard.md, module 10).
 *
 * Three rules are enforced here rather than in the screen, because the screen is not what
 * keeps anyone out: nobody changes their own role, nobody disables themselves, and the
 * last active owner cannot be demoted or disabled. Without the third, one click could
 * leave a live site with no one able to reach settings, team or the audit log.
 */
const MEMBER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  lastLoginAt: true,
  createdAt: true,
  deletedAt: true,
  _count: { select: { sessions: true } },
} as const;

@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async list(callerId: string): Promise<AdminTeamView> {
    const rows = await this.prisma.client.user.findMany({
      orderBy: [{ deletedAt: 'asc' }, { name: 'asc' }],
      select: MEMBER_SELECT,
    });
    return { members: rows.map((row) => toMember(row, callerId)) };
  }

  /**
   * Adds someone and returns a first password, once. There is no invitation email while the
   * sending domain is not live (Task 6.2), so the owner passes it on out of band; it is
   * hashed here like any other and never readable again.
   */
  async create(input: TeamCreate, actor: Actor): Promise<TeamCreated> {
    const existing = await this.prisma.client.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw new ConflictException({ error: TEAM_ERRORS.duplicate, message: 'That address already has an account.' });
    }

    // 24 url-safe characters: long enough that it never needs a strength rule of its own,
    // and meant to be replaced by its owner on first sign-in.
    const temporaryPassword = randomBytes(18).toString('base64url');
    const created = await this.prisma.client.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: adminRoleSchema.parse(input.role),
        passwordHash: await hashPassword(temporaryPassword),
      },
      select: MEMBER_SELECT,
    });

    await this.audit.record({
      userId: actor.id,
      action: 'user.created',
      entityType: 'User',
      entityId: created.id,
      after: { email: created.email, name: created.name, role: created.role },
      ip: actor.ip,
    });

    return { member: toMember(created, actor.id), temporaryPassword };
  }

  async changeRole(id: string, role: AdminRole, actor: Actor): Promise<AdminTeamView> {
    const target = await this.require(id);
    if (target.id === actor.id) {
      throw new BadRequestException({ error: TEAM_ERRORS.self, message: 'You cannot change your own role.' });
    }
    if (target.role === 'OWNER' && role !== 'OWNER') await this.assertNotLastOwner(target.id);
    if (target.role === role) return this.list(actor.id);

    await this.prisma.client.user.update({ where: { id }, data: { role } });
    await this.audit.record({
      userId: actor.id,
      action: 'user.role_changed',
      entityType: 'User',
      entityId: id,
      before: { role: target.role },
      after: { role },
      ip: actor.ip,
    });
    return this.list(actor.id);
  }

  /**
   * Soft delete, never a row removal: the audit log points at these ids, and an entry whose
   * author cannot be named is worth much less. Every session goes at the same time, or the
   * account keeps working until its cookie idles out.
   */
  async disable(id: string, actor: Actor): Promise<AdminTeamView> {
    const target = await this.require(id);
    if (target.id === actor.id) {
      throw new BadRequestException({ error: TEAM_ERRORS.self, message: 'You cannot disable your own account.' });
    }
    if (target.deletedAt) return this.list(actor.id);
    if (target.role === 'OWNER') await this.assertNotLastOwner(target.id);

    await this.prisma.client.user.update({ where: { id }, data: { deletedAt: new Date() } });
    const revoked = await this.sessions.revokeAllFor(id);
    await this.audit.record({
      userId: actor.id,
      action: 'user.disabled',
      entityType: 'User',
      entityId: id,
      before: { email: target.email, role: target.role },
      after: { sessionsRevoked: revoked },
      ip: actor.ip,
    });
    return this.list(actor.id);
  }

  /** Someone disabled by mistake, or back from leave. Their old sessions stay gone. */
  async enable(id: string, actor: Actor): Promise<AdminTeamView> {
    const target = await this.require(id);
    if (!target.deletedAt) return this.list(actor.id);

    await this.prisma.client.user.update({ where: { id }, data: { deletedAt: null } });
    await this.audit.record({
      userId: actor.id,
      action: 'user.enabled',
      entityType: 'User',
      entityId: id,
      after: { email: target.email },
      ip: actor.ip,
    });
    return this.list(actor.id);
  }

  /** Signs someone out everywhere without touching their account. */
  async revokeSessions(id: string, actor: Actor): Promise<AdminTeamView> {
    await this.require(id);
    const revoked = await this.sessions.revokeAllFor(id);
    await this.audit.record({
      userId: actor.id,
      action: 'user.sessions_revoked',
      entityType: 'User',
      entityId: id,
      after: { sessionsRevoked: revoked },
      ip: actor.ip,
    });
    return this.list(actor.id);
  }

  private async require(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id }, select: MEMBER_SELECT });
    if (!user) throw new NotFoundException();
    return user;
  }

  private async assertNotLastOwner(id: string): Promise<void> {
    const others = await this.prisma.client.user.count({
      where: { role: 'OWNER', deletedAt: null, NOT: { id } },
    });
    if (others === 0) {
      throw new BadRequestException({
        error: TEAM_ERRORS.lastOwner,
        message: 'This is the only active owner. Make someone else an owner first.',
      });
    }
  }
}

function toMember(
  row: {
    id: string;
    email: string;
    name: string;
    role: string;
    lastLoginAt: Date | null;
    createdAt: Date;
    deletedAt: Date | null;
    _count: { sessions: number };
  },
  callerId: string,
): AdminTeamMember {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: adminRoleSchema.parse(row.role),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    activeSessions: row._count.sessions,
    disabledAt: row.deletedAt?.toISOString() ?? null,
    isSelf: row.id === callerId,
  };
}
