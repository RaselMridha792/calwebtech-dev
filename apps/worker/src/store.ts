import type { PrismaClient } from '@calwebtech/db';
import { SETTING_KEYS, siteContactSchema } from '@calwebtech/shared';
import type { DeliveryStore } from './process-email-job';

export function prismaDeliveryStore(db: PrismaClient): DeliveryStore {
  return {
    async siteContact() {
      const row = await db.setting.findUnique({ where: { key: SETTING_KEYS.contact } });
      const parsed = siteContactSchema.safeParse(row?.value);
      return parsed.success ? parsed.data : null;
    },
    async recordDelivery(leadId, record) {
      await db.leadActivity.create({
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
      });
    },
  };
}
