import type { Prisma, PrismaClient } from '@calwebtech/db';
import { SETTING_KEYS, siteContactSchema } from '@calwebtech/shared';
import type { DeliveryRecord, DeliveryStore } from './process-email-job';

export function prismaDeliveryStore(db: PrismaClient): DeliveryStore {
  /**
   * Writes a delivery on its timeline and, for an outbox email, marks the row sent in the
   * same transaction (docs/08-decisions.md, 71): a row is never sent without its record, nor
   * recorded without being marked, so a retry after either finds it done.
   */
  async function withOutbox(record: DeliveryRecord, write: Prisma.PrismaPromise<unknown>): Promise<void> {
    if (!record.outboxId) {
      await write;
      return;
    }
    await db.$transaction([
      write,
      db.emailOutbox.updateMany({
        where: { id: record.outboxId, sentAt: null },
        data: { sentAt: new Date(), providerId: record.providerId },
      }),
    ]);
  }

  return {
    async siteContact() {
      const row = await db.setting.findUnique({ where: { key: SETTING_KEYS.contact } });
      const parsed = siteContactSchema.safeParse(row?.value);
      return parsed.success ? parsed.data : null;
    },
    async recordDelivery(leadId, record) {
      await withOutbox(
        record,
        db.leadActivity.create({
          data: {
            leadId,
            type: 'email_sent',
            detail: {
              template: record.template,
              to: record.to,
              transport: record.transport,
              providerId: record.providerId,
              ...(record.redirectedFrom ? { redirectedFrom: record.redirectedFrom } : {}),
            },
          },
        }),
      );
    },

    async bookingState(bookingId) {
      return db.booking.findUnique({ where: { id: bookingId }, select: { status: true, startsAt: true } });
    },

    async recordBookingDelivery(bookingId, record) {
      await withOutbox(
        record,
        db.bookingEvent.create({
          data: {
            bookingId,
            // A reminder is its own event (`reminded_24h`, `reminded_1h`), as the schema names them.
            type: record.window ? `reminded_${record.window}` : 'email_sent',
            detail: {
              template: record.template,
              to: record.to,
              transport: record.transport,
              providerId: record.providerId,
              ...(record.redirectedFrom ? { redirectedFrom: record.redirectedFrom } : {}),
            },
          },
        }),
      );
    },

    async outboxEmail(outboxId) {
      return db.emailOutbox.findUnique({
        where: { id: outboxId },
        select: { payload: true, sentAt: true, cancelledAt: true, failedAt: true },
      });
    },

    async withdrawOutboxEmail(outboxId, reason) {
      await db.emailOutbox.updateMany({
        where: { id: outboxId, sentAt: null },
        data: { cancelledAt: new Date(), error: reason },
      });
    },
  };
}
