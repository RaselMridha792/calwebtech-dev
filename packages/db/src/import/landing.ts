import { beforeAfterViewSchema, landingPageViewSchema, type LandingPageView } from '@calwebtech/shared';
import { Prisma } from '../generated/prisma/client';
import { IMPORTED_AT, type ImportContext } from './core';
import type { SnapshotImporter } from './index';

/** `Faq.group` of a landing page's questions, as the seed has it. */
const LANDING_FAQ_GROUP = 'landing';

/**
 * The campaign landing page (`GET /landing-pages/<slug>`): its copy, SEO fields and the date
 * it last changed, the proof it relates (case studies, quotes, team, partners, technologies
 * and the before and after pair) and its questions. The proof itself is proof.ts's; here it
 * is found and related, never written, so a record has one set of values whichever page
 * shows it.
 */
export const landingImporter: SnapshotImporter = {
  family: 'landing',
  async run(ctx) {
    const page = ctx.read('landing-b2b-website-design.json', landingPageViewSchema);

    const related = {
      results: await Promise.all(page.results.map(async (result) => ({ id: await ctx.slugId('project', result.slug) }))),
      testimonials: await idsOf('client quote', page.testimonials, (quote) =>
        ctx.db.testimonial.findFirst({
          // By person, not by wording: the campaign shortens two of the quotes.
          where: { clientName: quote.clientName, company: quote.company, consentAt: { not: null } },
          select: { id: true },
        }),
      ),
      team: await idsOf('team member', page.team, (member) =>
        ctx.db.teamMember.findFirst({ where: { name: member.name }, select: { id: true } }),
      ),
      partners: await idsOf('partner', page.partners, (partner) =>
        ctx.db.partner.findFirst({ where: { name: partner.name }, select: { id: true } }),
      ),
      technologies: await idsOf('technology', page.technologies, (technology) =>
        ctx.db.technology.findFirst({ where: { name: technology.name }, select: { id: true } }),
      ),
    };
    const comparisonId = await comparisonIdOf(ctx, page);

    const data = {
      name: page.name,
      status: 'PUBLISHED' as const,
      noindex: page.noindex,
      content: ctx.json(page.content),
      seo: page.seo ? ctx.json(page.seo) : Prisma.DbNull,
      publishedAt: IMPORTED_AT,
      // The page shows when it last changed, so the snapshot's date is kept rather than today's.
      updatedAt: new Date(page.updatedAt),
    };
    const row = await ctx.db.landingPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        ...data,
        results: { connect: related.results },
        testimonials: { connect: related.testimonials },
        team: { connect: related.team },
        partners: { connect: related.partners },
        technologies: { connect: related.technologies },
        ...(comparisonId ? { beforeAfterProject: { connect: { id: comparisonId } } } : {}),
      },
      update: {
        ...data,
        results: { set: related.results },
        testimonials: { set: related.testimonials },
        team: { set: related.team },
        partners: { set: related.partners },
        technologies: { set: related.technologies },
        beforeAfterProject: comparisonId ? { connect: { id: comparisonId } } : { disconnect: true },
      },
      select: { id: true },
    });

    await ctx.replaceFaqs(
      { landingPageId: row.id },
      page.faqs.map((faq) => ({ ...faq, group: LANDING_FAQ_GROUP, landingPageId: row.id })),
    );
  },
};

/** Each record as `{ id }`, in the page's order; one that proof.ts has not written stops the import. */
async function idsOf<T extends { name?: string; clientName?: string }>(
  kind: string,
  records: readonly T[],
  find: (record: T) => Promise<{ id: string } | null>,
): Promise<{ id: string }[]> {
  const ids: { id: string }[] = [];
  for (const record of records) {
    const row = await find(record);
    if (!row) throw new Error(`import: landing: no ${kind} "${record.name ?? record.clientName ?? ''}" yet; proof.ts writes them first`);
    ids.push({ id: row.id });
  }
  return ids;
}

/**
 * The project behind the page's before and after pair. The campaign names its client only as
 * "Client", so the pair is recognised by its figures: the published comparison that measured
 * the same things. A pair no published project carries is left unrelated rather than given a
 * project of its own, which would put a client called "Client" on /before-and-after/.
 */
async function comparisonIdOf(ctx: ImportContext, page: LandingPageView): Promise<string | null> {
  const wanted = page.beforeAfter?.metrics;
  if (!wanted) return null;
  const projects = await ctx.db.project.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, beforeImageUrl: { not: null }, afterImageUrl: { not: null } },
    select: { id: true, beforeAfterMetrics: true },
  });
  const match = projects.find((project) => {
    const figures = beforeAfterViewSchema.shape.metrics.safeParse(project.beforeAfterMetrics);
    return (
      figures.success &&
      figures.data.length === wanted.length &&
      figures.data.every((figure, index) => {
        const other = wanted[index];
        return other !== undefined && figure.label === other.label && figure.before === other.before && figure.after === other.after;
      })
    );
  });
  return match?.id ?? null;
}
