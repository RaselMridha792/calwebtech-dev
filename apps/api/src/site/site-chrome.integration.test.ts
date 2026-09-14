import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { siteChromeViewSchema } from '@calwebtech/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SiteChromeService } from './site-chrome.service';

// Needs a migrated and seeded Postgres (pnpm db:seed): infra/docker-compose.yml with the dev
// overrides locally, services in CI.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('site chrome against the seeded database', () => {
  it('builds a valid chrome whose links all work from any page', async () => {
    const chrome = siteChromeViewSchema.parse(await new SiteChromeService(prisma).find());
    const hrefs = JSON.stringify(chrome).match(/"href":"[^"]*"/g) ?? [];
    expect(hrefs.length).toBeGreaterThan(10);
    expect(hrefs.filter((href) => href.startsWith('"href":"#'))).toEqual([]);
    expect(chrome.megaMenu.services.columns.length).toBeGreaterThan(0);
    expect(chrome.footer.legal.length).toBeGreaterThan(0);
  });
});
