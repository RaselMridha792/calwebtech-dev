import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

/**
 * Shared ground for the snapshot importers (index.ts). A snapshot is exactly one API view
 * (apps/web/static-content/<family>/<file>.json); an importer writes the rows, settings and
 * `content` JSON that make the family's service return that view again.
 *
 * Rules every importer follows:
 * - Rows are found by their natural key (slug, or the fields in the helpers below) and
 *   updated in place, never duplicated, so a re-run converges.
 * - Proof records (Project, Testimonial, TeamMember, Technology, Award, Partner, Statistic,
 *   ReviewSource, ClientLogo, PricingTier, ProcessStep) may be written by more than one
 *   family, with the same values. `proof.ts` runs first and writes what the homepage and
 *   the landing page show; a family that needs more columns on the same row updates it.
 * - Nothing here deletes what a person may have created since: a delete is scoped to the
 *   rows the importer itself owns (for example FAQs attached to one service).
 */

export interface Parser<T> {
  parse(input: unknown): T;
}

export interface ImportContext {
  readonly db: PrismaClient;
  /** The snapshot directory (apps/web/static-content, or its copy in the API image). */
  readonly dir: string;
  log(line: string): void;
  /** A snapshot file, parsed and validated with its view schema. */
  read<T>(relPath: string, schema: Parser<T>): T;
  /** A snapshot file as plain JSON, for the odd case a schema does not cover. */
  readRaw(relPath: string): unknown;
  /** Every `<name>.json` under a subdirectory, keyed by file name without the extension. */
  readDir<T>(relDir: string, schema: Parser<T>, except?: readonly string[]): Map<string, T>;
  /** Anything JSON-serialisable as a Prisma JSON input, with `undefined` stripped. */
  json(value: unknown): Prisma.InputJsonValue;
  setSetting(key: string, value: unknown): Promise<void>;
  /** The id of a row found by slug; throws when it does not exist yet. */
  slugId(model: SlugModel, slug: string): Promise<string>;
  /** The id of a row found by slug, or null. */
  findSlugId(model: SlugModel, slug: string): Promise<string | null>;
  upsertTestimonial(data: TestimonialData): Promise<{ id: string }>;
  upsertAward(data: AwardData): Promise<{ id: string }>;
  upsertPartner(data: PartnerData): Promise<{ id: string }>;
  upsertStatistic(data: StatisticData): Promise<{ id: string }>;
  upsertClientLogo(data: ClientLogoData): Promise<{ id: string }>;
  upsertPricingTier(data: PricingTierData): Promise<{ id: string }>;
  upsertProcessStep(data: ProcessStepData): Promise<{ id: string }>;
  upsertReviewSource(data: ReviewSourceData): Promise<{ id: string }>;
  /** Replaces the FAQs matching `where` (an importer's own attachment) with `faqs`, in order. */
  replaceFaqs(where: Prisma.FaqWhereInput, faqs: readonly FaqData[]): Promise<void>;
}

export type SlugModel =
  | 'service'
  | 'serviceCategory'
  | 'industry'
  | 'project'
  | 'technology'
  | 'teamMember'
  | 'location'
  | 'post'
  | 'postCategory'
  | 'tag'
  | 'glossaryTerm'
  | 'guide'
  | 'landingPage';

type Data<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type TestimonialData = Data<Prisma.TestimonialUncheckedCreateInput>;
export type AwardData = Data<Prisma.AwardUncheckedCreateInput>;
export type PartnerData = Data<Prisma.PartnerUncheckedCreateInput>;
export type StatisticData = Data<Prisma.StatisticUncheckedCreateInput>;
export type ClientLogoData = Data<Prisma.ClientLogoUncheckedCreateInput>;
export type PricingTierData = Data<Prisma.PricingTierUncheckedCreateInput>;
export type ProcessStepData = Data<Prisma.ProcessStepUncheckedCreateInput>;
export type ReviewSourceData = Data<Prisma.ReviewSourceUncheckedCreateInput>;
export type FaqData = Omit<Prisma.FaqUncheckedCreateInput, 'id' | 'order'>;

/** Published dates for rows whose snapshot shows none. Fixed, so a re-run changes nothing. */
export const IMPORTED_AT = new Date('2026-09-15T00:00:00.000Z');

export function createImportContext(db: PrismaClient, dir: string, log: (line: string) => void): ImportContext {
  const file = (relPath: string): string => {
    const full = path.join(dir, relPath);
    if (!existsSync(full)) throw new Error(`import: snapshot ${relPath} is missing under ${dir}`);
    return full;
  };
  const readRaw = (relPath: string): unknown => JSON.parse(readFileSync(file(relPath), 'utf8'));
  const read = <T>(relPath: string, schema: Parser<T>): T => {
    try {
      return schema.parse(readRaw(relPath));
    } catch (error) {
      throw new Error(`import: snapshot ${relPath} does not match its view schema: ${String(error)}`);
    }
  };
  const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

  async function findSlugId(model: SlugModel, slug: string): Promise<string | null> {
    const where = { slug };
    const select = { id: true } as const;
    const row = await slugQuery(db, model, where, select);
    return row?.id ?? null;
  }

  return {
    db,
    dir,
    log,
    read,
    readRaw,
    readDir(relDir, schema, except = []) {
      const full = file(relDir);
      const names = readdirJson(full).filter((name) => !except.includes(name));
      return new Map(names.map((name) => [name, read(path.join(relDir, `${name}.json`), schema)]));
    },
    json,
    async setSetting(key, value) {
      const stored = json(value);
      await db.setting.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
    },
    findSlugId,
    async slugId(model, slug) {
      const id = await findSlugId(model, slug);
      if (!id) throw new Error(`import: no ${model} with slug "${slug}" yet; the importer that owns it must run first`);
      return id;
    },
    async upsertTestimonial(data) {
      const found = await db.testimonial.findFirst({ where: { clientName: data.clientName, quote: data.quote }, select: { id: true } });
      return found
        ? db.testimonial.update({ where: { id: found.id }, data, select: { id: true } })
        : db.testimonial.create({ data, select: { id: true } });
    },
    async upsertAward(data) {
      const found = await db.award.findFirst({ where: { name: data.name, year: data.year }, select: { id: true } });
      return found ? db.award.update({ where: { id: found.id }, data, select: { id: true } }) : db.award.create({ data, select: { id: true } });
    },
    async upsertPartner(data) {
      const found = await db.partner.findFirst({ where: { name: data.name }, select: { id: true } });
      return found ? db.partner.update({ where: { id: found.id }, data, select: { id: true } }) : db.partner.create({ data, select: { id: true } });
    },
    async upsertStatistic(data) {
      const found = await db.statistic.findFirst({ where: { label: data.label }, select: { id: true } });
      return found
        ? db.statistic.update({ where: { id: found.id }, data, select: { id: true } })
        : db.statistic.create({ data, select: { id: true } });
    },
    async upsertClientLogo(data) {
      const found = await db.clientLogo.findFirst({ where: { name: data.name }, select: { id: true } });
      return found
        ? db.clientLogo.update({ where: { id: found.id }, data, select: { id: true } })
        : db.clientLogo.create({ data, select: { id: true } });
    },
    async upsertPricingTier(data) {
      const found = await db.pricingTier.findFirst({ where: { name: data.name }, select: { id: true } });
      return found
        ? db.pricingTier.update({ where: { id: found.id }, data, select: { id: true } })
        : db.pricingTier.create({ data, select: { id: true } });
    },
    async upsertProcessStep(data) {
      const found = await db.processStep.findFirst({ where: { title: data.title }, select: { id: true } });
      return found
        ? db.processStep.update({ where: { id: found.id }, data, select: { id: true } })
        : db.processStep.create({ data, select: { id: true } });
    },
    async upsertReviewSource(data) {
      return db.reviewSource.upsert({ where: { platform: data.platform }, create: data, update: data, select: { id: true } });
    },
    async replaceFaqs(where, faqs) {
      await db.faq.deleteMany({ where });
      if (faqs.length > 0) await db.faq.createMany({ data: faqs.map((faq, order) => ({ ...faq, order })) });
    },
  };
}

/** Sorted, so import order is the same on every machine. */
function readdirJson(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

/** One place that knows every slug-keyed delegate, so callers stay typed without a cast. */
function slugQuery(
  db: PrismaClient,
  model: SlugModel,
  where: { slug: string },
  select: { id: true },
): Promise<{ id: string } | null> {
  switch (model) {
    case 'service':
      return db.service.findUnique({ where, select });
    case 'serviceCategory':
      return db.serviceCategory.findUnique({ where, select });
    case 'industry':
      return db.industry.findUnique({ where, select });
    case 'project':
      return db.project.findUnique({ where, select });
    case 'technology':
      return db.technology.findUnique({ where, select });
    case 'teamMember':
      return db.teamMember.findUnique({ where, select });
    case 'location':
      return db.location.findUnique({ where, select });
    case 'post':
      return db.post.findUnique({ where, select });
    case 'postCategory':
      return db.postCategory.findUnique({ where, select });
    case 'tag':
      return db.tag.findUnique({ where, select });
    case 'glossaryTerm':
      return db.glossaryTerm.findUnique({ where, select });
    case 'guide':
      return db.guide.findUnique({ where, select });
    case 'landingPage':
      return db.landingPage.findUnique({ where, select });
  }
}
