import {
  SETTING_KEYS,
  companyAwardsViewSchema,
  companyTeamViewSchema,
  companyTechnologyViewSchema,
  homePageViewSchema,
  industryDetailViewSchema,
  landingPageViewSchema,
  staticProcessViewSchema,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workIndexViewSchema,
  type HomePageView,
  type LandingPageView,
} from '@calwebtech/shared';
import { IMPORTED_AT, type ImportContext } from './core';
import type { SnapshotImporter } from './index';

/**
 * The records more than one page shows, written before any page's own importer: contact
 * details and the NPS figures, review platforms, statistics, client logos, pricing tiers,
 * process steps, technologies, team members, partners, awards, the industries case studies
 * belong to, the featured case studies with the homepage's before and after pair, and the
 * client quotes.
 *
 * Every value comes from a snapshot. A column the homepage or the landing page shows takes
 * that page's value. A required column neither shows (an answer block, a case study's title)
 * takes the value in the record's own family snapshot, so the family's importer writes the
 * same thing when it adds its columns to the row. Relations and columns no view here reads
 * are left to those importers.
 */
export const proofImporter: SnapshotImporter = {
  family: 'proof',
  async run(ctx) {
    const home = ctx.read('home.json', homePageViewSchema);
    const landing = ctx.read('landing-b2b-website-design.json', landingPageViewSchema);

    await ctx.setSetting(SETTING_KEYS.contact, home.contact);
    await ctx.setSetting(SETTING_KEYS.proof, {
      npsScore: home.reviews.npsScore,
      npsProjectCount: home.reviews.npsProjectCount,
    });

    await importReviewSources(ctx, home);
    await importBands(ctx, home);
    await importProcessSteps(ctx);
    await importTechnologies(ctx, home, landing);
    await importTeam(ctx, landing);
    await importPartners(ctx, landing);
    await importAwards(ctx, home);
    await importIndustries(ctx, home);
    await importComparison(ctx, home);
    await importCaseStudies(ctx, home);
    await importQuotes(ctx, home);
  },
};

/** The homepage carries each platform's review count; the landing page only the ratings. */
async function importReviewSources(ctx: ImportContext, home: HomePageView): Promise<void> {
  for (const source of home.reviews.sources) {
    await ctx.upsertReviewSource({
      platform: source.platform,
      // A string, so 4.9 reaches the Decimal column as 4.9 and not as a binary fraction.
      rating: source.rating.toFixed(1),
      reviewCount: source.reviewCount ?? 0,
      refreshedAt: IMPORTED_AT,
    });
  }
}

/** Statistics, client logos and pricing tiers: whole rows on the homepage, in its order. */
async function importBands(ctx: ImportContext, home: HomePageView): Promise<void> {
  for (const [order, statistic] of home.statistics.entries()) {
    await ctx.upsertStatistic({
      label: statistic.label,
      value: statistic.value,
      suffix: statistic.suffix === '' ? null : statistic.suffix,
      order,
    });
  }
  for (const [order, client] of home.clients.entries()) {
    await ctx.upsertClientLogo({
      name: client.name,
      logoUrl: client.logo?.src ?? null,
      logoAlt: client.logo?.alt ?? null,
      active: true,
      order,
    });
  }
  for (const [order, tier] of home.pricingTiers.entries()) {
    await ctx.upsertPricingTier({ ...tier, active: true, order });
  }
}

/**
 * From the process page's snapshot, the one place a step is whole: the homepage shows the
 * title, timing and summary, the landing page everything but the summary. A step is found by
 * its title, and the process page and the landing page agree on every title, so theirs is the
 * one written.
 */
async function importProcessSteps(ctx: ImportContext): Promise<void> {
  const { steps } = ctx.read('static/process.json', staticProcessViewSchema);
  for (const [order, { image, ...step }] of steps.entries()) {
    await ctx.upsertProcessStep({ ...step, imageUrl: image?.src ?? null, imageAlt: image?.alt ?? null, order });
  }
}

/**
 * The homepage names technologies by group; the technology page's snapshot has each one's
 * slug and the group's category key. The landing page lists its own by `order` alone and the
 * homepage by `order` within a category, so the landing page's take the first places in its
 * order and the rest follow in the homepage's. Both orders hold, because within every group
 * the landing page's technologies come first.
 */
async function importTechnologies(ctx: ImportContext, home: HomePageView, landing: LandingPageView): Promise<void> {
  const stack = ctx.read('company/technology.json', companyTechnologyViewSchema);
  const landingOrder = new Map(landing.technologies.map((technology, order) => [technology.name, order]));
  let following = landingOrder.size;

  for (const group of home.technologyGroups) {
    const known = stack.groups.find((candidate) => candidate.label === group.category);
    if (!known) throw new Error(`import: proof: company/technology.json has no "${group.category}" group`);
    for (const name of group.names) {
      const match = known.technologies.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
      if (!match) throw new Error(`import: proof: company/technology.json has no "${name}" under "${group.category}"`);
      const order = landingOrder.get(name) ?? following;
      if (!landingOrder.has(name)) following += 1;
      const data = { name, category: known.key, order };
      await ctx.db.technology.upsert({ where: { slug: match.slug }, create: { slug: match.slug, ...data }, update: data });
    }
  }
}

/** The landing page shows the people; the team page's snapshot has their slugs. */
async function importTeam(ctx: ImportContext, landing: LandingPageView): Promise<void> {
  const { members } = ctx.read('company/team.json', companyTeamViewSchema);
  for (const [order, member] of landing.team.entries()) {
    const slug = members.find((candidate) => candidate.name === member.name)?.slug;
    if (!slug) throw new Error(`import: proof: company/team.json has no member named "${member.name}"`);
    const data = { name: member.name, role: member.role, bio: member.bio, photo: member.photo?.src ?? null, active: true, order };
    await ctx.db.teamMember.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  }
}

/** A partner's note on the landing page is its certification; the partners page says the same. */
async function importPartners(ctx: ImportContext, landing: LandingPageView): Promise<void> {
  for (const [order, partner] of landing.partners.entries()) {
    await ctx.upsertPartner({ name: partner.name, certification: partner.note, order });
  }
}

/**
 * The homepage shows an award as a name and one line of detail, which is not enough for a
 * row: the year is its own column. So the awards the homepage names are written from the
 * awards page's snapshot, in that page's order.
 */
async function importAwards(ctx: ImportContext, home: HomePageView): Promise<void> {
  const named = new Set(home.awards.map((award) => award.name));
  const { awards } = ctx.read('company/awards.json', companyAwardsViewSchema);
  for (const [order, award] of awards.entries()) {
    if (!named.has(award.name)) continue;
    await ctx.upsertAward({ name: award.name, year: award.year, category: award.category, projectName: award.projectName, order });
  }
}

/** The industries the homepage lists, published and in its order. */
async function importIndustries(ctx: ImportContext, home: HomePageView): Promise<void> {
  for (const [order, industry] of home.industries.entries()) {
    const { answerBlock } = ctx.read(`industries/${industry.slug}.json`, industryDetailViewSchema);
    const data = { name: industry.name, heroCopy: industry.line, answerBlock, order, status: 'PUBLISHED' as const };
    await ctx.db.industry.upsert({ where: { slug: industry.slug }, create: { slug: industry.slug, ...data }, update: data });
  }
}

/**
 * The industry a case study belongs to. One the homepage does not list is created as a draft
 * from its own snapshot, so the case study can name it and the homepage's list stays as
 * approved; the industries importer publishes it. A row that exists keeps its status.
 */
async function industryIdOf(ctx: ImportContext, slug: string): Promise<string> {
  const existing = await ctx.findSlugId('industry', slug);
  if (existing) return existing;
  const detail = ctx.read(`industries/${slug}.json`, industryDetailViewSchema);
  const order = await ctx.db.industry.count();
  const created = await ctx.db.industry.create({
    data: { slug, name: detail.name, heroCopy: detail.hero.line, answerBlock: detail.answerBlock, order, status: 'DRAFT' },
    select: { id: true },
  });
  return created.id;
}

/**
 * The homepage's before and after pair. It belongs to a project; when that project has no
 * case study of its own (the before and after page gives it no slug), the project exists for
 * the pair alone: featured and published, which is what puts it on the homepage, and without
 * outcome figures, which keeps it off the case study cards and off /work/. No snapshot has a
 * title or an answer block for such a project, so it takes the client's name and the
 * comparison's summary. Runs before the case studies, which set their own `updatedAt` should
 * one of them carry the pair.
 */
async function importComparison(ctx: ImportContext, home: HomePageView): Promise<void> {
  const comparison = home.beforeAfter;
  if (!comparison) return;
  const { comparisons } = ctx.read('work/before-and-after.json', workBeforeAndAfterViewSchema);
  const published = comparisons.find((candidate) => candidate.clientName === comparison.clientName);
  const slug = published?.slug ?? slugOf(comparison.clientName);
  const summary = published?.summary ?? comparison.clientName;
  const pair = {
    beforeImageUrl: comparison.before.src,
    afterImageUrl: comparison.after.src,
    beforeAfterMetrics: ctx.json(comparison.metrics),
  };
  await ctx.db.project.upsert({
    where: { slug },
    create: {
      slug,
      title: comparison.clientName,
      clientName: comparison.clientName,
      summary,
      answerBlock: summary,
      outcomeMetrics: [],
      featured: true,
      status: 'PUBLISHED',
      updatedAt: IMPORTED_AT,
      ...pair,
    },
    update: { ...pair, updatedAt: IMPORTED_AT },
  });
}

/**
 * The homepage's case study cards, in its order, with the title, answer block, location and
 * industry from each case study's own snapshot. `segment` is what the /work/ card's tags
 * leave once the location and the platforms are taken out ("B2B, Distribution").
 *
 * The homepage orders featured projects by year, then `updatedAt`, newest first. No case study
 * has a year and their snapshots all give the same `updatedAt`, which would leave the order
 * to chance: it changed between two imports of the same files. So each card's `updatedAt` is
 * its snapshot's plus one second for every card after it, which keeps the homepage's order
 * and every case study on the date its snapshot gives.
 */
async function importCaseStudies(ctx: ImportContext, home: HomePageView): Promise<void> {
  const { caseStudies } = ctx.read('work/index.json', workIndexViewSchema);
  for (const [index, card] of home.projects.entries()) {
    const study = ctx.read(`work/${card.slug}.json`, workCaseStudyViewSchema);
    const secondsAhead = home.projects.length - 1 - index;
    const { location, industry, platforms } = study.atAGlance;
    const platformNames = new Set(platforms.map((platform) => platform.name));
    const tags = caseStudies.find((candidate) => candidate.slug === card.slug)?.tags ?? [];
    const segment = tags.filter((tag) => tag !== location && !platformNames.has(tag)).join(', ');

    const data = {
      title: study.title,
      clientName: card.clientName,
      answerBlock: study.answerBlock,
      summary: card.summary,
      location,
      segment: segment === '' ? null : segment,
      coverImageUrl: card.image?.src ?? null,
      coverImageAlt: card.image?.alt ?? null,
      outcomeMetrics: ctx.json(card.metrics),
      featured: true,
      status: 'PUBLISHED' as const,
      industryId: industry ? await industryIdOf(ctx, industry.slug) : null,
      updatedAt: new Date(new Date(study.updatedAt).getTime() + secondsAhead * 1000),
    };
    await ctx.db.project.upsert({ where: { slug: card.slug }, create: { slug: card.slug, ...data }, update: data });
  }
}

/**
 * The client quotes on the homepage, with consent, since nothing shows without it. A quote on
 * a case study card belongs to that project; the pull quote is the featured one. Written in
 * the order the pages show them: no snapshot dates a quote, so that order is all there is.
 */
async function importQuotes(ctx: ImportContext, home: HomePageView): Promise<void> {
  const quotes = [
    ...home.projects.flatMap((project) => (project.quote ? [{ quote: project.quote, projectSlug: project.slug, featured: false }] : [])),
    ...(home.pullQuote ? [{ quote: home.pullQuote, projectSlug: null, featured: true }] : []),
    ...home.testimonials.map((quote) => ({ quote, projectSlug: null, featured: false })),
  ];
  for (const { quote, projectSlug, featured } of quotes) {
    await ctx.upsertTestimonial({
      id: quote.id,
      clientName: quote.clientName,
      role: quote.role,
      company: quote.company,
      avatarUrl: quote.avatar?.src ?? null,
      rating: quote.rating,
      quote: quote.quote,
      featured,
      consentAt: IMPORTED_AT,
      projectId: projectSlug ? await ctx.slugId('project', projectSlug) : null,
    });
  }
}

/** "Halloway Group" as `halloway-group`. */
function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
