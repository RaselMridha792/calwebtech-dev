import {
  companyTechnologyViewSchema,
  industriesIndexViewSchema,
  industryDetailViewSchema,
  serviceDetailViewSchema,
  servicesIndexViewSchema,
  slugify,
  technologyCategoryFromLabel,
  type TechnologyCategory,
} from '@calwebtech/shared';
import { storedSeo } from './core';
import type { SnapshotImporter } from './index';

type Ctx = Parameters<SnapshotImporter['run']>[0];

/**
 * The records other families point at: technologies and industries.
 *
 * Imported here because a service page shows both, and a service cannot be moved into the
 * database while the rows it links to exist only in a snapshot. Only the columns those
 * links need are written — a technology's name and category, an industry's name and card
 * line — because the technology and industries pages still render from their own snapshots
 * and will bring the rest of their own fields when their turn comes.
 *
 * Every row is upserted by slug and never deleted, so running this again after someone has
 * edited one in the admin changes only what the snapshot still owns.
 */
export const referencesImporter: SnapshotImporter = {
  family: 'references',
  async run(ctx) {
    await importTechnologies(ctx);
    await importIndustries(ctx);
  },
};

/**
 * A technology's category, for a technology no service page lists. `Technology.category` is
 * the vocabulary a service page labels its stack with (TECHNOLOGY_CATEGORY_LABELS), and the
 * technology page's own groups are a different set: it separates data stores from the rest
 * of the back end and keeps mobile and AI together, because that is how that page reads.
 *
 * `data` maps to `backend` on the evidence of the service pages themselves, which label
 * PostgreSQL, Redis and BullMQ queues "Back end". `mobile-and-ai` is deliberately absent:
 * its members are labelled individually by the service pages — React Native front end,
 * the model APIs and vector search back end — so no single category is true of the group.
 * A technology in an unmapped group that no service page labels stops the import rather
 * than getting a category nobody chose.
 */
const COMPANY_GROUP_CATEGORY: Partial<Record<string, TechnologyCategory>> = {
  frontend: 'frontend',
  backend: 'backend',
  data: 'backend',
  cms: 'cms',
  infrastructure: 'infrastructure',
};

interface ApprovedTechnology {
  /** The spelling the service pages show, which is what the row has to render as. */
  name: string;
  category: TechnologyCategory;
}

/**
 * How the approved service pages name and label each technology, keyed by the lower-cased
 * name so `headless CMS` on a service page and `Headless CMS` on the technology page are
 * one record.
 *
 * The service pages are the authority for both, because they are the family moving into the
 * database: the row has to render the words those pages already show. Where the two
 * snapshots spell a name differently the service spelling wins, so no approved service page
 * changes; the technology page keeps its own spelling until it moves, and either is
 * editable in the admin afterwards.
 */
function approvedTechnologies(ctx: Ctx): Map<string, ApprovedTechnology> {
  const index = ctx.read('services/index.json', servicesIndexViewSchema);
  const approved = new Map<string, ApprovedTechnology>();
  for (const group of index.groups) {
    for (const card of group.services) {
      const view = ctx.read(`services/${card.slug}.json`, serviceDetailViewSchema);
      for (const item of view.technology?.items ?? []) {
        const key = item.name.toLowerCase();
        if (approved.has(key)) continue;
        const category = item.category === null ? null : technologyCategoryFromLabel(item.category);
        if (category === null) {
          throw new Error(
            `import: services/${card.slug}.json labels "${item.name}" as ${String(item.category)}, which is not a technology category`,
          );
        }
        approved.set(key, { name: item.name, category });
      }
    }
  }
  return approved;
}

/**
 * One row per technology: the name, logo and note from `company/technology.json`, the
 * category from whichever service page lists it. A technology a service page shows and that
 * page does not have — a platform or a design tool named only where it is used — is created
 * from the service page alone, with a slug made from its name.
 */
async function importTechnologies(ctx: Ctx): Promise<void> {
  const approved = approvedTechnologies(ctx);
  const view = ctx.read('company/technology.json', companyTechnologyViewSchema);
  const written = new Set<string>();
  let order = 0;
  let extras = 0;

  for (const group of view.groups) {
    for (const technology of group.technologies) {
      const key = technology.name.toLowerCase();
      const onServicePage = approved.get(key);
      const category = onServicePage?.category ?? COMPANY_GROUP_CATEGORY[group.key];
      if (category === undefined) {
        throw new Error(
          `import: no category for "${technology.name}": no service page lists it and its group ${group.key} maps to none`,
        );
      }
      const name = onServicePage?.name ?? technology.name;
      await ctx.db.technology.upsert({
        where: { slug: technology.slug },
        create: {
          slug: technology.slug,
          name,
          category,
          logoUrl: technology.logo?.src ?? null,
          proficiencyNote: technology.proficiencyNote,
          order: order++,
        },
        // A note someone has rewritten in the admin is theirs; the name and the category it
        // is labelled with are still the snapshot's until the technology page moves across.
        update: { name, category },
      });
      written.add(key);
    }
  }

  for (const [key, technology] of approved) {
    if (written.has(key)) continue;
    const slug = slugify(technology.name);
    await ctx.db.technology.upsert({
      where: { slug },
      create: { slug, name: technology.name, category: technology.category, order: order++ },
      update: { name: technology.name, category: technology.category },
    });
    extras += 1;
  }

  ctx.log(`import: references: ${String(written.size + extras)} technologies (${String(extras)} from service pages)`);
}

/**
 * One row per industry, published, carrying the card line a service page shows. The rest of
 * an industry page — its pain points, its own case studies, its FAQ — stays in the snapshot
 * until the industries family moves, and `content` is deliberately left null so the mapper
 * uses the template rather than half a record.
 */
async function importIndustries(ctx: Ctx): Promise<void> {
  const index = ctx.read('industries/index.json', industriesIndexViewSchema);
  let order = 0;

  for (const card of index.industries) {
    const detail = ctx.read(`industries/${card.slug}.json`, industryDetailViewSchema);
    await ctx.db.industry.upsert({
      where: { slug: detail.slug },
      create: {
        slug: detail.slug,
        name: detail.name,
        answerBlock: detail.answerBlock,
        heroCopy: detail.hero.line ?? detail.hero.intro,
        seo: ctx.json(storedSeo(detail.seo)),
        status: 'PUBLISHED',
        order: order++,
      },
      update: { name: detail.name, heroCopy: detail.hero.line ?? detail.hero.intro },
    });
  }
  ctx.log(`import: references: ${String(index.industries.length)} industries`);
}
