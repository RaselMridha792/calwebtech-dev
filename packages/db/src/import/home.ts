import {
  HOME_PROBLEM_ROUTER_FAQ_GROUP,
  SETTING_KEYS,
  homePageViewSchema,
  insightsArticleViewSchema,
  locationDetailViewSchema,
  serviceDetailViewSchema,
  siteChromeViewSchema,
  type HomePageView,
} from '@calwebtech/shared';
import { IMPORTED_AT, type ImportContext } from './core';
import type { SnapshotImporter } from './index';

/**
 * The homepage (`GET /pages/home`) and the site chrome (`GET /site/chrome`), which is built
 * from the same copy and records. Writes the homepage copy and the two indexing settings,
 * then what the homepage lists beyond the shared proof (proof.ts): services and their
 * groups, locations, articles and the problem router.
 *
 * Titles, summaries and the rest of what the homepage shows are the homepage's. The columns
 * a row needs that it does not show (an answer block, an article's body) come from the
 * record's own family snapshot, as in proof.ts.
 */
export const homeImporter: SnapshotImporter = {
  family: 'home',
  async run(ctx) {
    const home = ctx.read('home.json', homePageViewSchema);
    const chrome = ctx.read('site-chrome.json', siteChromeViewSchema);

    await ctx.setSetting(SETTING_KEYS.homeContent, home.content);
    // Both stay as the snapshots have them, which is off: the proof is demonstration content.
    await ctx.setSetting(SETTING_KEYS.homepageIndexing, { index: home.indexable });
    await ctx.setSetting(SETTING_KEYS.siteIndexing, { index: chrome.indexable });

    await importServices(ctx, home);
    await importLocations(ctx, home);
    await importArticles(ctx, home);

    await ctx.replaceFaqs(
      { group: HOME_PROBLEM_ROUTER_FAQ_GROUP },
      home.problemRouter.map((faq) => ({ ...faq, group: HOME_PROBLEM_ROUTER_FAQ_GROUP })),
    );
  },
};

/**
 * Services in the homepage's order, each in the group the homepage puts it in. The group's
 * name is the homepage's; its slug is the one the service's own snapshot gives its category.
 */
async function importServices(ctx: ImportContext, home: HomePageView): Promise<void> {
  const groupOf = new Map(
    home.serviceGroups.flatMap((group, order) => group.services.map((service) => [service.slug, { name: group.name, order }] as const)),
  );

  for (const [order, service] of home.services.entries()) {
    const detail = ctx.read(`services/${service.slug}.json`, serviceDetailViewSchema);
    const group = groupOf.get(service.slug);
    const category =
      group && detail.category
        ? await ctx.db.serviceCategory.upsert({
            where: { slug: detail.category.slug },
            create: { slug: detail.category.slug, ...group },
            update: group,
            select: { id: true },
          })
        : null;

    const data = {
      title: service.title,
      shortDescription: service.summary,
      answerBlock: detail.answerBlock,
      deliverables: service.deliverables,
      order,
      status: 'PUBLISHED' as const,
      publishedAt: IMPORTED_AT,
      categoryId: category?.id ?? null,
    };
    await ctx.db.service.upsert({ where: { slug: service.slug }, create: { slug: service.slug, ...data }, update: data });
  }
}

/** `localContext` is the location page's paragraphs, which its mapper splits on blank lines. */
async function importLocations(ctx: ImportContext, home: HomePageView): Promise<void> {
  for (const location of home.locations) {
    const detail = ctx.read(`locations/${location.slug}.json`, locationDetailViewSchema);
    const data = {
      city: location.city,
      state: location.state,
      tier: location.tier,
      serviceArea: location.serviceArea,
      address: location.address,
      answerBlock: detail.answerBlock,
      localContext: detail.localContext.paragraphs.join('\n\n'),
      status: 'PUBLISHED' as const,
    };
    await ctx.db.location.upsert({ where: { slug: location.slug }, create: { slug: location.slug, ...data }, update: data });
  }
}

/**
 * The homepage's articles, published when their own snapshots say they were, with the topic
 * each is filed under. The body is the article page's, which leaves the key takeaways out;
 * the insights importer writes the whole of it.
 */
async function importArticles(ctx: ImportContext, home: HomePageView): Promise<void> {
  for (const post of home.posts) {
    const article = ctx.read(`insights/${post.slug}.json`, insightsArticleViewSchema);
    const topic = article.category;
    const category = topic
      ? await ctx.db.postCategory.upsert({
          where: { slug: topic.slug },
          create: { slug: topic.slug, name: post.category ?? topic.name },
          update: { name: post.category ?? topic.name },
          select: { id: true },
        })
      : null;

    const data = {
      title: post.title,
      excerpt: post.excerpt,
      answerBlock: article.answerBlock,
      body: article.body,
      readingTime: post.readingTime,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(article.publishedAt),
      categoryId: category?.id ?? null,
    };
    await ctx.db.post.upsert({ where: { slug: post.slug }, create: { slug: post.slug, ...data }, update: data });
  }
}
