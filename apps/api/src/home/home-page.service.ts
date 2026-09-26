import { HOME_PROBLEM_ROUTER_FAQ_GROUP, SETTING_KEYS, type HomePageView } from '@calwebtech/shared';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CONSENTED } from '../common/published';
import { PrismaService } from '../prisma/prisma.service';
import { WORK_COMPARISON_QUERY } from '../work/work.mapper';
import { homeCategoryInclude, homePostInclude, homeProjectInclude, toHomePageView } from './home-page.mapper';

/**
 * How long a built homepage is reused. The web app renders the homepage per request, so
 * this bounds database load, and a changed record or setting (such as homepage.indexing)
 * is live within this window without a redeploy.
 */
export const HOME_PAGE_TTL_MS = 30_000;

const SETTING_ROWS = [
  SETTING_KEYS.homeContent,
  SETTING_KEYS.contact,
  SETTING_KEYS.proof,
  SETTING_KEYS.homepageIndexing,
];

@Injectable()
export class HomePageService {
  private readonly logger = new Logger(HomePageService.name);
  private cached: { view: Promise<HomePageView>; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Concurrent requests share one build; a failed build is not cached. */
  find(): Promise<HomePageView> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.view;

    const view = this.build();
    this.cached = { view, expiresAt: now + HOME_PAGE_TTL_MS };
    view.catch(() => {
      if (this.cached?.view === view) this.cached = null;
    });
    return view;
  }

  private async build(): Promise<HomePageView> {
    const db = this.prisma.client;
    const now = new Date();

    const [
      settings,
      reviewSources,
      clientLogos,
      statistics,
      categories,
      services,
      industries,
      problemRouter,
      projects,
      technologies,
      processSteps,
      testimonials,
      awards,
      posts,
      guide,
      locations,
      pricingTiers,
      comparison,
    ] = await Promise.all([
      db.setting.findMany({ where: { key: { in: SETTING_ROWS } } }),
      db.reviewSource.findMany(),
      db.clientLogo.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      db.statistic.findMany({ orderBy: { order: 'asc' }, take: 4 }),
      db.serviceCategory.findMany({ orderBy: { order: 'asc' }, include: homeCategoryInclude }),
      db.service.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, orderBy: { order: 'asc' } }),
      db.industry.findMany({ where: { status: 'PUBLISHED' }, orderBy: { order: 'asc' } }),
      db.faq.findMany({ where: { group: HOME_PROBLEM_ROUTER_FAQ_GROUP }, orderBy: { order: 'asc' } }),
      // More than are shown, so projects without outcome figures can be skipped.
      db.project.findMany({
        where: { status: 'PUBLISHED', deletedAt: null, featured: true },
        include: homeProjectInclude,
        orderBy: [{ year: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
        take: 12,
      }),
      db.technology.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] }),
      db.processStep.findMany({ orderBy: { order: 'asc' } }),
      db.testimonial.findMany({
        where: CONSENTED,
        orderBy: [{ featured: 'desc' }, { date: 'desc' }],
        take: 12,
      }),
      db.award.findMany({ orderBy: [{ order: 'asc' }, { year: 'desc' }], take: 8 }),
      db.post.findMany({
        where: { OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', publishedAt: { lte: now } }] },
        include: homePostInclude,
        orderBy: { publishedAt: 'desc' },
        take: 3,
      }),
      db.guide.findFirst({ where: { status: 'PUBLISHED' } }),
      db.location.findMany({ where: { status: 'PUBLISHED' }, orderBy: [{ tier: 'asc' }, { city: 'asc' }], take: 6 }),
      db.pricingTier.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      // The comparison /before-and-after/ marks for the homepage (docs/08-decisions.md, 70).
      db.comparison.findFirst({ ...WORK_COMPARISON_QUERY, where: { ...WORK_COMPARISON_QUERY.where, onHomepage: true } }),
    ]);
    const setting = (key: string) => settings.find((row) => row.key === key)?.value ?? null;

    try {
      return toHomePageView({
        contentSetting: setting(SETTING_KEYS.homeContent),
        contactSetting: setting(SETTING_KEYS.contact),
        proofSetting: setting(SETTING_KEYS.proof),
        indexingSetting: setting(SETTING_KEYS.homepageIndexing),
        reviewSources,
        clientLogos,
        statistics,
        categories,
        services,
        industries,
        problemRouter,
        projects,
        technologies,
        processSteps,
        testimonials,
        awards,
        posts,
        guide,
        locations,
        pricingTiers,
        comparison,
      });
    } catch (error) {
      this.logger.error(
        `The homepage failed contract validation. Check the "${SETTING_KEYS.homeContent}" and "${SETTING_KEYS.contact}" settings.`,
        error,
      );
      throw new InternalServerErrorException();
    }
  }
}
