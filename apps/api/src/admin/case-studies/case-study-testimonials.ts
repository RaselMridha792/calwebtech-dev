import type { PrismaClient, Testimonial } from '@calwebtech/db';
import type { AdminTestimonial, CaseStudyTestimonialInput } from '@calwebtech/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { writeAudit } from '../../auth/audit-writer';
import { PrismaService } from '../../prisma/prisma.service';
import { WORK_TESTIMONIAL_ORDER, workQuoteQuery, workVideoTestimonialQuery } from '../../work/work.mapper';
import type { Actor } from '../leads/admin-leads.service';

/**
 * A case study's testimonials in the dashboard (docs/15-next-tasks.md, task 4;
 * docs/08-decisions.md, 70): its quote and its video, added, changed and removed one at a
 * time, each change written with its audit entry in one transaction.
 *
 * `consentAt` is the permission to publish. A testimonial without it is kept and shown
 * nowhere, which is how the public queries read it (`CONSENTED`). Removing one keeps the
 * row, its words and its consent date, and hides it everywhere.
 */

type Db = Pick<PrismaClient, 'testimonial'>;

/** The columns the editor writes, from its input. A consent date is stored as that day, UTC. */
function toColumns(input: CaseStudyTestimonialInput) {
  return {
    quote: input.quote,
    clientName: input.clientName,
    role: input.role,
    company: input.company,
    avatarUrl: input.avatar,
    rating: input.rating,
    videoUrl: input.videoUrl,
    featured: input.featured,
    consentAt: input.consentAt ? new Date(`${input.consentAt}T00:00:00.000Z`) : null,
  };
}

type Columns = ReturnType<typeof toColumns>;
const COLUMNS = [
  'quote',
  'clientName',
  'role',
  'company',
  'avatarUrl',
  'rating',
  'videoUrl',
  'featured',
  'consentAt',
] as const satisfies readonly (keyof Columns)[];

/** A column's value as the audit log records it: a date as its day. */
function recorded(value: Columns[keyof Columns]): unknown {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

/** The columns an edit changed, before and after, for the audit entry. */
function changes(before: Testimonial, after: Columns): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changed = COLUMNS.filter((key) => recorded(before[key]) !== recorded(after[key]));
  return {
    before: Object.fromEntries(changed.map((key) => [key, recorded(before[key])])),
    after: Object.fromEntries(changed.map((key) => [key, recorded(after[key])])),
  };
}

/** Everything a removed testimonial said, so the log keeps it. */
function whole(row: Testimonial): Record<string, unknown> {
  return Object.fromEntries(COLUMNS.map((key) => [key, recorded(row[key])]));
}

/**
 * The case study's testimonials in the order its page picks from, each saying where the
 * page shows it: the first consented one is the quote, and the first consented one with a
 * video is the video. The same two queries the page runs decide it.
 */
export async function listTestimonials(db: Db, projectId: string): Promise<AdminTestimonial[]> {
  const [rows, quote, video] = await Promise.all([
    db.testimonial.findMany({ where: { projectId, deletedAt: null }, orderBy: WORK_TESTIMONIAL_ORDER }),
    db.testimonial.findFirst({ ...workQuoteQuery(projectId), select: { id: true } }),
    db.testimonial.findFirst({ ...workVideoTestimonialQuery(projectId), select: { id: true } }),
  ]);
  return rows.map((row) => ({
    id: row.id,
    quote: row.quote,
    clientName: row.clientName,
    role: row.role,
    company: row.company,
    avatar: row.avatarUrl,
    rating: row.rating,
    videoUrl: row.videoUrl,
    featured: row.featured,
    consentAt: row.consentAt ? row.consentAt.toISOString().slice(0, 10) : null,
    shownAs: [...(quote?.id === row.id ? (['quote'] as const) : []), ...(video?.id === row.id ? (['video'] as const) : [])],
    updatedAt: row.updatedAt.toISOString(),
  }));
}

@Injectable()
export class CaseStudyTestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string): Promise<AdminTestimonial[]> {
    return listTestimonials(this.prisma.client, projectId);
  }

  async create(projectId: string, input: CaseStudyTestimonialInput, actor: Actor): Promise<AdminTestimonial[]> {
    await this.requireProject(projectId);
    await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.testimonial.create({ data: { ...toColumns(input), projectId } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'testimonial.created',
        entityType: 'Testimonial',
        entityId: row.id,
        after: { projectId, ...whole(row) },
        ip: actor.ip,
      });
    });
    return this.list(projectId);
  }

  async update(projectId: string, id: string, input: CaseStudyTestimonialInput, actor: Actor): Promise<AdminTestimonial[]> {
    const before = await this.requireTestimonial(projectId, id);
    const columns = toColumns(input);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.testimonial.update({ where: { id }, data: columns });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'testimonial.updated',
        entityType: 'Testimonial',
        entityId: id,
        ...changes(before, columns),
        ip: actor.ip,
      });
    });
    return this.list(projectId);
  }

  /** Kept, with its consent date, and shown nowhere. */
  async remove(projectId: string, id: string, actor: Actor): Promise<AdminTestimonial[]> {
    const before = await this.requireTestimonial(projectId, id);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.testimonial.update({ where: { id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, {
        userId: actor.id,
        action: 'testimonial.deleted',
        entityType: 'Testimonial',
        entityId: id,
        before: { projectId, ...whole(before) },
        ip: actor.ip,
      });
    });
    return this.list(projectId);
  }

  private async requireProject(projectId: string): Promise<void> {
    const project = await this.prisma.client.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
    if (!project) throw new NotFoundException();
  }

  private async requireTestimonial(projectId: string, id: string): Promise<Testimonial> {
    await this.requireProject(projectId);
    const row = await this.prisma.client.testimonial.findFirst({ where: { id, projectId, deletedAt: null } });
    if (!row) throw new NotFoundException();
    return row;
  }
}

