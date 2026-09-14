import {
  COMPANY_CONTENT_SCHEMAS,
  COMPANY_PAGES,
  COMPANY_SETTING_KEYS,
  type CompanyAboutContentInput,
  type CompanyAwardsContentInput,
  type CompanyPartnersContentInput,
  type CompanyTeamContentInput,
  type CompanyTechnologyContentInput,
  type CompanyTestimonialsContentInput,
} from '@calwebtech/shared';
import type { Prisma } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Placeholder copy for the company pages (docs/10-site-pages.md), so /about/, /team/,
 * /testimonials/, /awards/, /partners/ and /technology/ render against the placeholder
 * database. Written like ../content.ts: "Placeholder" copy, no names, figures, ratings or
 * claims. No proof rows are seeded, so every list on these pages shows its empty state.
 * The approved demo copy lives in apps/web/static-content/company.
 */

const answerBlock =
  'Placeholder answer block for this page. The approved copy replaces these sentences before the page is published.';

const hero = (title: string) => ({ eyebrow: null, title, answerBlock, intro: 'Placeholder introduction.', backdrop: null });

const seo = (title: string) => ({ title, description: 'Placeholder description for this page.' });

const faq = { heading: 'Placeholder questions heading?', intro: null };

const card = { title: 'Placeholder question?', body: 'Placeholder answer.' };

export const COMPANY_ABOUT_PLACEHOLDER: CompanyAboutContentInput = {
  seo: seo('Placeholder about page'),
  hero: hero('Placeholder about page'),
  story: { heading: 'Placeholder story heading?', paragraphs: ['Placeholder story paragraph.'], image: null },
  statistics: { heading: 'Placeholder figures heading?' },
  team: {
    heading: 'Placeholder team heading?',
    empty: 'No team profiles are published yet.',
    linkLabel: 'Placeholder team link',
  },
  values: { heading: 'Placeholder values heading?', items: [card] },
  recognition: {
    heading: 'Placeholder recognition heading?',
    empty: 'No recognition is published yet.',
    awardsLinkLabel: 'Placeholder recognition link',
    partnersLinkLabel: 'Placeholder partnerships link',
  },
  faq,
};

export const COMPANY_TEAM_PLACEHOLDER: CompanyTeamContentInput = {
  seo: seo('Placeholder team page'),
  hero: hero('Placeholder team page'),
  members: { heading: 'Placeholder team heading?', empty: 'No team profiles are published yet.' },
  roles: { heading: 'Placeholder roles heading?', items: [card] },
  faq,
};

export const COMPANY_TESTIMONIALS_PLACEHOLDER: CompanyTestimonialsContentInput = {
  seo: seo('Placeholder client feedback page'),
  hero: hero('Placeholder client feedback page'),
  quotes: {
    heading: 'Placeholder client quotes heading?',
    empty: 'No client quotes are published yet.',
    caseStudyLabel: 'Placeholder link label',
  },
  ratings: {
    heading: 'Placeholder ratings heading?',
    empty: 'No ratings are published yet.',
    method: 'Placeholder description of how ratings are collected.',
  },
  faq,
};

export const COMPANY_AWARDS_PLACEHOLDER: CompanyAwardsContentInput = {
  seo: seo('Placeholder recognition page'),
  hero: hero('Placeholder recognition page'),
  recognition: { heading: 'Placeholder recognition heading?', empty: 'No recognition is published yet.' },
  partners: {
    heading: 'Placeholder partnerships heading?',
    empty: 'No partnerships are published yet.',
    linkLabel: 'Placeholder partnerships link',
  },
  faq,
};

export const COMPANY_PARTNERS_PLACEHOLDER: CompanyPartnersContentInput = {
  seo: seo('Placeholder partnerships page'),
  hero: hero('Placeholder partnerships page'),
  partners: {
    heading: 'Placeholder partnerships heading?',
    empty: 'No partnerships are published yet.',
    meaningLabel: 'Placeholder label',
  },
  independence: { heading: 'Placeholder independence heading?', paragraphs: ['Placeholder paragraph.'] },
  faq,
};

export const COMPANY_TECHNOLOGY_PLACEHOLDER: CompanyTechnologyContentInput = {
  seo: seo('Placeholder technology page'),
  hero: hero('Placeholder technology page'),
  stack: { heading: 'Placeholder technology heading?', empty: 'No technologies are published yet.', categories: [] },
  proof: { heading: 'Placeholder figures heading?', stats: [] },
  choosing: { heading: 'Placeholder approach heading?', items: [card] },
  faq,
};

/** Each page's placeholder copy, keyed by page. */
export const COMPANY_PLACEHOLDERS = {
  about: COMPANY_ABOUT_PLACEHOLDER,
  team: COMPANY_TEAM_PLACEHOLDER,
  testimonials: COMPANY_TESTIMONIALS_PLACEHOLDER,
  awards: COMPANY_AWARDS_PLACEHOLDER,
  partners: COMPANY_PARTNERS_PLACEHOLDER,
  technology: COMPANY_TECHNOLOGY_PLACEHOLDER,
} as const;

export const companySeed: PageSeed = {
  family: 'company',
  // A list, not keyed by page: content.test.ts scans the copy, and a page key is not a claim.
  content: COMPANY_PAGES.map((page) => COMPANY_PLACEHOLDERS[page]),
  /** Creates each page's copy setting once; a value someone has set since is never overwritten. */
  seed: async (db) => {
    for (const page of COMPANY_PAGES) {
      const key = COMPANY_SETTING_KEYS[page];
      const value = COMPANY_CONTENT_SCHEMAS[page].parse(COMPANY_PLACEHOLDERS[page]) as Prisma.InputJsonObject;
      const existing = await db.setting.findUnique({ where: { key }, select: { id: true } });
      if (!existing) await db.setting.create({ data: { key, value } });
    }
  },
};
