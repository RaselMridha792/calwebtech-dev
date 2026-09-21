import { workCaseStudyViewSchema, workIndexViewSchema } from '@calwebtech/shared';
import { storedSeo } from './core';
import type { SnapshotImporter } from './index';

/**
 * Case studies and the quotes that belong to them.
 *
 * Imported from the work family's own snapshots, not from the cards inside a service page:
 * those cards carry a slug, a summary and three figures, while a `Project` row requires a
 * title and an answer block. Building a row from a card would mean writing copy that exists
 * nowhere — so the full record comes from the full record.
 *
 * Services are linked from the services importer rather than here. Both directions of the
 * link cannot be written by whichever runs first, and the services snapshot is what decides
 * which case studies a service page shows.
 */
export const workImporter: SnapshotImporter = {
  family: 'work',
  async run(ctx) {
    const index = ctx.read('work/index.json', workIndexViewSchema);
    let projects = 0;
    let quotes = 0;

    for (const card of index.caseStudies) {
      const study = ctx.read(`work/${card.slug}.json`, workCaseStudyViewSchema);
      const industry = study.atAGlance.industry
        ? await ctx.db.industry.findUnique({ where: { slug: study.atAGlance.industry.slug }, select: { id: true } })
        : null;

      const project = await ctx.db.project.upsert({
        where: { slug: study.slug },
        create: {
          slug: study.slug,
          title: study.title,
          clientName: study.clientName,
          answerBlock: study.answerBlock,
          summary: study.summary,
          // The at-a-glance panel's own facts, which the card also shows as tags.
          location: study.atAGlance.location,
          duration: study.atAGlance.duration,
          year: study.atAGlance.year,
          liveUrl: study.atAGlance.liveUrl,
          coverImageUrl: study.cover?.src ?? null,
          coverImageAlt: study.cover?.alt ?? null,
          // Mandatory on the model, and the figures are the point of a case study.
          outcomeMetrics: ctx.json(study.metrics),
          // The page renders these as paragraphs; the column holds one block of prose.
          challenge: paragraphs(study.challenge),
          approach: paragraphs(study.approach),
          buildNotes: paragraphs(study.build),
          outcome: paragraphs(study.outcome),
          gallery: ctx.json(study.gallery.map((image) => image.src)),
          seo: ctx.json(storedSeo(study.seo)),
          status: 'PUBLISHED',
          industryId: industry?.id ?? null,
        },
        // Prose someone has rewritten in the admin is theirs. What the snapshot still owns
        // is the record's identity and the figures it is quoted for.
        update: {
          title: study.title,
          clientName: study.clientName,
          location: study.atAGlance.location,
          summary: study.summary,
          outcomeMetrics: ctx.json(study.metrics),
          industryId: industry?.id ?? null,
        },
      });
      projects += 1;

      if (study.quote) {
        const quote = study.quote;
        const existing = await ctx.db.testimonial.findFirst({
          where: { projectId: project.id, clientName: quote.clientName },
          select: { id: true },
        });
        const data = {
          clientName: quote.clientName,
          role: quote.role,
          company: quote.company,
          avatarUrl: quote.avatar?.src ?? null,
          rating: quote.rating,
          quote: quote.quote,
          projectId: project.id,
          featured: true,
          // The page already publishes it, so consent is a matter of record, not a guess.
          consentAt: new Date(study.publishedAt),
        };
        if (existing) await ctx.db.testimonial.update({ where: { id: existing.id }, data });
        else await ctx.db.testimonial.create({ data });
        quotes += 1;
      }
    }

    ctx.log(`import: work: ${String(projects)} case studies, ${String(quotes)} quotes`);
  },
};

/** What the snapshot puts between two paragraphs of a section. */
const PARAGRAPH_BREAK = '\n\n';

/**
 * A section arrives as an array of paragraphs, or null where a case study has none; the
 * column holds one block of prose.
 */
function paragraphs(blocks: readonly string[] | null | undefined): string | null {
  const text = (blocks ?? []).join(PARAGRAPH_BREAK).trim();
  return text.length > 0 ? text : null;
}
