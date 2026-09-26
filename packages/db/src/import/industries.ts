import {
  INDUSTRY_FALLBACK_HEADINGS,
  INDUSTRY_SETTING_KEYS,
  industriesIndexViewSchema,
  industryContentSchema,
  industryDetailViewSchema,
  type Image,
  type IndustryContent,
  type IndustryDetailView,
} from '@calwebtech/shared';
import { storedSeo } from './core';
import type { SnapshotImporter } from './index';

type Ctx = Parameters<SnapshotImporter['run']>[0];

/**
 * The industries family: the index copy, and each industry's page copy and FAQs
 * (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * `references` already wrote one row per industry with the columns a service page links to.
 * This brings the rest of the page into the row, so an industry can be edited in the admin
 * and read from the database first. Its own family, not more lines in `references`: the
 * marker names the families that have run, so a live database that imported `references`
 * long ago runs this on the next deploy and nothing else.
 *
 * The snapshot is the rendered page, read backwards into `Industry.content`. Two sections a
 * page shows only when it has case studies carry the template's headings where the snapshot
 * has none: they render nothing on those pages either way.
 */
export const industriesImporter: SnapshotImporter = {
  family: 'industries',
  async run(ctx) {
    const index = ctx.read('industries/index.json', industriesIndexViewSchema);
    await ctx.setSetting(INDUSTRY_SETTING_KEYS.index, index.content);

    let faqs = 0;
    for (const [order, card] of index.industries.entries()) {
      const view = ctx.read(`industries/${card.slug}.json`, industryDetailViewSchema);
      faqs += await upsertIndustry(ctx, view, card.image, order);
    }
    ctx.log(`import: industries: ${String(index.industries.length)} industries, ${String(faqs)} FAQs`);
  },
};

/** Writes one industry's page and FAQs, and returns how many FAQs it wrote. */
async function upsertIndustry(ctx: Ctx, view: IndustryDetailView, image: Image | null, order: number): Promise<number> {
  const content = ctx.json(contentFrom(view, image));
  const existing = await ctx.db.industry.findUnique({ where: { slug: view.slug }, select: { content: true } });
  const identity = {
    name: view.name,
    heroCopy: view.hero.line,
    order,
  };

  const industry = await ctx.db.industry.upsert({
    where: { slug: view.slug },
    create: {
      slug: view.slug,
      answerBlock: view.answerBlock,
      content,
      seo: ctx.json(storedSeo(view.seo)),
      status: 'PUBLISHED',
      ...identity,
    },
    // `references` wrote the row without its copy; this is where the copy arrives. Copy that
    // is already there was written by this importer or rewritten in the admin since, and a
    // forced run leaves it alone.
    update:
      existing?.content === null
        ? { ...identity, answerBlock: view.answerBlock, content, seo: ctx.json(storedSeo(view.seo)) }
        : identity,
  });

  for (const [faqOrder, item] of (view.faq?.items ?? []).entries()) {
    const faq = await ctx.db.faq.findFirst({
      where: { industryId: industry.id, question: item.question },
      select: { id: true },
    });
    if (faq) await ctx.db.faq.update({ where: { id: faq.id }, data: { answer: item.answer, order: faqOrder } });
    else {
      await ctx.db.faq.create({
        data: { industryId: industry.id, question: item.question, answer: item.answer, order: faqOrder },
      });
    }
  }
  return view.faq?.items.length ?? 0;
}

/**
 * The page's copy, read back out of the page. The card image comes from the index, which is
 * the only place the approved snapshots show it.
 */
function contentFrom(view: IndustryDetailView, image: Image | null): IndustryContent {
  if (!view.hero.intro) throw new Error(`import: industries/${view.slug}.json has no hero intro`);
  if (!view.painPoints) throw new Error(`import: industries/${view.slug}.json has no pain points`);
  if (!view.integrations) throw new Error(`import: industries/${view.slug}.json has no integrations`);

  return industryContentSchema.parse({
    title: view.title,
    image,
    hero: {
      intro: view.hero.intro,
      primaryCta: view.hero.primaryCta,
      secondaryCta: view.hero.secondaryCta,
      highlights: view.hero.highlights,
      backdrop: view.hero.backdrop,
    },
    painPoints: {
      heading: view.painPoints.heading,
      intro: view.painPoints.intro,
      items: view.painPoints.items.map((item) => ({ title: item.title, body: item.body })),
    },
    services: {
      heading: view.services?.heading ?? INDUSTRY_FALLBACK_HEADINGS.services,
      intro: view.services?.intro ?? null,
      items: (view.services?.items ?? []).map((item) => ({ slug: item.slug, body: item.body })),
    },
    compliance: view.compliance,
    caseStudies: {
      heading: view.caseStudies?.heading ?? INDUSTRY_FALLBACK_HEADINGS.caseStudies,
      intro: view.caseStudies?.intro ?? null,
      linkLabel: view.caseStudies?.link.label ?? INDUSTRY_FALLBACK_HEADINGS.caseStudiesLink,
    },
    results: {
      heading: view.results?.heading ?? INDUSTRY_FALLBACK_HEADINGS.results,
      intro: view.results?.intro ?? null,
      note: view.results?.note ?? null,
    },
    integrations: {
      heading: view.integrations.heading,
      intro: view.integrations.intro,
      items: view.integrations.items.map((item) => ({ name: item.name, body: item.body })),
    },
    faq: {
      heading: view.faq?.heading ?? INDUSTRY_FALLBACK_HEADINGS.faq,
      intro: view.faq?.intro ?? null,
    },
  });
}
