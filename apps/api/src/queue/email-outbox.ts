import { PENDING_EMAIL_OUTBOX, emailOutboxData, type OutboxEmailJob, type Prisma, type PrismaClient } from '@calwebtech/db';
import { emailOutboxJobId } from '@calwebtech/shared';
import type { Logger } from '@nestjs/common';
import type { EmailQueue } from './email-queue';

/**
 * The email outbox, the API's half (docs/08-decisions.md, 71).
 *
 * A lead's or a booking's emails are written as rows inside the transaction that stores the
 * lead or the booking, so both commit or neither does. After the commit the API adds the rows
 * to the queue at once. If that fails, or the process dies first, nothing is lost: the rows
 * are committed and the worker's sweep queues every pending row within a minute.
 */

/** One email for the outbox, and when it is due. Without `sendAt` it is due at once. */
export interface OutboxEmail {
  job: OutboxEmailJob;
  sendAt?: Date;
}

/** A row as the queue needs it. */
export interface OutboxRow {
  id: string;
  template: string;
  sendAt: Date;
}

/** Writes the emails as outbox rows inside the caller's transaction. */
export async function writeOutbox(
  tx: Prisma.TransactionClient,
  emails: readonly OutboxEmail[],
  now: Date = new Date(),
): Promise<OutboxRow[]> {
  if (emails.length === 0) return [];
  return tx.emailOutbox.createManyAndReturn({
    data: emails.map(({ job, sendAt }) => emailOutboxData(job, sendAt ?? now)),
    select: { id: true, template: true, sendAt: true },
  });
}

/**
 * Withdraws a booking's reminders that have not been sent, inside the caller's transaction, so
 * a call moved, cancelled or closed is never reminded about at its old time. Returns the job
 * ids to take off the queue once the transaction has committed.
 */
export async function withdrawReminders(
  tx: Prisma.TransactionClient,
  bookingId: string,
  reason: string,
  now: Date = new Date(),
): Promise<string[]> {
  const rows = await tx.emailOutbox.updateManyAndReturn({
    where: { bookingId, template: 'booking-reminder', ...PENDING_EMAIL_OUTBOX },
    data: { cancelledAt: now, error: reason },
    select: { id: true },
  });
  return rows.map((row) => emailOutboxJobId(row.id));
}

/**
 * After the commit: adds the rows to the queue and marks them queued. It never throws, since
 * the lead or the booking is stored and its emails with it; a failure only means the sweep
 * queues them instead.
 */
export async function dispatchOutbox(
  db: PrismaClient,
  queue: EmailQueue | undefined,
  rows: readonly OutboxRow[],
  logger: Logger,
  owner: string,
): Promise<void> {
  if (rows.length === 0 || !queue) return;
  try {
    await queue.enqueueOutbox(rows);
    await db.emailOutbox.updateMany({
      where: { id: { in: rows.map((row) => row.id) }, queuedAt: null },
      data: { queuedAt: new Date() },
    });
  } catch (error) {
    logger.warn(`${owner}: its emails are stored but not queued yet; the worker's sweep will queue them. ${String(error)}`);
  }
}
