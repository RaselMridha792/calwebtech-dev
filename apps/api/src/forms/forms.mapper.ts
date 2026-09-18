import type { Faq, Service } from '@calwebtech/db';
import {
  faqItemSchema,
  formsAuditContentSchema,
  formsAuditViewSchema,
  formsProjectContentSchema,
  formsProjectViewSchema,
  type FaqItem,
  type FormsAuditView,
  type FormsProjectView,
} from '@calwebtech/shared';

/*
 * The forms family's views (docs/10-site-pages.md): `/start-a-project/` and
 * `/free-website-audit/`. Copy comes from the `forms.*` settings and the tickable services
 * from published `Service` rows. Both functions are pure and end in the shared schema's
 * `parse`, so malformed copy fails here rather than rendering half a page.
 */

/** Questions a buyer can read; a row that is not a question, or has no answer, is left out. */
export function formsFaqItems(faqs: readonly Pick<Faq, 'id' | 'question' | 'answer'>[]): FaqItem[] {
  return faqs.flatMap((faq) => {
    const item = faqItemSchema.safeParse({ id: faq.id, question: faq.question, answer: faq.answer });
    return item.success ? [item.data] : [];
  });
}

export interface FormsProjectRecords {
  contentSetting: unknown;
  /** Published services in order; the brief's "what do you need" step ticks these. */
  services: readonly Pick<Service, 'slug' | 'title'>[];
  /** Site-wide questions in the start-a-project group, in order. */
  faqs: readonly Faq[];
}

export function toFormsProjectView(records: FormsProjectRecords): FormsProjectView {
  return formsProjectViewSchema.parse({
    content: formsProjectContentSchema.parse(records.contentSetting),
    services: records.services.map((service) => ({ slug: service.slug, title: service.title })),
    faqs: formsFaqItems(records.faqs),
  });
}

export interface FormsAuditRecords {
  contentSetting: unknown;
  /** Site-wide questions in the free-website-audit group, in order. */
  faqs: readonly Faq[];
}

export function toFormsAuditView(records: FormsAuditRecords): FormsAuditView {
  return formsAuditViewSchema.parse({
    content: formsAuditContentSchema.parse(records.contentSetting),
    faqs: formsFaqItems(records.faqs),
  });
}
