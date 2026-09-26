import {
  WORK_CLIENT_TOKEN,
  WORK_COPY_SETTING_KEY,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workCopySchema,
  workIndexViewSchema,
  workProjectContentSchema,
  type WorkCaseStudyCard,
  type WorkCaseStudyView,
} from '@calwebtech/shared';
import type { SnapshotImporter } from './index';

type Ctx = Parameters<SnapshotImporter['run']>[0];

/**
 * The case studies family: the `work.copy` setting and what each project's page needs beyond
 * the columns `work` wrote (docs/14-remaining-work.md, task 4; docs/08-decisions.md, 58).
 *
 * `work` created the projects before any page read them from the database, so it left out
 * the platforms, the segment, the gallery's alt text, the order of the services and the
 * copy around every case study. This brings them, so `/work/` and each case study can be
 * read from the database first and edited in the admin. Its own family, run after
 * `services` (which links a project's services) so a live database receives it on the next
 * deploy.
 */
export const caseStudiesImporter: SnapshotImporter = {
  family: 'case-studies',
  async run(ctx) {
    const index = ctx.read('work/index.json', workIndexViewSchema);
    const studies = index.caseStudies.map((card) => ({
      card,
      study: ctx.read(`work/${card.slug}.json`, workCaseStudyViewSchema),
    }));
    const [first] = studies;
    if (!first) throw new Error('import: work/index.json lists no case study to take the copy from');

    const beforeAndAfter = ctx.read('work/before-and-after.json', workBeforeAndAfterViewSchema);
    const [comparison] = beforeAndAfter.comparisons;
    await ctx.setSetting(
      WORK_COPY_SETTING_KEY,
      workCopySchema.parse({
        index: index.copy,
        caseStudy: {
          eyebrow: first.study.eyebrow,
          headlineLabel: first.study.headline.label,
          headings: templates(first.study.headings, first.study.clientName),
          labels: first.study.labels,
          measurement: first.study.measurement,
        },
        beforeAndAfter: {
          ...beforeAndAfter.copy,
          comparisonHeading: comparison
            ? template(comparison.heading, comparison.clientName)
            : `What changed when ${WORK_CLIENT_TOKEN} was redesigned?`,
        },
      }),
    );

    // `/work/` lists the newest change first. Every approved case study carries the same
    // date, so each is stamped a second apart in the index's order, newest first.
    for (const [position, { card, study }] of studies.entries()) {
      await completeProject(ctx, card, study, studies.length - position);
    }
    ctx.log(`import: case-studies: the work copy and ${String(studies.length)} case studies`);
  },
};

async function completeProject(ctx: Ctx, card: WorkCaseStudyCard, study: WorkCaseStudyView, rank: number) {
  const project = await ctx.db.project.findUnique({ where: { slug: study.slug }, select: { id: true, content: true } });
  if (!project) throw new Error(`import: work/${study.slug}.json has no project row; the work family runs first`);
  // A project with `content` was completed before, by this family or in the admin since; a
  // forced run leaves what somebody may have edited alone.
  if (project.content !== null) return;

  const platforms = await Promise.all(
    study.atAGlance.platforms.map(async (platform) => {
      const row = await ctx.db.technology.findUnique({ where: { slug: platform.slug }, select: { id: true } });
      if (!row) throw new Error(`import: work/${study.slug}.json names platform "${platform.slug}", which has no row`);
      return { id: row.id };
    }),
  );
  const services = study.atAGlance.services.map((service) => service.slug);
  const published = new Date(study.publishedAt);

  await ctx.db.project.update({
    where: { id: project.id },
    data: {
      segment: segmentOf(card, study),
      gallery: ctx.json(study.gallery),
      technologies: { set: platforms },
      content: ctx.json(workProjectContentSchema.parse({ order: { services } })),
      createdAt: published,
      updatedAt: new Date(published.getTime() + rank * 1000),
    },
  });
}

/**
 * The segment the card's tags carry: every tag that is not the location or a platform,
 * joined as the column holds it ("B2B, Distribution").
 */
function segmentOf(card: WorkCaseStudyCard, study: WorkCaseStudyView): string | null {
  const platforms = new Set(study.atAGlance.platforms.map((platform) => platform.name));
  const segment = card.tags.filter((tag) => tag !== study.atAGlance.location && !platforms.has(tag));
  return segment.length > 0 ? segment.join(', ') : null;
}

/** A heading with the client's name put back as the token the setting stores. */
function template(heading: string, clientName: string): string {
  return heading.replaceAll(clientName, WORK_CLIENT_TOKEN);
}

function templates<Headings extends Record<string, string>>(headings: Headings, clientName: string): Headings {
  return Object.fromEntries(
    Object.entries(headings).map(([key, heading]) => [key, template(heading, clientName)]),
  ) as Headings;
}
