import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { COMPANY_VIEW_SCHEMAS } from '@calwebtech/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyService } from './company.service';

// Needs a migrated and seeded Postgres (pnpm db:seed): infra/docker-compose.yml with the dev
// overrides locally, services in CI.
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const prisma = new PrismaService(loadEnv(process.env));

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('company pages against the seeded database', () => {
  it('builds every page from the placeholder copy the seed creates', async () => {
    const company = new CompanyService(prisma);
    const views = {
      about: await company.about(),
      team: await company.team(),
      testimonials: await company.testimonials(),
      awards: await company.awards(),
      partners: await company.partners(),
      technology: await company.technology(),
    };
    for (const [page, view] of Object.entries(views)) {
      expect(view, `${page} has its copy setting`).not.toBeNull();
    }
    COMPANY_VIEW_SCHEMAS.about.parse(views.about);
    COMPANY_VIEW_SCHEMAS.team.parse(views.team);
    COMPANY_VIEW_SCHEMAS.testimonials.parse(views.testimonials);
    COMPANY_VIEW_SCHEMAS.awards.parse(views.awards);
    COMPANY_VIEW_SCHEMAS.partners.parse(views.partners);
    COMPANY_VIEW_SCHEMAS.technology.parse(views.technology);
  });
});
