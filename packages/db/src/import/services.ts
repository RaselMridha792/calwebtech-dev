import {
  SERVICES_SETTING_KEYS,
  serviceDetailViewSchema,
  servicesIndexViewSchema,
  templateServiceContent,
  type ServiceContent,
  type ServiceDetailView,
} from '@calwebtech/shared';
import { storedSeo } from './core';
import type { SnapshotImporter } from './index';

type Ctx = Parameters<SnapshotImporter['run']>[0];

/**
 * The services family: categories, the index copy, and one row per service with its page
 * copy, its FAQs and its links to technologies, industries and case studies.
 *
 * Runs after references and work, because a service links to rows those importers create
 * and a link cannot be written to a row that does not exist yet.
 *
 * The snapshots are the *rendered* views, so this reads a page backwards into the record
 * that produces it: the columns the template fills from (`deliverables`, `processSteps`,
 * `problemStatement`) come back out of the sections they render as, and the headings and
 * section copy go to `content`. Nothing here is written by hand — a section the snapshot
 * does not have takes the template's heading, which is what a service added in the admin
 * gets, so the page reads the same either way.
 */
export const servicesImporter: SnapshotImporter = {
  family: 'services',
  async run(ctx) {
    const index = ctx.read('services/index.json', servicesIndexViewSchema);
    await ctx.setSetting(SERVICES_SETTING_KEYS.index, index.content);

    const links = await linkTargets(ctx);
    let categories = 0;
    let services = 0;
    let faqs = 0;
    let order = 0;

    for (const [groupOrder, group] of index.groups.entries()) {
      const categoryId = group.slug === null ? null : await upsertCategory(ctx, group.slug, group, groupOrder);
      if (categoryId !== null) categories += 1;

      for (const card of group.services) {
        const view = ctx.read(`services/${card.slug}.json`, serviceDetailViewSchema);
        faqs += await upsertService(ctx, view, card.summary, categoryId, order++, links);
        services += 1;
      }
    }

    ctx.log(`import: services: ${String(services)} services in ${String(categories)} categories, ${String(faqs)} FAQs`);
  },
};

/** What a service links to, by the name or slug its page refers to it with. */
interface LinkTargets {
  /** Technologies by lower-cased name: a service page names its stack, it does not slug it. */
  technologies: Map<string, { id: string; slug: string }>;
  industries: Map<string, string>;
  projects: Map<string, string>;
}

async function linkTargets(ctx: Ctx): Promise<LinkTargets> {
  const [technologies, industries, projects] = await Promise.all([
    ctx.db.technology.findMany({ select: { id: true, slug: true, name: true } }),
    ctx.db.industry.findMany({ select: { id: true, slug: true } }),
    ctx.db.project.findMany({ select: { id: true, slug: true } }),
  ]);
  return {
    technologies: new Map(technologies.map((row) => [row.name.toLowerCase(), { id: row.id, slug: row.slug }])),
    industries: new Map(industries.map((row) => [row.slug, row.id])),
    projects: new Map(projects.map((row) => [row.slug, row.id])),
  };
}

async function upsertCategory(
  ctx: Ctx,
  slug: string,
  group: { name: string; description: string | null },
  order: number,
): Promise<string> {
  const category = await ctx.db.serviceCategory.upsert({
    where: { slug },
    create: { slug, name: group.name, description: group.description, order },
    update: { name: group.name, description: group.description, order },
  });
  return category.id;
}

/** Writes one service and its FAQs, and returns how many FAQs it wrote. */
async function upsertService(
  ctx: Ctx,
  view: ServiceDetailView,
  shortDescription: string,
  categoryId: string | null,
  order: number,
  links: LinkTargets,
): Promise<number> {
  const technologies = (view.technology?.items ?? []).map((item) => {
    const row = links.technologies.get(item.name.toLowerCase());
    if (!row) throw new Error(`import: services/${view.slug}.json lists "${item.name}", which is not a technology row`);
    return row;
  });
  const industries = (view.industries?.items ?? []).map((item) => {
    const id = links.industries.get(item.slug);
    if (!id) throw new Error(`import: services/${view.slug}.json lists industry "${item.slug}", which has no row`);
    return id;
  });
  const projects = (view.proof?.caseStudies ?? []).map((item) => {
    const id = links.projects.get(item.slug);
    if (!id) throw new Error(`import: services/${view.slug}.json lists case study "${item.slug}", which has no row`);
    return id;
  });

  const content = contentFrom(
    view,
    shortDescription,
    technologies.map((row) => row.slug),
  );
  // A new row connects its links; an existing one replaces them, so a service that no longer
  // lists a technology stops being linked to it.
  const ids = {
    technologies: technologies.map((row) => ({ id: row.id })),
    industries: industries.map((id) => ({ id })),
    projects: projects.map((id) => ({ id })),
  };
  const connected = {
    technologies: { connect: ids.technologies },
    industries: { connect: ids.industries },
    projects: { connect: ids.projects },
  };
  const relinked = {
    technologies: { set: ids.technologies },
    industries: { set: ids.industries },
    projects: { set: ids.projects },
  };

  const service = await ctx.db.service.upsert({
    where: { slug: view.slug },
    create: {
      slug: view.slug,
      title: view.title,
      shortDescription,
      answerBlock: view.answerBlock,
      heroMediaUrl: view.hero.backdrop?.src ?? null,
      problemStatement: view.problem?.intro ?? null,
      deliverables: ctx.json(view.included?.items ?? []),
      processSteps: ctx.json(view.process?.steps ?? []),
      // A band with figures is a price; one without is this column, shown as the words it has.
      startingPriceBand: view.price !== null && view.price.amount === null ? view.price.label : null,
      content: ctx.json(content),
      seo: ctx.json(storedSeo(view.seo)),
      order,
      status: 'PUBLISHED',
      // The snapshot carries one date, the day the page last changed. The record was
      // published by then, which is the most the snapshot can say.
      publishedAt: new Date(view.updatedAt),
      categoryId,
      ...connected,
    },
    // Copy someone has rewritten in the admin is theirs. What the snapshot still owns is the
    // record's identity, where it sits on the index, and what it is linked to.
    update: { title: view.title, shortDescription, order, categoryId, ...relinked },
  });

  return upsertFaqs(ctx, service.id, view.faq?.items ?? []);
}

/**
 * A service's FAQs, matched by their question so a second run corrects an answer rather than
 * asking the same thing twice. One a person has added in the admin is left alone.
 */
async function upsertFaqs(
  ctx: Ctx,
  serviceId: string,
  items: readonly { question: string; answer: string }[],
): Promise<number> {
  for (const [order, item] of items.entries()) {
    const existing = await ctx.db.faq.findFirst({
      where: { serviceId, question: item.question },
      select: { id: true },
    });
    if (existing) await ctx.db.faq.update({ where: { id: existing.id }, data: { answer: item.answer, order } });
    else await ctx.db.faq.create({ data: { serviceId, question: item.question, answer: item.answer, order } });
  }
  return items.length;
}

/**
 * The page's copy, read back out of the page. Sections the snapshot does not have keep the
 * template's heading: they render nothing either way, and a heading invented here would be
 * copy nobody wrote.
 */
function contentFrom(view: ServiceDetailView, shortDescription: string, technologies: string[]): ServiceContent {
  const template = templateServiceContent({ shortDescription });
  return {
    hero: {
      outcome: view.hero.outcome,
      primaryCtaLabel: view.hero.primaryCta.label,
      secondaryCta: view.hero.secondaryCta,
    },
    price: view.price?.amount ?? null,
    problem: view.problem ? { heading: view.problem.heading, situations: view.problem.situations } : null,
    included: view.included ? copyOf(view.included) : template.included,
    process: view.process
      ? { heading: view.process.heading, intro: view.process.intro, backdrop: view.process.backdrop }
      : template.process,
    technology: view.technology ? copyOf(view.technology) : template.technology,
    proof: view.proof
      ? { heading: view.proof.heading, intro: view.proof.intro, linkLabel: view.proof.link.label }
      : template.proof,
    comparison: view.comparison,
    pricing: view.pricing,
    industries: view.industries ? copyOf(view.industries) : template.industries,
    testimonial: view.testimonial ? { heading: view.testimonial.heading } : template.testimonial,
    faq: view.faq ? copyOf(view.faq) : template.faq,
    enquiry: {
      heading: view.enquiry.heading,
      intro: view.enquiry.intro,
      submitLabel: view.enquiry.submitLabel,
      footnote: view.enquiry.footnote,
    },
    formSuccess: view.enquiry.success,
    related: view.related ? copyOf(view.related) : template.related,
    order: {
      technologies,
      industries: (view.industries?.items ?? []).map((item) => item.slug),
      caseStudies: (view.proof?.caseStudies ?? []).map((item) => item.slug),
    },
  };
}

/** A section's heading and intro, without the records it lists. */
function copyOf(section: { heading: string; intro: string | null }): { heading: string; intro: string | null } {
  return { heading: section.heading, intro: section.intro };
}
