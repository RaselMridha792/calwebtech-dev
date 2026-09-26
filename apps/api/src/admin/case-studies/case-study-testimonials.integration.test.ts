import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { WORK_PLACEHOLDER_COPY } from '@calwebtech/db/seed';
import {
  WORK_COPY_SETTING_KEY,
  caseStudyInputSchema,
  caseStudyTestimonialInputSchema,
  workCopySchema,
  type CaseStudyTestimonialInputDraft,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkService } from '../../work/work.service';
import { AdminCaseStudiesService } from './admin-case-studies.service';
import { CaseStudyTestimonialsService } from './case-study-testimonials';

/**
 * A case study's quote and video from the dashboard to its page (decision 70): kept but not
 * shown without a consent date, shown once it has one, the video offered from a second
 * testimonial, changed, removed but kept, and an audit entry for every step. The page is
 * built by the API's own service, so what it shows is what the site renders.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const run = Date.now().toString(36);
const databaseName = `calwebtech_admin_testimonials_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const caseStudies = new AdminCaseStudiesService(prisma, new AuditService(prisma));
const testimonials = new CaseStudyTestimonialsService(prisma);
const actor = { id: '', ip: '203.0.113.8' };

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

const SLUG = 'test-harbour-co';
const ANSWER =
  'Test Harbour Co needed berths booked online instead of by phone. We built a booking site on Next.js. Online bookings tripled in a season.';

/** The page as the site would render it now; a new service each time, so no cached view. */
const page = async () => {
  const view = await new WorkService(prisma).findCaseStudy(SLUG);
  if (!view) throw new Error('the case study has no page');
  return view;
};

function quote(overrides: Partial<CaseStudyTestimonialInputDraft> = {}) {
  return caseStudyTestimonialInputSchema.parse({
    quote: 'Test quote: our berths book themselves now.',
    clientName: 'Test Person',
    role: 'Test Harbour Master',
    company: 'Test Harbour Co',
    ...overrides,
  });
}

let projectId = '';

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  const user = await db.user.create({
    data: { email: 'editor@calwebtech.test', name: 'An Editor', role: 'EDITOR', passwordHash: 'x' },
    select: { id: true },
  });
  actor.id = user.id;
  await db.setting.create({ data: { key: WORK_COPY_SETTING_KEY, value: workCopySchema.parse(WORK_PLACEHOLDER_COPY) } });
  const study = await caseStudies.create(
    caseStudyInputSchema.parse({
      title: 'Test berths booked online for Test Harbour Co',
      slug: SLUG,
      clientName: 'Test Harbour Co',
      summary: 'Test berth booking moved from the phone to the website.',
      answerBlock: ANSWER,
      cover: { src: '/media/test-cover.jpg', alt: 'Test harbour cover' },
      metrics: [
        { value: '3x', label: 'Test online bookings' },
        { value: '-60%', label: 'Test phone calls' },
        { value: '1.4s', label: 'Test mobile load' },
      ],
    }),
    actor,
  );
  projectId = study.id;
  await caseStudies.publish(projectId, actor);
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('a case study’s testimonials edited in the dashboard', () => {
  let quoteId = '';
  let videoId = '';

  it('keeps a testimonial without a consent date, and the page does not show it', async () => {
    const [added] = await testimonials.create(projectId, quote(), actor);
    quoteId = added?.id ?? '';
    expect(added).toMatchObject({ clientName: 'Test Person', consentAt: null, shownAs: [], rating: 5 });
    expect((await page()).quote).toBeNull();
  });

  it('shows it as the quote once the client’s consent date is entered', async () => {
    const [changed] = await testimonials.update(projectId, quoteId, quote({ consentAt: '2026-09-20', rating: 4 }), actor);
    expect(changed).toMatchObject({ consentAt: '2026-09-20', shownAs: ['quote'] });
    expect((await page()).quote).toMatchObject({
      id: quoteId,
      quote: 'Test quote: our berths book themselves now.',
      clientName: 'Test Person',
      role: 'Test Harbour Master',
      company: 'Test Harbour Co',
      rating: 4,
    });
    expect((await page()).videoTestimonial).toBeNull();
  });

  it('offers a consented testimonial with a video as the video, over the cover, and the detail says which is which', async () => {
    const list = await testimonials.create(
      projectId,
      quote({ clientName: 'Test Video Person', videoUrl: '/media/test-video.mp4', consentAt: '2026-09-21' }),
      actor,
    );
    videoId = list.find((item) => item.clientName === 'Test Video Person')?.id ?? '';
    expect((await page()).videoTestimonial).toEqual({
      clientName: 'Test Video Person',
      role: 'Test Harbour Master',
      company: 'Test Harbour Co',
      poster: { src: '/media/test-cover.jpg', alt: 'Test harbour cover' },
      videoUrl: '/media/test-video.mp4',
    });

    // Featured goes first, so the first testimonial stays the quote.
    await testimonials.update(projectId, quoteId, quote({ consentAt: '2026-09-20', rating: 4, featured: true }), actor);
    const detail = await caseStudies.detail(projectId);
    expect(detail?.testimonials.map((item) => [item.clientName, item.shownAs])).toEqual([
      ['Test Person', ['quote']],
      ['Test Video Person', ['video']],
    ]);
    expect((await page()).quote?.id).toBe(quoteId);
  });

  it('takes a testimonial off the page when its consent date is cleared', async () => {
    await testimonials.update(projectId, videoId, quote({ clientName: 'Test Video Person', videoUrl: '/media/test-video.mp4' }), actor);
    expect((await page()).videoTestimonial).toBeNull();
    expect((await page()).quote?.id).toBe(quoteId);
  });

  it('is kept when removed, and shown nowhere', async () => {
    await testimonials.remove(projectId, quoteId, actor);
    expect((await db.testimonial.findUniqueOrThrow({ where: { id: quoteId } })).deletedAt).not.toBeNull();
    expect((await page()).quote).toBeNull();
    expect((await caseStudies.detail(projectId))?.testimonials.map((item) => item.id)).toEqual([videoId]);
    await expect(testimonials.update(projectId, quoteId, quote(), actor)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a testimonial for a case study that does not exist', async () => {
    await expect(testimonials.create('test-missing', quote(), actor)).rejects.toMatchObject({ status: 404 });
  });

  it('writes every step to the audit log, with what changed and what a removal took away', async () => {
    const entries = await db.auditLog.findMany({ where: { entityId: quoteId }, orderBy: { createdAt: 'asc' } });
    expect(entries.map((entry) => entry.action)).toEqual([
      'testimonial.created',
      'testimonial.updated',
      'testimonial.updated',
      'testimonial.deleted',
    ]);
    expect(entries.every((entry) => entry.userId === actor.id && entry.entityType === 'Testimonial')).toBe(true);
    expect(entries[1]?.before).toEqual({ rating: 5, consentAt: null });
    expect(entries[1]?.after).toEqual({ rating: 4, consentAt: '2026-09-20' });
    expect(entries[3]?.before).toMatchObject({ projectId, quote: 'Test quote: our berths book themselves now.', consentAt: '2026-09-20' });
  });
});
