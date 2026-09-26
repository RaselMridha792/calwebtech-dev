import { PENDING_EMAIL_OUTBOX, type PrismaClient } from '@calwebtech/db';

/** The queue the outbox sweep runs on, every minute and when the worker starts. */
export const EMAIL_OUTBOX_SWEEP_QUEUE = 'email-outbox-sweep';

const CHUNK = 500;

/** An outbox row as the email queue needs it. */
export interface OutboxRowToQueue {
  id: string;
  template: string;
  sendAt: Date;
}

export interface OutboxSweepOptions {
  db: PrismaClient;
  /** Adds the rows to the email queue, each at its time. A row's job id is its own, so one already queued is not added twice. */
  enqueue: (rows: readonly OutboxRowToQueue[]) => Promise<void>;
  log: (line: string) => void;
  now?: Date;
}

export interface OutboxSweepResult {
  /** Rows still to send, all added to the queue. */
  pending: number;
  /** Of those, the rows nobody had queued: the API died after its commit, or Redis was away. */
  neverQueued: number;
}

/**
 * The email outbox sweep (docs/08-decisions.md, 71).
 *
 * A lead's or a booking's emails are committed with it as outbox rows, and the API queues them
 * straight after. This queues every row still to send. A row the API queued is still waiting
 * under its own id, so adding it again does nothing. A row the API never queued, because the
 * process died between its commit and the queue or Redis refused it, is queued now, delayed to
 * its time. Adding every pending row, not only the unqueued ones, also puts back a job Redis
 * has lost, such as a reminder due next week.
 *
 * Nothing is sent twice: the job id is the row's, the worker skips a row already sent, and
 * the provider's idempotency key is the row's too.
 */
export async function runEmailOutboxSweep({ db, enqueue, log, now = new Date() }: OutboxSweepOptions): Promise<OutboxSweepResult> {
  const pending = await db.emailOutbox.findMany({
    where: PENDING_EMAIL_OUTBOX,
    select: { id: true, template: true, sendAt: true, queuedAt: true },
    orderBy: { sendAt: 'asc' },
  });

  for (let start = 0; start < pending.length; start += CHUNK) {
    const part = pending.slice(start, start + CHUNK);
    await enqueue(part.map(({ id, template, sendAt }) => ({ id, template, sendAt })));
    await db.emailOutbox.updateMany({
      where: { id: { in: part.map((row) => row.id) }, queuedAt: null },
      data: { queuedAt: now },
    });
  }

  const neverQueued = pending.filter((row) => row.queuedAt === null).length;
  if (neverQueued > 0) log(`outbox: queued ${String(neverQueued)} email(s) the API had not`);
  return { pending: pending.length, neverQueued };
}

/**
 * Gives up on a row whose every attempt failed, or whose payload can never be sent, so the
 * sweep stops queuing it. The reason stays on the row for whoever looks.
 */
export async function markOutboxEmailFailed(db: PrismaClient, outboxId: string, reason: string): Promise<void> {
  await db.emailOutbox.updateMany({
    where: { id: outboxId, sentAt: null },
    data: { failedAt: new Date(), error: reason.slice(0, 500) },
  });
}
