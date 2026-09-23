import { SETTING_KEYS, leadNotificationRecipientsSchema } from '@calwebtech/shared';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** One setting's stored value, or null. The caller validates it with its own schema. */
  async get(key: string): Promise<unknown> {
    const row = await this.prisma.client.setting.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
  }

  /**
   * Who gets the internal notification. Read on every lead and never cached, so a
   * changed address applies to the next lead without a restart or a redeploy.
   */
  async leadNotificationRecipients(): Promise<string[]> {
    const key = SETTING_KEYS.leadNotificationRecipients;
    const row = await this.prisma.client.setting.findUnique({ where: { key } });
    if (!row) return [];
    const parsed = leadNotificationRecipientsSchema.safeParse(row.value);
    if (!parsed.success) {
      this.logger.error(`Setting "${key}" is invalid, so no internal notification is sent: ${parsed.error.message}`);
      return [];
    }
    return parsed.data.emails;
  }
}
