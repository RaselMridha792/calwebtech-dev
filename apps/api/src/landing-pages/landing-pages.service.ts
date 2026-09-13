import { SETTING_KEYS, type LandingPageView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { landingPageInclude, toLandingPageView } from './landing-page.mapper';

@Injectable()
export class LandingPagesService {
  private readonly logger = new Logger(LandingPagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** A published page, or a scheduled one whose publish time has passed. */
  async findPublished(slug: string): Promise<LandingPageView | null> {
    const db = this.prisma.client;
    const now = new Date();

    const page = await db.landingPage.findFirst({
      where: {
        slug,
        deletedAt: null,
        OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishedAt: { lte: now } }],
      },
      include: landingPageInclude,
    });
    if (!page) return null;

    const [settings, reviewSources, clientLogos, processSteps, pricingTiers] = await Promise.all([
      db.setting.findMany({ where: { key: { in: [SETTING_KEYS.contact, SETTING_KEYS.proof] } } }),
      db.reviewSource.findMany(),
      db.clientLogo.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      db.processStep.findMany({ orderBy: { order: 'asc' } }),
      db.pricingTier.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
    ]);
    const setting = (key: string) => settings.find((row) => row.key === key)?.value ?? null;

    try {
      return toLandingPageView({
        page,
        contactSetting: setting(SETTING_KEYS.contact),
        proofSetting: setting(SETTING_KEYS.proof),
        reviewSources,
        clientLogos,
        processSteps,
        pricingTiers,
      });
    } catch (error) {
      this.logger.error(`Landing page "${slug}" failed contract validation`, error);
      throw new InternalServerErrorException();
    }
  }
}
