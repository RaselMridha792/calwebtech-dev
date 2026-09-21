import {
  ADMIN_SETTING_KEYS,
  ADMIN_SETTING_SCHEMAS,
  type AdminSettingKey,
  type AdminSettingsView,
} from '@calwebtech/shared';
import type { Prisma } from '@calwebtech/db';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';

/**
 * The settings screen (docs/12-admin-dashboard.md, module 11).
 *
 * The same five keys `settings-cli` changes, with one difference that is the point of the
 * screen: every change here writes an audit entry, so "who turned indexing on" has an
 * answer. The CLI stays for a database with no accounts yet.
 */
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminSettingsView> {
    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: [...ADMIN_SETTING_KEYS] } },
      select: { key: true, value: true, updatedAt: true },
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    // Every key is listed whether or not it has ever been set: a missing row is a real
    // state the screen has to show, not an absence to hide.
    return {
      settings: ADMIN_SETTING_KEYS.map((key) => {
        const row = byKey.get(key);
        return {
          key,
          value: row?.value ?? null,
          updatedAt: row?.updatedAt.toISOString() ?? null,
        };
      }),
    };
  }

  /**
   * Validates the value with the same schema the API and worker read it back with, so the
   * screen cannot store something they will later refuse. The audit entry keeps both
   * sides of the change.
   */
  async update(key: AdminSettingKey, value: unknown, actor: Actor): Promise<AdminSettingsView> {
    const parsed = ADMIN_SETTING_SCHEMAS[key].safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'validation_failed',
        fieldErrors: { value: parsed.error.issues.map((issue) => issue.message) },
      });
    }

    const before = await this.prisma.client.setting.findUnique({ where: { key }, select: { value: true } });
    const json = parsed.data as Prisma.InputJsonValue;
    await this.prisma.client.setting.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });

    // Awaited and allowed to throw: a settings change that is not recorded is exactly the
    // gap this screen exists to close.
    await this.audit.record({
      userId: actor.id,
      action: 'setting.changed',
      entityType: 'Setting',
      entityId: key,
      before: before?.value ?? null,
      after: parsed.data,
      ip: actor.ip,
    });

    return this.list();
  }
}
