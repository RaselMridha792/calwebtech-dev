import type { PrismaClient } from '@calwebtech/db';

/**
 * Writes one audit row (docs/08-decisions.md, 68). On its own, with no Nest import, because
 * `settings-cli` writes through it too, and a command line has no API process to borrow.
 * `AuditService` is this, injected.
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

/** Anything that can write an audit row: the API's client, a CLI's, or a transaction. */
export type AuditWriter = Pick<PrismaClient, 'auditLog'>;

/** One audit row. Throws if it cannot be written, like `AuditService.record`. */
export async function writeAudit(db: AuditWriter, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
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
 * A nullable Json column will not take a plain `null` — Prisma reserves that spelling for
 * its own `DbNull` and `JsonNull` markers. Leaving the field out says the same thing
 * without importing them: the column keeps its default, which is NULL.
 */
function toJson(value: unknown): object | undefined {
  if (value === undefined || value === null) return undefined;
  return value;
}
