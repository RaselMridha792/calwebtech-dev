import { z } from 'zod';
import type { LeadType } from '../lead';
import { decorativeImageSchema, imageSchema } from '../media';
import { slugSchema } from '../seo';
import { siteContactSchema } from '../site';
import { siteHrefSchema, siteLinkSchema } from '../site-chrome';
import { thankYouPath } from '../site-paths';
import { answerBlockSchema, faqItemSchema, pageSeoSchema, questionSchema, requiredText } from './common';

/**
 * The static page family (docs/10-site-pages.md): pricing, process, contact, FAQ, the
 * thank-you pages and the legal set. None of these pages has a record of its own, so their
 * copy lives in `Setting` rows keyed `static.<page>` and proof comes from its content type:
 * `PricingTier`, `ProcessStep`, `Faq`, `EnquiryType` and `Location`.
 */

// ---------------------------------------------------------------- keys and constants

export const STATIC_LEGAL_SLUGS = [
  'privacy-policy',
  'terms',
  'cookie-policy',
  'accessibility',
  'information-security',
] as const;
export type StaticLegalSlug = (typeof STATIC_LEGAL_SLUGS)[number];
export const staticLegalSlugSchema = z.enum(STATIC_LEGAL_SLUGS);

/** Setting keys of the family, each validated by the content schema beside it. */
export const STATIC_SETTING_KEYS = {
  pricing: 'static.pricing',
  process: 'static.process',
  contact: 'static.contact',
  faq: 'static.faq',
  thankYou: 'static.thank-you',
  notFound: 'static.not-found',
  legal: {
    'privacy-policy': 'static.legal.privacy-policy',
    terms: 'static.legal.terms',
    'cookie-policy': 'static.legal.cookie-policy',
    accessibility: 'static.legal.accessibility',
    'information-security': 'static.legal.information-security',
  },
} as const satisfies {
  pricing: string;
  process: string;
  contact: string;
  faq: string;
  thankYou: string;
  notFound: string;
  legal: Record<StaticLegalSlug, string>;
};

/** `Faq.group` of the questions shown on /pricing/ and /process/; /faq/ lists every configured group. */
export const STATIC_PRICING_FAQ_GROUP = 'pricing';
export const STATIC_PROCESS_FAQ_GROUP = 'process';

/** The conversion types with a thank-you page, at `/thank-you/<type>/`. */
export const STATIC_THANK_YOU_TYPES = [
  'contact',
  'project',
  'audit',
  'calculator',
  'booking',
  'resource',
  'careers',
] as const;
export type StaticThankYouType = (typeof STATIC_THANK_YOU_TYPES)[number];
export const staticThankYouTypeSchema = z.enum(STATIC_THANK_YOU_TYPES);

/**
 * Where a form of each lead type sends the visitor once the lead is stored. A service
 * enquiry is a project enquiry; a consultation is confirmed on the booking page.
 */
export const STATIC_THANK_YOU_BY_LEAD_TYPE = {
  PROJECT: 'project',
  SERVICE_ENQUIRY: 'project',
  CONSULTATION: 'booking',
  CONTACT: 'contact',
  CALCULATOR: 'calculator',
  AUDIT: 'audit',
  RESOURCE: 'resource',
  CAREERS: 'careers',
} as const satisfies Record<LeadType, StaticThankYouType>;

/** The thank-you page path for a lead type, e.g. `/thank-you/contact/`. */
export const staticThankYouPathForLead = (type: LeadType): string => thankYouPath(STATIC_THANK_YOU_BY_LEAD_TYPE[type]);

/** The contact form's `formId`, so leads from it are recognisable in the inbox. */
export const STATIC_CONTACT_FORM_ID = 'contact-page';

// ---------------------------------------------------------------- inline links

/** A link written inside legal copy as `[label](href)`. */
export type StaticTextPart = string | { label: string; href: string };

const INLINE_LINK = /\[([^\]\n]{1,120})\]\(([^)\s]{1,500})\)/g;

/** Where an inline link may point: a site path, or an https, mailto or tel URL. */
export function isStaticInlineHref(href: string): boolean {
  if (href.startsWith('/')) return !href.startsWith('//');
  return /^(https:\/\/|mailto:|tel:)/.test(href) && URL.canParse(href);
}

/** Splits copy into text and `[label](href)` links, in order. */
export function staticTextParts(text: string): StaticTextPart[] {
  const parts: StaticTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_LINK)) {
    const [whole, label = '', href = ''] = match;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ label, href });
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Copy that may carry inline links; every link must point somewhere a visitor can follow. */
const richText = (max: number) =>
  requiredText(max).refine(
    (value) => staticTextParts(value).every((part) => typeof part === 'string' || isStaticInlineHref(part.href)),
    'Inline links are written [label](href) with a site path or an https, mailto or tel URL',
  );

// ---------------------------------------------------------------- building blocks

const titledItemSchema = z.object({ title: requiredText(90), body: requiredText(600) });

/** H1, the direct answer under it, and the introduction. */
const staticHeroSchema = z.object({
  title: requiredText(80),
  answer: answerBlockSchema,
  intro: requiredText(400),
});

const staticCtaSchema = z.object({
  heading: requiredText(120),
  body: requiredText(300),
  primaryCta: siteLinkSchema,
  secondaryCta: siteLinkSchema.nullable(),
});

/** A question list's heading and introduction; the questions come from `Faq` rows. */
const staticFaqIntroSchema = z.object({ heading: questionSchema(120), intro: requiredText(300) });

export const staticPricingTierSchema = z.object({
  name: requiredText(60),
  priceLabel: requiredText(40),
  summary: requiredText(300),
  highlighted: z.boolean(),
});

export const staticProcessStepSchema = z.object({
  title: requiredText(60),
  timing: requiredText(40),
  summary: requiredText(200),
  heading: requiredText(160),
  body: requiredText(800),
  youGet: z.array(requiredText(120)).max(6),
  weNeed: z.array(requiredText(120)).max(6),
  image: imageSchema.nullable(),
});

// ---------------------------------------------------------------- /pricing/

export const staticPricingContentSchema = z.object({
  seo: pageSeoSchema,
  hero: staticHeroSchema,
  backdrop: decorativeImageSchema.nullable(),
  tiers: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    highlightLabel: requiredText(30),
    note: requiredText(300),
    empty: requiredText(200),
  }),
  included: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(requiredText(160)).min(1).max(12),
  }),
  factors: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(titledItemSchema).min(1).max(10),
  }),
  quoting: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    steps: z.array(titledItemSchema).min(1).max(6),
  }),
  faq: staticFaqIntroSchema,
  cta: staticCtaSchema,
});

/** `GET /pages/pricing`. */
export const staticPricingViewSchema = z.object({
  content: staticPricingContentSchema,
  /** Active tiers in order. */
  tiers: z.array(staticPricingTierSchema),
  /** Questions in the `pricing` group. */
  faqs: z.array(faqItemSchema),
});

// ---------------------------------------------------------------- /process/

export const staticProcessContentSchema = z.object({
  seo: pageSeoSchema,
  hero: staticHeroSchema,
  backdrop: decorativeImageSchema.nullable(),
  steps: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    youGetLabel: requiredText(40),
    weNeedLabel: requiredText(40),
    empty: requiredText(200),
  }),
  principles: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(titledItemSchema).min(1).max(6),
  }),
  delays: z.object({
    heading: questionSchema(120),
    intro: requiredText(400),
    items: z.array(titledItemSchema).min(1).max(6),
  }),
  afterLaunch: z.object({
    heading: questionSchema(120),
    body: requiredText(600),
    items: z.array(requiredText(160)).min(1).max(8),
    link: siteLinkSchema.nullable(),
  }),
  faq: staticFaqIntroSchema,
  cta: staticCtaSchema,
});

/** `GET /pages/process`. */
export const staticProcessViewSchema = z.object({
  content: staticProcessContentSchema,
  steps: z.array(staticProcessStepSchema),
  /** Questions in the `process` group. */
  faqs: z.array(faqItemSchema),
});

// ---------------------------------------------------------------- /contact/

export const staticContactContentSchema = z.object({
  seo: pageSeoSchema,
  hero: z.object({ title: requiredText(80), intro: requiredText(400) }),
  image: imageSchema.nullable(),
  form: z.object({
    heading: requiredText(90),
    intro: requiredText(300),
    enquiryLabel: requiredText(60),
    messageLabel: requiredText(80),
    messagePlaceholder: requiredText(120),
    submitLabel: requiredText(40),
    footnote: requiredText(300),
    success: z.object({ heading: requiredText(120), body: requiredText(400) }),
  }),
  details: z.object({
    heading: requiredText(90),
    phoneLabel: requiredText(40),
    emailLabel: requiredText(40),
    officesLabel: requiredText(40),
    response: requiredText(200),
  }),
  routing: z.object({
    heading: questionSchema(120),
    intro: requiredText(300),
    /** What happens to each enquiry type, keyed by `EnquiryType.slug`. */
    descriptions: z.array(z.object({ slug: slugSchema, body: requiredText(300) })).max(12),
  }),
  nextSteps: z.object({
    heading: questionSchema(120),
    steps: z.array(titledItemSchema).min(1).max(5),
  }),
});

export const staticEnquiryTypeSchema = z.object({
  slug: slugSchema,
  name: requiredText(60),
  description: z.string().trim().min(1).max(300).nullable(),
});

/** `GET /pages/contact`. Mailboxes never leave the API. */
export const staticContactViewSchema = z.object({
  content: staticContactContentSchema,
  contact: siteContactSchema,
  /** Published locations with an address, head office first. */
  offices: z.array(z.object({ city: requiredText(80), address: requiredText(300) })),
  /** Routed enquiry types in order. */
  enquiryTypes: z.array(staticEnquiryTypeSchema),
});

// ---------------------------------------------------------------- /faq/

export const staticFaqContentSchema = z.object({
  seo: pageSeoSchema,
  hero: staticHeroSchema,
  /** The groups the page lists, in order; each is a `Faq.group` value. */
  groups: z
    .array(z.object({ key: slugSchema, heading: questionSchema(120), intro: requiredText(300) }))
    .min(1)
    .max(12)
    .refine((groups) => new Set(groups.map((group) => group.key)).size === groups.length, 'Each group is listed once'),
  navLabel: requiredText(60),
  empty: requiredText(200),
  cta: staticCtaSchema,
});

export const staticFaqGroupSchema = z.object({
  key: slugSchema,
  heading: questionSchema(120),
  intro: requiredText(300),
  items: z.array(faqItemSchema),
});

/** `GET /pages/faq`. Groups without questions are left out. */
export const staticFaqViewSchema = z.object({
  seo: pageSeoSchema,
  hero: staticHeroSchema,
  navLabel: requiredText(60),
  empty: requiredText(200),
  cta: staticCtaSchema,
  groups: z.array(staticFaqGroupSchema),
});

// ---------------------------------------------------------------- /thank-you/<type>/

export const staticThankYouPageSchema = z.object({
  type: staticThankYouTypeSchema,
  seo: pageSeoSchema,
  eyebrow: requiredText(60),
  title: requiredText(90),
  /** What was received and what it is used for. */
  intro: requiredText(400),
  /** What the form sent, in the visitor's words, e.g. "Your name and work email". */
  received: z.object({ heading: requiredText(90), items: z.array(requiredText(160)).min(1).max(6) }),
  /** When to expect to hear back, e.g. "Within one business day". */
  response: z.object({ label: requiredText(40), value: requiredText(60), detail: requiredText(200) }),
  nextSteps: z.object({
    heading: requiredText(90),
    steps: z.array(titledItemSchema).min(1).max(4),
  }),
  secondary: z.object({ heading: requiredText(90), body: requiredText(300), cta: siteLinkSchema }),
  links: z.array(siteLinkSchema).max(4),
});

export const staticThankYouContentSchema = z.object({
  image: imageSchema.nullable(),
  callLabel: requiredText(60),
  pages: z
    .array(staticThankYouPageSchema)
    .min(1)
    .refine((pages) => new Set(pages.map((page) => page.type)).size === pages.length, 'Each type has one page'),
});

/** `GET /pages/thank-you/:type`. */
export const staticThankYouViewSchema = staticThankYouPageSchema.extend({
  image: imageSchema.nullable(),
  callLabel: requiredText(60),
  contact: siteContactSchema,
});

// ---------------------------------------------------------------- legal set

const legalBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: richText(2000) }),
  z.object({ type: z.literal('list'), items: z.array(richText(600)).min(1).max(20) }),
  z.object({
    type: z.literal('table'),
    caption: requiredText(160),
    columns: z.array(requiredText(40)).min(2).max(5),
    rows: z.array(z.array(requiredText(400)).min(2).max(5)).min(1).max(30),
  }),
]);

const legalContentShape = {
  slug: staticLegalSlugSchema,
  seo: pageSeoSchema,
  title: requiredText(80),
  intro: requiredText(600),
  /** ISO date the policy text last changed. */
  lastUpdated: z.iso.date(),
  sections: z
    .array(z.object({ id: slugSchema, heading: requiredText(120), blocks: z.array(legalBlockSchema).min(1).max(20) }))
    .min(1)
    .max(30),
  contactSection: z.object({ heading: requiredText(120), body: requiredText(400) }),
};

const uniqueSectionIds = (page: { sections: readonly { id: string }[] }) =>
  new Set(page.sections.map((section) => section.id)).size === page.sections.length;

export const staticLegalContentSchema = z
  .object(legalContentShape)
  .refine(uniqueSectionIds, { message: 'Each section has its own id', path: ['sections'] });

/** `GET /pages/legal/:slug`. */
export const staticLegalViewSchema = z
  .object({ ...legalContentShape, contact: siteContactSchema })
  .refine(uniqueSectionIds, { message: 'Each section has its own id', path: ['sections'] });

// ---------------------------------------------------------------- not found

/** The designed 404: a site search, the most useful destinations and a way to reach a person. */
export const staticNotFoundContentSchema = z.object({
  eyebrow: requiredText(40),
  title: requiredText(80),
  intro: requiredText(300),
  search: z.object({
    label: requiredText(60),
    placeholder: requiredText(80),
    submitLabel: requiredText(30),
    /** Announced with the number of matches, e.g. "3 pages match". */
    resultsLabel: requiredText(60),
    noResults: requiredText(200),
  }),
  destinations: z.object({
    heading: requiredText(90),
    items: z
      .array(z.object({ title: requiredText(60), body: requiredText(160), href: siteHrefSchema }))
      .min(1)
      .max(6),
  }),
  help: z.object({ heading: requiredText(90), body: requiredText(300) }),
});

/** `GET /pages/not-found`. */
export const staticNotFoundViewSchema = staticNotFoundContentSchema.extend({ contact: siteContactSchema });

// ---------------------------------------------------------------- types

export type StaticPricingTier = z.output<typeof staticPricingTierSchema>;
export type StaticProcessStep = z.output<typeof staticProcessStepSchema>;
export type StaticPricingContent = z.output<typeof staticPricingContentSchema>;
export type StaticPricingContentInput = z.input<typeof staticPricingContentSchema>;
export type StaticPricingView = z.output<typeof staticPricingViewSchema>;
export type StaticProcessContent = z.output<typeof staticProcessContentSchema>;
export type StaticProcessContentInput = z.input<typeof staticProcessContentSchema>;
export type StaticProcessView = z.output<typeof staticProcessViewSchema>;
export type StaticContactContent = z.output<typeof staticContactContentSchema>;
export type StaticContactContentInput = z.input<typeof staticContactContentSchema>;
export type StaticEnquiryType = z.output<typeof staticEnquiryTypeSchema>;
export type StaticContactView = z.output<typeof staticContactViewSchema>;
export type StaticFaqContent = z.output<typeof staticFaqContentSchema>;
export type StaticFaqContentInput = z.input<typeof staticFaqContentSchema>;
export type StaticFaqGroup = z.output<typeof staticFaqGroupSchema>;
export type StaticFaqView = z.output<typeof staticFaqViewSchema>;
export type StaticThankYouPage = z.output<typeof staticThankYouPageSchema>;
export type StaticThankYouContent = z.output<typeof staticThankYouContentSchema>;
export type StaticThankYouContentInput = z.input<typeof staticThankYouContentSchema>;
export type StaticThankYouView = z.output<typeof staticThankYouViewSchema>;
export type StaticLegalContent = z.output<typeof staticLegalContentSchema>;
export type StaticLegalContentInput = z.input<typeof staticLegalContentSchema>;
export type StaticLegalView = z.output<typeof staticLegalViewSchema>;
export type StaticLegalBlock = z.output<typeof legalBlockSchema>;
export type StaticNotFoundContentInput = z.input<typeof staticNotFoundContentSchema>;
export type StaticNotFoundView = z.output<typeof staticNotFoundViewSchema>;
