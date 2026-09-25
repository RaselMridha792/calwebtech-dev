import {
  PAGE_COPY_KEYS,
  PAGE_COPY_SCHEMAS,
  toFieldErrors,
  type AdminPageCopyDetail,
  type AdminPageCopyList,
  type PageCopyKey,
  type ValidationErrorResponse,
} from '@calwebtech/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../auth/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Actor } from '../leads/admin-leads.service';

/**
 * Page copy in the dashboard (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 59).
 *
 * What `settings-cli` did on the server, with the two things it never had: the page's own
 * schema checks the whole value before it is stored, so a change cannot break the page, and
 * every change is written to the audit log with the sections it touched.
 */
@Injectable()
export class AdminPageCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminPageCopyList> {
    const rows = await this.prisma.client.setting.findMany({
      where: { key: { in: [...PAGE_COPY_KEYS] } },
      select: { key: true, updatedAt: true },
    });
    return {
      items: PAGE_COPY_KEYS.map((key) => {
        const row = rows.find((entry) => entry.key === key);
        return { key, stored: Boolean(row), updatedAt: row?.updatedAt.toISOString() ?? null };
      }),
    };
  }

  /**
   * The stored copy. Read through its schema when it passes, which lays it out in the page's
   * order (Postgres keeps an object's keys sorted by length); as stored when it does not, so
   * the screen can show what needs fixing.
   */
  async detail(key: PageCopyKey): Promise<AdminPageCopyDetail> {
    const row = await this.prisma.client.setting.findUnique({ where: { key } });
    const parsed = row ? PAGE_COPY_SCHEMAS[key].safeParse(row.value) : null;
    return {
      key,
      value: parsed?.success ? parsed.data : (row?.value ?? null),
      stored: Boolean(row),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  /**
   * Replaces the copy. Refused, with the path of every field the schema rejects, when the
   * page could not render it — the same schema the page reads it back with.
   */
  async update(key: PageCopyKey, value: unknown, actor: Actor): Promise<AdminPageCopyDetail> {
    const parsed = PAGE_COPY_SCHEMAS[key].safeParse(value);
    if (!parsed.success) {
      const body: ValidationErrorResponse = { error: 'validation_failed', fieldErrors: toFieldErrors(parsed.error) };
      throw new BadRequestException(body);
    }
    const before = await this.prisma.client.setting.findUnique({ where: { key } });
    const stored = JSON.parse(JSON.stringify(parsed.data)) as object;
    await this.prisma.client.setting.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
    await this.audit.record({
      userId: actor.id,
      action: 'page_copy.updated',
      entityType: 'Setting',
      entityId: key,
      before: { stored: Boolean(before) },
      after: { sections: changedSections(before?.value, stored) },
      ip: actor.ip,
    });
    return this.detail(key);
  }
}

/**
 * The top-level sections whose copy changed, so the log says what an edit touched. Compared
 * with their keys sorted, because Postgres keeps a stored object's keys in an order of its own.
 */
export function changedSections(before: unknown, after: object): string[] {
  const previous = typeof before === 'object' && before !== null ? (before as Record<string, unknown>) : {};
  const next = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].filter((key) => canonical(previous[key]) !== canonical(next[key])).sort();
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}
