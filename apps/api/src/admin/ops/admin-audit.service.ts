import type { AdminAuditList, AdminAuditQuery } from '@calwebtech/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The audit log (docs/12-admin-dashboard.md, module 12): read-only, by design.
 *
 * There is no write path and no delete path here — a log that its subjects can edit
 * answers nothing. Entries are written by the services that perform the actions.
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminAuditQuery): Promise<AdminAuditList> {
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              // Exclusive of the day after, which is how a person picking an end date means it.
              ...(query.to ? { lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + DAY_MS) } : {}),
            },
          }
        : {}),
    };

    const [rows, total, actions, entityTypes, actors] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          before: true,
          after: true,
          ip: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.client.auditLog.count({ where }),
      // The filters offer what the log actually contains, rather than a list of actions
      // someone remembered to hard-code.
      this.prisma.client.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
      this.prisma.client.auditLog.groupBy({ by: ['entityType'], orderBy: { entityType: 'asc' } }),
      this.prisma.client.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actor: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      actions: actions.map((row) => row.action),
      entityTypes: entityTypes.map((row) => row.entityType),
      actors,
    };
  }
}
