import { workBeforeAndAfterViewSchema } from '@calwebtech/shared';
import type { SnapshotImporter } from './index';

/**
 * `/before-and-after/`'s comparisons (docs/15-next-tasks.md, task 4; docs/08-decisions.md, 70).
 *
 * Until now the page rendered its snapshot, because its approved comparison describes its
 * pictures in words no row held. Each comparison in `work/before-and-after.json` becomes a
 * `Comparison` row, published, in the page's order, with the one the homepage shows marked.
 * A comparison that links a case study links the project the `work` family wrote.
 *
 * Only into a table that has never held a comparison, removed ones included: once somebody
 * has added, edited or removed one in the dashboard, the list is theirs, even when the import
 * is forced. The page's copy around the comparisons is the `work.copy` setting, which the
 * `case-studies` family writes. Neither changes what the site shows until
 * `CONTENT_DATABASE_FIRST` names `before-and-after`.
 */
export const beforeAndAfterImporter: SnapshotImporter = {
  family: 'before-and-after',
  async run(ctx) {
    if ((await ctx.db.comparison.count()) > 0) {
      ctx.log('import: before-and-after: comparisons already stored, left alone');
      return;
    }
    const view = ctx.read('work/before-and-after.json', workBeforeAndAfterViewSchema);

    for (const [order, comparison] of view.comparisons.entries()) {
      const project = comparison.slug
        ? await ctx.db.project.findUnique({ where: { slug: comparison.slug }, select: { id: true } })
        : null;
      if (comparison.slug && !project) {
        throw new Error(`import: work/before-and-after.json links "${comparison.slug}", which has no project row`);
      }
      await ctx.db.comparison.create({
        data: {
          clientName: comparison.clientName,
          heading: comparison.heading,
          summary: comparison.summary,
          before: ctx.json(comparison.before),
          after: ctx.json(comparison.after),
          metrics: ctx.json(comparison.metrics),
          order,
          onHomepage: comparison.onHomepage,
          status: 'PUBLISHED',
          projectId: project?.id ?? null,
        },
      });
    }
    ctx.log(`import: before-and-after: ${String(view.comparisons.length)} comparisons`);
  },
};
