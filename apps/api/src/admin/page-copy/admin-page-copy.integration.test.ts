import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '@calwebtech/db';
import { importSnapshots } from '@calwebtech/db/import';
import {
  STATIC_THANK_YOU_TYPES,
  homePageViewSchema,
  staticThankYouViewSchema,
  type HomePageContent,
} from '@calwebtech/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../auth/audit.service';
import { loadEnv } from '../../config/env';
import { PageCopyController, PageCopyService } from '../../page-copy/page-copy.controller';
import { migrateDeploy } from '../../prisma/migrate-deploy';
import { PrismaService } from '../../prisma/prisma.service';
import { toStaticThankYouView } from '../../static/static.mapper';
import { AdminPageCopyService } from './admin-page-copy.service';

/**
 * Page copy from the snapshots into the database, and from the dashboard to the site
 * (docs/08-decisions.md, 59): the import writes the approved homepage and thank-you copy
 * where none is stored, the pages built from it are the approved ones, an edit is validated
 * by the page's schema and audited, and the site reads the stored copy back.
 *
 * The database is created on the same server as DATABASE_URL and dropped afterwards.
 */
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv({ ...process.env, TURNSTILE_SECRET: 'unused-by-this-suite' });
const snapshotDir = path.resolve(process.cwd(), '../../apps/web/static-content');
const run = Date.now().toString(36);
const databaseName = `calwebtech_page_copy_${run}`;
const databaseUrl = withDatabase(env.DATABASE_URL, databaseName);

const admin = createPrismaClient(env.DATABASE_URL);
const prisma = new PrismaService({ ...env, DATABASE_URL: databaseUrl });
const db = prisma.client;
const pageCopy = new AdminPageCopyService(prisma, new AuditService(prisma));
const actor = { id: '', ip: '203.0.113.7' };

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function snapshot(relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(snapshotDir, relPath), 'utf8'));
}

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  const status = migrateDeploy(databaseUrl);
  if (status !== 0) throw new Error(`migrate deploy exited ${String(status)} for ${databaseName}`);
  await importSnapshots(db, { dir: snapshotDir });
  const user = await db.user.create({
    data: { email: 'editor@calwebtech.test', name: 'An Editor', role: 'EDITOR', passwordHash: 'x' },
    select: { id: true },
  });
  actor.id = user.id;
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

describe('page copy from the snapshots', () => {
  it('stores the approved homepage copy', async () => {
    const approved = homePageViewSchema.parse(snapshot('home.json')).content;
    expect((await pageCopy.detail('home.content')).value).toEqual(JSON.parse(JSON.stringify(approved)));
  });

  for (const type of STATIC_THANK_YOU_TYPES) {
    const file = `static/thank-you/${type}.json`;
    if (!existsSync(path.join(snapshotDir, file))) continue;
    it(`builds /thank-you/${type}/ from the stored copy as the snapshot shows it`, async () => {
      const approved = staticThankYouViewSchema.parse(snapshot(file));
      const stored = (await pageCopy.detail('static.thank-you')).value;
      expect(toStaticThankYouView({ type, contentSetting: stored, contactSetting: approved.contact })).toEqual(approved);
    });
  }
});

describe('page copy edited in the dashboard', () => {
  it('refuses copy the page could not render, naming the field', async () => {
    const { value } = await pageCopy.detail('home.content');
    const broken = { ...(value as HomePageContent), hero: { ...(value as HomePageContent).hero, heading: '' } };
    await expect(pageCopy.update('home.content', broken, actor)).rejects.toMatchObject({
      response: { error: 'validation_failed', fieldErrors: { 'hero.heading': expect.any(Array) as unknown } },
    });
  });

  it('stores an edit, audits the sections it touched, and serves it to the site', async () => {
    const { value } = await pageCopy.detail('home.content');
    const edited = { ...(value as HomePageContent), hero: { ...(value as HomePageContent).hero, heading: 'Test edited headline' } };
    await pageCopy.update('home.content', edited, actor);

    const entry = await db.auditLog.findFirstOrThrow({ where: { action: 'page_copy.updated', entityId: 'home.content' } });
    expect(entry.after).toEqual({ sections: ['hero'] });
    const served = (await new PageCopyController(new PageCopyService(prisma)).find('home.content')) as HomePageContent;
    expect(served.hero.heading).toBe('Test edited headline');
  });

  it('keeps the edit when the import is forced', async () => {
    await importSnapshots(db, { dir: snapshotDir, force: true });
    const { value } = await pageCopy.detail('home.content');
    expect((value as HomePageContent).hero.heading).toBe('Test edited headline');
  });

  it('serves only the copy the site lays over a snapshot, and nothing unstored', async () => {
    const controller = new PageCopyController(new PageCopyService(prisma));
    await expect(controller.find('site.contact')).rejects.toMatchObject({ status: 404 });
    await expect(controller.find('booking.page')).rejects.toMatchObject({ status: 404 });
    await db.setting.delete({ where: { key: 'static.thank-you' } });
    await expect(controller.find('static.thank-you')).rejects.toMatchObject({ status: 404 });
  });
});
