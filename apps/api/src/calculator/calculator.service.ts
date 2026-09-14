import { CALCULATOR_FAQ_GROUP, CALCULATOR_SETTING_KEYS, type CalculatorPageView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ViewCache } from '../common/view-cache';
import { PrismaService } from '../prisma/prisma.service';
import { toCalculatorPageView } from './calculator.mapper';

/**
 * How long the built view is reused. Every render asks for it, so this bounds database
 * load; edited copy, a changed price band or a new question is live within it, no deploy.
 */
export const CALCULATOR_VIEW_TTL_MS = 30_000;

@Injectable()
export class CalculatorPageService {
  private readonly logger = new Logger(CalculatorPageService.name);
  private readonly cache = new ViewCache<CalculatorPageView>(CALCULATOR_VIEW_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  find(): Promise<CalculatorPageView> {
    return this.cache.get('page', () => this.build());
  }

  private async build(): Promise<CalculatorPageView> {
    const db = this.prisma.client;
    const [setting, pricingTiers, faqs] = await Promise.all([
      db.setting.findUnique({ where: { key: CALCULATOR_SETTING_KEYS.page }, select: { value: true } }),
      db.pricingTier.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      db.faq.findMany({ where: { group: CALCULATOR_FAQ_GROUP }, orderBy: { order: 'asc' } }),
    ]);

    try {
      return toCalculatorPageView({ contentSetting: setting?.value ?? null, pricingTiers, faqs });
    } catch (error) {
      this.logger.error(
        `The cost calculator page failed contract validation. Check the "${CALCULATOR_SETTING_KEYS.page}" setting: it needs a label for every answer of all eight questions.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
