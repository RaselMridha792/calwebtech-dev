import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The audit log CLAUDE.md requires on every admin login, content change, lead status
 * change, export and campaign send.
 *
 * `settings-cli` writes nothing here today (docs/08-decisions.md, Open); the settings screen
 * in M2 moves it onto this service so a change stops being invisible.
 */
export interface AuditEntry {
  /** Null for an action with no signed-in actor, such as a failed sign-in. */
  userId: string | null;
  /** Past tense and specific: `user.signed_in`, `lead.status_changed`, `service.published`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws if the entry cannot be written. A mutation that must be audited should fail
   * rather than happen unrecorded, so callers that mean that await this and let it throw.
   */
  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ip: entry.ip ?? null,
      },
    });
  }

  /**
   * For entries that must not be able to break the thing they describe: nobody should be
   * locked out because the audit table is unwritable. The failure is logged loudly instead.
   */
  async recordQuietly(entry: AuditEntry): Promise<void> {
    try {
      await this.record(entry);
    } catch (error) {
      this.logger.error(`Audit entry "${entry.action}" could not be written`, error);
    }
  }
}

/**
 * A nullable Json column will not take a plain `null` — Prisma reserves that spelling for
 * its own `DbNull` and `JsonNull` markers. Leaving the field out says the same thing
 * without importing them: the column keeps its default, which is NULL.
 */
function toJson(value: unknown): object | undefined {
  if (value === undefined || value === null) return undefined;
  return value;
}
