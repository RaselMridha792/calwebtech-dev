import {
  STATIC_LEGAL_SLUGS,
  STATIC_SETTING_KEYS,
  STATIC_THANK_YOU_TYPES,
  staticContactContentSchema,
  staticFaqContentSchema,
  staticLegalContentSchema,
  staticNotFoundContentSchema,
  staticPricingContentSchema,
  staticProcessContentSchema,
  staticThankYouContentSchema,
  type StaticContactContentInput,
  type StaticFaqContentInput,
  type StaticLegalContentInput,
  type StaticLegalSlug,
  type StaticNotFoundContentInput,
  type StaticPricingContentInput,
  type StaticProcessContentInput,
  type StaticThankYouContentInput,
} from '@calwebtech/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { PageSeed } from './index';

/**
 * Placeholder copy for the static family's pages (pricing, process, contact, FAQ, thank-you
 * and legal), written like `../content.ts`: safe on a URL someone can open, so it states
 * nothing about the business. The publish-ready copy lives in the web app's snapshots
 * (`apps/web/static-content/static`). Pricing tiers and process steps come from the launch
 * seed; FAQ rows are left empty, so /faq/ shows its empty state.
 */

const answer = 'Placeholder answer. The approved two or three sentence answer replaces this text before launch.';
const note = 'Placeholder. The approved copy replaces this text before launch.';
const cta = {
  heading: 'Placeholder call to action',
  body: note,
  primaryCta: { label: 'Contact us', href: '/contact/' },
  secondaryCta: null,
};
const items = (count: number) =>
  ['one', 'two', 'three', 'four'].slice(0, count).map((word) => ({ title: `Placeholder point ${word}`, body: note }));

const PRICING: StaticPricingContentInput = {
  seo: { title: 'Placeholder: pricing', description: 'Placeholder description for the pricing page.' },
  hero: { title: 'Pricing', answer, intro: note },
  backdrop: null,
  tiers: {
    heading: 'Placeholder tiers heading?',
    intro: note,
    highlightLabel: 'Placeholder label',
    note,
    empty: 'No pricing is published yet.',
  },
  included: { heading: 'Placeholder inclusions heading?', intro: note, items: ['Placeholder inclusion'] },
  factors: { heading: 'Placeholder factors heading?', intro: note, items: items(3) },
  quoting: { heading: 'Placeholder quoting heading?', intro: note, steps: items(3) },
  faq: { heading: 'Placeholder questions heading?', intro: note },
  cta,
};

const PROCESS: StaticProcessContentInput = {
  seo: { title: 'Placeholder: process', description: 'Placeholder description for the process page.' },
  hero: { title: 'Process', answer, intro: note },
  backdrop: null,
  steps: {
    heading: 'Placeholder steps heading?',
    intro: note,
    youGetLabel: 'You get',
    weNeedLabel: 'We need',
    empty: 'No process steps are published yet.',
  },
  principles: { heading: 'Placeholder principles heading?', intro: note, items: items(3) },
  delays: { heading: 'Placeholder delays heading?', intro: note, items: items(3) },
  afterLaunch: { heading: 'Placeholder after launch heading?', body: note, items: ['Placeholder item'], link: null },
  faq: { heading: 'Placeholder questions heading?', intro: note },
  cta,
};

/** Generic topics; the mailboxes are reserved for documentation until the client confirms them. */
export const STATIC_ENQUIRY_TYPES = [
  { slug: 'new-project', name: 'New project' },
  { slug: 'free-website-audit', name: 'Free website audit' },
  { slug: 'support', name: 'Support' },
  { slug: 'partnership', name: 'Partnership' },
  { slug: 'careers', name: 'Careers' },
  { slug: 'press', name: 'Press' },
].map((type, order) => ({ ...type, order, mailbox: 'hello@example.com' }));

const CONTACT: StaticContactContentInput = {
  seo: { title: 'Placeholder: contact', description: 'Placeholder description for the contact page.' },
  hero: { title: 'Contact', intro: note },
  image: null,
  form: {
    heading: 'Send a message',
    intro: note,
    enquiryLabel: 'What is it about?',
    messageLabel: 'Your message',
    messagePlaceholder: 'Placeholder hint',
    submitLabel: 'Send my message',
    footnote: note,
    success: { heading: 'Thanks. Your message is with us.', body: 'We will reply to you by email.' },
  },
  details: {
    heading: 'Placeholder details heading',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    officesLabel: 'Offices',
    response: note,
  },
  routing: { heading: 'Placeholder routing heading?', intro: note, descriptions: [] },
  nextSteps: { heading: 'Placeholder next steps heading?', steps: items(3) },
};

const FAQ: StaticFaqContentInput = {
  seo: { title: 'Placeholder: questions', description: 'Placeholder description for the questions page.' },
  hero: { title: 'Frequently asked questions', answer, intro: note },
  groups: ['pricing', 'process', 'ownership', 'search', 'support'].map((key) => ({
    key,
    heading: `Placeholder ${key} heading?`,
    intro: note,
  })),
  navLabel: 'Topics',
  empty: 'No questions are published yet.',
  cta,
};

const THANK_YOU: StaticThankYouContentInput = {
  image: null,
  callLabel: 'Call us',
  pages: STATIC_THANK_YOU_TYPES.map((type) => ({
    type,
    seo: { title: `Placeholder: thank you (${type})`, description: 'Placeholder description for a thank-you page.' },
    eyebrow: 'Request received',
    title: 'Thanks. Your request is with us.',
    intro: note,
    received: { heading: 'Placeholder received heading', items: ['Placeholder received item'] },
    response: { label: 'Placeholder label', value: 'Placeholder window', detail: note },
    nextSteps: { heading: 'Placeholder next steps heading', steps: items(2) },
    secondary: { heading: 'Placeholder secondary heading', body: note, cta: { label: 'Back to the homepage', href: '/' } },
    links: [],
  })),
};

const LEGAL_TITLES: Record<StaticLegalSlug, string> = {
  'privacy-policy': 'Privacy policy',
  terms: 'Terms of use',
  'cookie-policy': 'Cookie policy',
  accessibility: 'Accessibility statement',
  'information-security': 'Information security',
};

const LEGAL: Record<StaticLegalSlug, StaticLegalContentInput> = Object.fromEntries(
  STATIC_LEGAL_SLUGS.map((slug) => [
    slug,
    {
      slug,
      seo: { title: `Placeholder: ${LEGAL_TITLES[slug].toLowerCase()}`, description: 'Placeholder description for a legal page.' },
      title: LEGAL_TITLES[slug],
      intro: note,
      lastUpdated: '2026-09-14',
      sections: [{ id: 'placeholder', heading: 'Placeholder section', blocks: [{ type: 'paragraph', text: note }] }],
      contactSection: { heading: 'Placeholder contact heading', body: note },
    } satisfies StaticLegalContentInput,
  ]),
) as Record<StaticLegalSlug, StaticLegalContentInput>;

const NOT_FOUND: StaticNotFoundContentInput = {
  eyebrow: 'Page not found',
  title: 'Placeholder: page not found',
  intro: note,
  search: {
    label: 'Search this site',
    placeholder: 'Placeholder hint',
    submitLabel: 'Search',
    resultsLabel: 'matching pages',
    noResults: note,
  },
  destinations: {
    heading: 'Placeholder destinations heading',
    items: [
      { title: 'Home', body: note, href: '/' },
      { title: 'Contact', body: note, href: '/contact/' },
    ],
  },
  help: { heading: 'Placeholder help heading', body: note },
};

/** Every setting the family seeds, validated by its schema. */
function settings(): [string, Prisma.InputJsonValue][] {
  return [
    [STATIC_SETTING_KEYS.pricing, staticPricingContentSchema.parse(PRICING) as Prisma.InputJsonObject],
    [STATIC_SETTING_KEYS.process, staticProcessContentSchema.parse(PROCESS) as Prisma.InputJsonObject],
    [STATIC_SETTING_KEYS.contact, staticContactContentSchema.parse(CONTACT) as Prisma.InputJsonObject],
    [STATIC_SETTING_KEYS.faq, staticFaqContentSchema.parse(FAQ) as Prisma.InputJsonObject],
    [STATIC_SETTING_KEYS.thankYou, staticThankYouContentSchema.parse(THANK_YOU) as Prisma.InputJsonObject],
    [STATIC_SETTING_KEYS.notFound, staticNotFoundContentSchema.parse(NOT_FOUND) as Prisma.InputJsonObject],
    ...STATIC_LEGAL_SLUGS.map((slug): [string, Prisma.InputJsonValue] => [
      STATIC_SETTING_KEYS.legal[slug],
      staticLegalContentSchema.parse(LEGAL[slug]) as Prisma.InputJsonObject,
    ]),
  ];
}

export const staticSeed: PageSeed = {
  family: 'static',
  content: { PRICING, PROCESS, CONTACT, FAQ, THANK_YOU, NOT_FOUND, LEGAL, STATIC_ENQUIRY_TYPES },
  async seed(db: PrismaClient) {
    // Created once: copy or enquiry routing a person set since is never overwritten.
    for (const [key, value] of settings()) {
      const row = await db.setting.findUnique({ where: { key }, select: { id: true } });
      if (!row) await db.setting.create({ data: { key, value } });
    }
    for (const type of STATIC_ENQUIRY_TYPES) {
      await db.enquiryType.upsert({ where: { slug: type.slug }, create: type, update: {} });
    }
  },
};
