import { SERVICES_SETTING_KEYS, servicesIndexContentSchema, type ServicesIndexContentInput } from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Copy of `/services/` for the placeholder database (content.ts rules): placeholder words,
 * no figures, names or promises. The services themselves come from the homepage seed, and
 * the publish-ready copy lives in apps/web/static-content/services. Category headings are
 * left to the API's question fallback.
 */
export const SERVICES_INDEX_PLACEHOLDER: ServicesIndexContentInput = {
  seo: {
    title: 'Placeholder services title',
    description: 'Placeholder description of the services index. The approved copy replaces it before launch.',
  },
  title: 'Placeholder services heading',
  answerBlock:
    'Placeholder answer for the services index. The approved two to three sentence answer replaces this text before launch.',
  intro: 'Placeholder. The approved copy introduces the services and how they are grouped.',
  otherGroupName: 'Placeholder group name',
  otherGroupHeading: 'Placeholder group question?',
  empty: 'No services are published yet.',
  cardLinkLabel: 'Placeholder link label',
  guidance: {
    heading: 'Placeholder guidance question?',
    body: 'Placeholder. The approved copy tells a buyer where to go when no single service fits.',
    primaryCta: { label: 'Placeholder contact link', href: '/contact/' },
    secondaryCta: null,
  },
};

export const servicesSeed: PageSeed = {
  family: 'services',
  content: SERVICES_INDEX_PLACEHOLDER,
  /** Creates the setting once; a value someone has set since is never overwritten. */
  async seed(db: PrismaClient): Promise<void> {
    const value = servicesIndexContentSchema.parse(SERVICES_INDEX_PLACEHOLDER) as Prisma.InputJsonObject;
    await db.setting.upsert({
      where: { key: SERVICES_SETTING_KEYS.index },
      create: { key: SERVICES_SETTING_KEYS.index, value },
      update: {},
    });
  },
};
