import type { Faq, PricingTier, ProcessStep } from '@calwebtech/db';
import {
  faqItemSchema,
  siteContactSchema,
  staticContactContentSchema,
  staticContactViewSchema,
  staticFaqContentSchema,
  staticFaqViewSchema,
  staticLegalContentSchema,
  staticLegalViewSchema,
  staticPricingContentSchema,
  staticPricingViewSchema,
  staticProcessContentSchema,
  staticProcessViewSchema,
  staticThankYouContentSchema,
  staticThankYouViewSchema,
  type FaqItem,
  type StaticContactView,
  type StaticFaqView,
  type StaticLegalSlug,
  type StaticLegalView,
  type StaticPricingView,
  type StaticProcessView,
  type StaticThankYouView,
} from '@calwebtech/shared';
import { image } from '../landing-pages/landing-page.mapper';

/*
 * The static page family's views (docs/10-site-pages.md). Copy comes from `static.*`
 * settings and proof from its content type. Every function is pure and ends in the
 * shared schema's `parse`, so malformed copy fails here rather than rendering half a page.
 */

/**
 * Questions a buyer can read: rows whose question is not written as a question, or whose
 * answer is empty, are left out rather than failing the whole page.
 */
export function staticFaqItems(faqs: readonly Pick<Faq, 'id' | 'question' | 'answer'>[]): FaqItem[] {
  return faqs.flatMap((faq) => {
    const item = faqItemSchema.safeParse({ id: faq.id, question: faq.question, answer: faq.answer });
    return item.success ? [item.data] : [];
  });
}

export interface StaticPricingRecords {
  contentSetting: unknown;
  /** Active tiers in order. */
  tiers: readonly PricingTier[];
  /** Site-wide questions in the pricing group, in order. */
  faqs: readonly Faq[];
}

export function toStaticPricingView(records: StaticPricingRecords): StaticPricingView {
  return staticPricingViewSchema.parse({
    content: staticPricingContentSchema.parse(records.contentSetting),
    tiers: records.tiers.map((tier) => ({
      name: tier.name,
      priceLabel: tier.priceLabel,
      summary: tier.summary,
      highlighted: tier.highlighted,
    })),
    faqs: staticFaqItems(records.faqs),
  });
}

export interface StaticProcessRecords {
  contentSetting: unknown;
  /** Every step in order. */
  steps: readonly ProcessStep[];
  /** Site-wide questions in the process group, in order. */
  faqs: readonly Faq[];
}

export function toStaticProcessView(records: StaticProcessRecords): StaticProcessView {
  return staticProcessViewSchema.parse({
    content: staticProcessContentSchema.parse(records.contentSetting),
    steps: records.steps.map((step) => ({
      title: step.title,
      timing: step.timing,
      summary: step.summary,
      heading: step.heading,
      body: step.body,
      youGet: step.youGet.slice(0, 6),
      weNeed: step.weNeed.slice(0, 6),
      image: image(step.imageUrl, step.imageAlt),
    })),
    faqs: staticFaqItems(records.faqs),
  });
}

export interface StaticContactRecords {
  contentSetting: unknown;
  contactSetting: unknown;
  /** Published locations, head office first. Those without an address are not offices. */
  locations: readonly { city: string; address: string | null }[];
  /** Enquiry types in order. Mailboxes are never read into the view. */
  enquiryTypes: readonly { slug: string; name: string }[];
}

export function toStaticContactView(records: StaticContactRecords): StaticContactView {
  const content = staticContactContentSchema.parse(records.contentSetting);
  const descriptions = new Map(content.routing.descriptions.map((item) => [item.slug, item.body]));
  return staticContactViewSchema.parse({
    content,
    contact: siteContactSchema.parse(records.contactSetting),
    offices: records.locations.flatMap((location) =>
      location.address?.trim() ? [{ city: location.city, address: location.address }] : [],
    ),
    enquiryTypes: records.enquiryTypes.map((type) => ({
      slug: type.slug,
      name: type.name,
      description: descriptions.get(type.slug) ?? null,
    })),
  });
}

export interface StaticFaqRecords {
  contentSetting: unknown;
  /** Site-wide questions in any group, in order. */
  faqs: readonly Faq[];
}

/** The group keys the FAQ page lists, so the service queries only those. Empty when the copy is malformed. */
export function staticFaqGroupKeys(contentSetting: unknown): string[] {
  const content = staticFaqContentSchema.safeParse(contentSetting);
  return content.success ? content.data.groups.map((group) => group.key) : [];
}

export function toStaticFaqView(records: StaticFaqRecords): StaticFaqView {
  const { groups, ...content } = staticFaqContentSchema.parse(records.contentSetting);
  return staticFaqViewSchema.parse({
    ...content,
    groups: groups
      .map((group) => ({ ...group, items: staticFaqItems(records.faqs.filter((faq) => faq.group === group.key)) }))
      .filter((group) => group.items.length > 0),
  });
}

export interface StaticThankYouRecords {
  type: string;
  contentSetting: unknown;
  contactSetting: unknown;
}

/** The thank-you page for a conversion type, or null when the copy has no page for it. */
export function toStaticThankYouView(records: StaticThankYouRecords): StaticThankYouView | null {
  const { pages, ...shared } = staticThankYouContentSchema.parse(records.contentSetting);
  const page = pages.find((item) => item.type === records.type);
  if (!page) return null;
  return staticThankYouViewSchema.parse({ ...page, ...shared, contact: siteContactSchema.parse(records.contactSetting) });
}

export interface StaticLegalRecords {
  slug: StaticLegalSlug;
  contentSetting: unknown;
  contactSetting: unknown;
}

export function toStaticLegalView(records: StaticLegalRecords): StaticLegalView {
  const content = staticLegalContentSchema.parse(records.contentSetting);
  if (content.slug !== records.slug) {
    throw new Error(`The copy stored for "${records.slug}" belongs to "${content.slug}"`);
  }
  return staticLegalViewSchema.parse({ ...content, contact: siteContactSchema.parse(records.contactSetting) });
}
