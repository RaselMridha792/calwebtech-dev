import {
  FORMS_PROJECT_STEPS,
  FORMS_SETTING_KEYS,
  formsAuditContentSchema,
  formsProjectContentSchema,
  type FormsAuditContentInput,
  type FormsProjectContentInput,
} from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Placeholder copy for the forms family (`/start-a-project/` and `/free-website-audit/`),
 * written like `../content.ts`: safe on a URL someone can open, so it states nothing about
 * the business, promises no reply time and names no proof. The publish-ready copy lives in
 * the web app's snapshots (`apps/web/static-content/forms`). Neither page has a record of
 * its own, so without these settings the API cannot build either view.
 *
 * No questions are seeded, so both pages show no question list, and the tickable services
 * are whatever the services seed published.
 */

const note = 'Placeholder. The approved copy replaces this text before launch.';
const answer =
  'Placeholder answer. The approved two or three sentence answer replaces this text before launch.';
const field = { label: 'Placeholder label', hint: null, placeholder: null };
const timing = 'Placeholder timing';
const titled = (count: number) =>
  ['one', 'two', 'three'].slice(0, count).map((word) => ({ title: `Placeholder point ${word}`, body: note }));

const START_PROJECT: FormsProjectContentInput = {
  seo: {
    title: 'Placeholder: start a project',
    description: 'Placeholder description for the start a project page.',
  },
  hero: { eyebrow: 'Start a project', title: 'Start a project', answer, intro: note },
  backdrop: null,
  assurances: ['Placeholder assurance'],
  form: {
    heading: 'Placeholder form heading?',
    intro: note,
    stepLabel: 'Step',
    ofLabel: 'of',
    backLabel: 'Back',
    nextLabel: 'Next',
    submitLabel: 'Send',
    savedLabel: 'Saved.',
    saveNote: note,
    uploadNote: note,
    footnote: note,
    servicesEmpty: 'No services are published yet.',
    success: { heading: 'Placeholder confirmation', body: note },
    steps: FORMS_PROJECT_STEPS.map((key) => ({ key, legend: 'Placeholder step question?', hint: note })),
    fields: {
      projectType: field,
      name: field,
      email: field,
      company: field,
      phone: field,
      siteUrl: field,
      serviceInterest: field,
      budgetBand: field,
      timeline: field,
      description: field,
      projectLinks: field,
    },
  },
  whatHappens: {
    heading: 'Placeholder next steps heading?',
    intro: note,
    steps: [{ title: 'Placeholder step', duration: timing, body: note }],
  },
  whatWeNeed: { heading: 'Placeholder inputs heading?', intro: note, items: ['Placeholder input'], note },
  alternatives: {
    heading: 'Placeholder alternatives heading?',
    intro: note,
    items: [{ title: 'Placeholder alternative', body: note, link: { label: 'Contact us', href: '/contact/' } }],
  },
  faq: { heading: 'Placeholder questions heading?', intro: note },
};

const FREE_WEBSITE_AUDIT: FormsAuditContentInput = {
  seo: {
    title: 'Placeholder: free website audit',
    description: 'Placeholder description for the free website audit page.',
  },
  hero: { eyebrow: 'Free website audit', title: 'Free website audit', answer, intro: note },
  backdrop: null,
  assurances: ['Placeholder assurance'],
  covers: { heading: 'Placeholder coverage heading?', intro: note, items: titled(3) },
  delivery: {
    heading: 'Placeholder delivery heading?',
    intro: note,
    steps: [{ title: 'Placeholder step', duration: timing, body: note }],
    image: null,
  },
  limits: { heading: 'Placeholder limits heading?', intro: note, items: ['Placeholder limit'] },
  form: {
    heading: 'Placeholder form heading?',
    intro: note,
    submitLabel: 'Send',
    footnote: note,
    success: { heading: 'Placeholder confirmation', body: note },
    fields: {
      siteUrl: field,
      mainConcern: field,
      competitorUrl: field,
      name: field,
      email: field,
      company: field,
      description: field,
    },
  },
  faq: { heading: 'Placeholder questions heading?', intro: note },
};

/** Every setting the family seeds, validated by its schema. */
function settings(): [string, Prisma.InputJsonValue][] {
  return [
    [FORMS_SETTING_KEYS.startProject, formsProjectContentSchema.parse(START_PROJECT)],
    [FORMS_SETTING_KEYS.freeWebsiteAudit, formsAuditContentSchema.parse(FREE_WEBSITE_AUDIT)],
  ];
}

export const formsSeed: PageSeed = {
  family: 'forms',
  content: { START_PROJECT, FREE_WEBSITE_AUDIT },
  async seed(db: PrismaClient) {
    // Created once: copy a person has changed since is never overwritten.
    for (const [key, value] of settings()) {
      const row = await db.setting.findUnique({ where: { key }, select: { id: true } });
      if (!row) await db.setting.create({ data: { key, value } });
    }
  },
};
