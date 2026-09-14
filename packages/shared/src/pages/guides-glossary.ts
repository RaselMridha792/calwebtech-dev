import { z } from 'zod';
import { linkSchema } from '../home-page';
import { imageSchema } from '../media';
import { slugSchema } from '../seo';
import {
  answerBlockSchema,
  countSentences,
  faqItemSchema,
  metricSchema,
  pageSeoSchema,
  questionSchema,
  requiredText,
} from './common';

/**
 * The guides and glossary family (docs/10-site-pages.md): `/guides/` and `/guides/<slug>/`,
 * an ungated summary that ranks on its own followed by an email gate for the full download,
 * and `/glossary/` with an A to Z index and `/glossary/<term>/` (docs/03-page-specs.md,
 * "Insights, glossary, guides").
 *
 * Bodies are structured fields, not markup: a guide summary is sections of paragraphs and
 * bullets, a glossary term is paragraphs. Nothing here needs a Markdown or MDX renderer.
 */

/** Routes of this family. `SITE_ROUTES` is the foundation's and does not carry them yet. */
export const GUIDES_ROUTE = '/guides/';
export const GLOSSARY_ROUTE = '/glossary/';

export const guidePath = (slug: string): string => `/guides/${slug}/`;
export const glossaryTermPath = (slug: string): string => `/glossary/${slug}/`;

/** Setting rows of this family: the copy of the two index pages, which have no record. */
export const GUIDES_GLOSSARY_SETTING_KEYS = {
  /** Copy of `/guides/`, validated by guidesIndexContentSchema. */
  guides: 'guides.index',
  /** Copy of `/glossary/`, validated by glossaryIndexContentSchema. */
  glossary: 'glossary.index',
} as const;

/** The gate's section id; the hero's call to action links to it, and the summary stays above it. */
export const GUIDE_GATE_ANCHOR = 'download';

/** The form id a guide download is stored with (`LeadAttribution.formId`). */
export const GUIDE_GATE_FORM_ID = 'guide-download';

/** How many related terms a glossary page lists, and how many guides a guide page suggests. */
export const GLOSSARY_RELATED_LIMIT = 4;
export const GUIDE_RELATED_LIMIT = 2;
export const GUIDE_FAQ_LIMIT = 6;

/** The letter a term is filed under on the A to Z index. Anything not A to Z files under "#". */
export function glossaryLetter(term: string): string {
  const first = term.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** One paragraph per block of text, blank lines between them, whitespace collapsed. */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length > 0);
}

/** Sentences of a paragraph, split the way `countSentences` counts them. */
export function splitSentences(text: string): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return [];
  return flat.split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[A-Z0-9])/u);
}

/**
 * The answer block of a glossary term: the one-sentence definition, then enough of the
 * body to make two or three complete sentences. Null when the record cannot make one, so a
 * thin term still renders rather than failing its page.
 */
export function glossaryAnswer(definition: string, body: string): string | null {
  const sentences = [definition.replace(/\s+/g, ' ').trim(), ...splitSentences(splitParagraphs(body)[0] ?? '')];
  for (const take of [3, 2]) {
    const text = sentences.slice(0, take).join(' ');
    if (answerBlockSchema.safeParse(text).success) return text;
  }
  return null;
}

/**
 * The ungated summary of a guide, built from the `Guide.summary` column so a guide
 * published from the dashboard renders a complete page with no deploy:
 *
 * - a block on its own line that ends in a question mark starts a section and is its H2;
 * - a block whose first line starts with "- " holds that section's bullets, one per line;
 * - every other block is a paragraph.
 *
 * Blocks before the first question go into an opening section with no heading.
 *
 * A bullet block is split on the line each bullet starts, never on the hyphens inside one,
 * so an editor can write "- Content audit - what you already have" and still get one bullet.
 */
export function guideSummarySections(summary: string): GuideSection[] {
  const sections: GuideSection[] = [];
  for (const raw of summary.split(/\n\s*\n/)) {
    const isBullets = /^\s*-\s+/.test(raw);
    const block = raw.replace(/\s+/g, ' ').trim();
    if (block.length === 0) continue;
    const isHeading = !isBullets && block.endsWith('?') && block.length <= 160 && countSentences(block) === 1;
    if (isHeading || sections.length === 0) {
      sections.push({
        id: `section-${String(sections.length + 1)}`,
        heading: isHeading ? block : null,
        paragraphs: [],
        bullets: [],
      });
      if (isHeading) continue;
    }
    const section = sections.at(-1);
    if (!section) continue;
    if (isBullets) {
      section.bullets.push(
        ...raw
          .split(/\n\s*-\s+/)
          .map((item) =>
            item
              .replace(/^\s*-\s+/, '')
              .replace(/\s+/g, ' ')
              .trim(),
          )
          .filter((item) => item.length > 0),
      );
    } else {
      section.paragraphs.push(block);
    }
  }
  return sections.filter(
    (section) => section.heading !== null || section.paragraphs.length > 0 || section.bullets.length > 0,
  );
}

/** A section of a guide's ungated summary. The first may open without a heading. */
export const guideSectionSchema = z.object({
  id: z.string().min(1).max(60),
  /** An H2, written as the question a buyer types. Null only on the opening section. */
  heading: questionSchema().nullable(),
  paragraphs: z.array(requiredText(1600)).max(12),
  bullets: z.array(requiredText(400)).max(12),
});
export type GuideSection = z.output<typeof guideSectionSchema>;

/** A guide on the index, in related guides and in the sitemap. */
export const guideCardSchema = z.object({
  slug: slugSchema,
  title: requiredText(140),
  /** One line describing what the guide answers. */
  summary: requiredText(300),
  /** "32 pages", or null when the record does not say. */
  pageCountLabel: requiredText(40).nullable(),
  cover: imageSchema.nullable(),
  /** What the guide covers, for the card's tag row. */
  topics: z.array(requiredText(40)).max(5),
  updatedAt: z.iso.datetime().nullable(),
});
export type GuideCard = z.output<typeof guideCardSchema>;

/** A glossary term on the index, in related terms and on a guide page. */
export const glossaryTermCardSchema = z.object({
  slug: slugSchema,
  term: requiredText(80),
  /** The one-sentence definition, as the index and the related list show it. */
  definition: requiredText(240),
});
export type GlossaryTermCard = z.output<typeof glossaryTermCardSchema>;

/** The delivering service a term or guide points at, from the published Service record. */
export const deliveringServiceSchema = z.object({
  slug: slugSchema,
  title: requiredText(120),
  line: requiredText(300).nullable(),
});

/**
 * What `GET /pages/guides/:slug` returns, and what each guide snapshot holds. The summary
 * is always rendered; the gate only stands between the visitor and the download file.
 */
export const guideDetailViewSchema = z.object({
  slug: slugSchema,
  title: requiredText(140),
  updatedAt: z.iso.datetime().nullable(),
  seo: pageSeoSchema,
  /** Built from the opening of the summary, so the page still answers first. */
  answerBlock: answerBlockSchema.nullable(),
  hero: z.object({
    intro: requiredText(600).nullable(),
    /** "32 pages", "PDF": what the visitor is about to download. */
    pageCountLabel: requiredText(40).nullable(),
    formatLabel: requiredText(40),
    ctaLabel: requiredText(40),
    cover: imageSchema.nullable(),
  }),
  /** The ungated summary: substantial enough to rank on its own (docs/03). */
  summary: z.object({
    heading: questionSchema(),
    intro: requiredText(600).nullable(),
    sections: z.array(guideSectionSchema).min(1).max(12),
  }),
  takeaways: z.object({ heading: questionSchema(), items: z.array(requiredText(300)).min(3).max(8) }).nullable(),
  /** The email gate. `fileUrl` is only reached once the lead is stored. */
  gate: z.object({
    heading: questionSchema(),
    intro: requiredText(600).nullable(),
    submitLabel: requiredText(40),
    footnote: requiredText(300).nullable(),
    fileUrl: z.string().trim().min(1).max(2000),
    fileLabel: requiredText(60),
    success: z.object({ heading: requiredText(80), body: requiredText(300), downloadLabel: requiredText(60) }),
  }),
  faq: z
    .object({
      heading: questionSchema(),
      intro: requiredText(600).nullable(),
      items: z.array(faqItemSchema).min(1).max(GUIDE_FAQ_LIMIT),
    })
    .nullable(),
  /** The service this guide's work belongs to, so the page is not an orphan. */
  service: z
    .object({ heading: questionSchema(), intro: requiredText(600).nullable(), item: deliveringServiceSchema })
    .nullable(),
  related: z
    .object({
      heading: questionSchema(),
      guides: z.array(guideCardSchema).max(GUIDE_RELATED_LIMIT),
      terms: z.array(glossaryTermCardSchema).max(GLOSSARY_RELATED_LIMIT),
    })
    .nullable(),
  /**
   * Where the figures in the copy come from. Every established public fact a guide quotes
   * is linked to the source that published it (owner's content rule, 2026-09-14).
   */
  sources: z.object({ heading: questionSchema(), items: z.array(linkSchema).min(1).max(8) }).nullable(),
});
export type GuideDetailView = z.output<typeof guideDetailViewSchema>;

/** Copy of `/guides/`, stored in the `guides.index` setting. */
export const guidesIndexContentSchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(120),
  answerBlock: answerBlockSchema,
  intro: requiredText(600),
  list: z.object({
    heading: questionSchema(),
    intro: requiredText(600).nullable().default(null),
    /** Shown while no guide is published. */
    empty: requiredText(300),
    cardLinkLabel: requiredText(40),
  }),
  /** What a visitor gives and gets: the gate, said plainly, before they reach a form. */
  gateNote: z.object({ heading: questionSchema(), body: requiredText(800) }),
  /** Where to go instead while a guide is not the answer. */
  elsewhere: z.object({
    heading: questionSchema(),
    body: requiredText(600),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable().default(null),
  }),
});
export type GuidesIndexContent = z.output<typeof guidesIndexContentSchema>;
export type GuidesIndexContentInput = z.input<typeof guidesIndexContentSchema>;

/** What `GET /pages/guides` returns, and what the guides index snapshot holds. */
export const guidesIndexViewSchema = z.object({
  content: guidesIndexContentSchema,
  guides: z.array(guideCardSchema),
});
export type GuidesIndexView = z.output<typeof guidesIndexViewSchema>;

/** What `GET /pages/glossary/:slug` returns, and what each term snapshot holds. */
export const glossaryTermViewSchema = z.object({
  slug: slugSchema,
  term: requiredText(80),
  /** The letter it is filed under on the index. */
  letter: z.string().length(1),
  updatedAt: z.iso.datetime(),
  seo: pageSeoSchema,
  /** One sentence, rendered first under the H1 and used as the DefinedTerm description. */
  definition: requiredText(240),
  /** The definition and the sentences after it, as the extraction target. */
  answerBlock: answerBlockSchema.nullable(),
  body: z.object({ heading: questionSchema(), paragraphs: z.array(requiredText(1600)).min(1).max(6) }),
  /** Why it matters commercially, which is what a buyer actually came for. */
  commercial: z
    .object({ heading: questionSchema(), paragraphs: z.array(requiredText(1600)).min(1).max(4) })
    .nullable(),
  /** A concrete example, from an approved case study where one fits. */
  example: z
    .object({
      heading: questionSchema(),
      body: requiredText(1600),
      caseStudy: z
        .object({ slug: slugSchema, clientName: requiredText(120), metric: metricSchema })
        .nullable(),
    })
    .nullable(),
  /** The service that delivers this work. */
  service: deliveringServiceSchema.nullable(),
  related: z.object({ heading: questionSchema(), terms: z.array(glossaryTermCardSchema).min(1) }).nullable(),
  /** Public sources for any established figure or threshold the entry quotes. */
  sources: z.array(linkSchema).max(6).default([]),
});
export type GlossaryTermView = z.output<typeof glossaryTermViewSchema>;

/** Copy of `/glossary/`, stored in the `glossary.index` setting. */
export const glossaryIndexContentSchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(120),
  answerBlock: answerBlockSchema,
  intro: requiredText(600),
  /** Label of the A to Z jump links, read by assistive technology. */
  jumpLabel: requiredText(80),
  list: z.object({
    heading: questionSchema(),
    intro: requiredText(600).nullable().default(null),
    empty: requiredText(300),
  }),
  /** How the entries are written and kept current. */
  method: z.object({ heading: questionSchema(), body: requiredText(800) }),
  elsewhere: z.object({
    heading: questionSchema(),
    body: requiredText(600),
    primaryCta: linkSchema,
    secondaryCta: linkSchema.nullable().default(null),
  }),
});
export type GlossaryIndexContent = z.output<typeof glossaryIndexContentSchema>;
export type GlossaryIndexContentInput = z.input<typeof glossaryIndexContentSchema>;

/** What `GET /pages/glossary` returns, and what the glossary index snapshot holds. */
export const glossaryIndexViewSchema = z.object({
  content: glossaryIndexContentSchema,
  /** Letters in order, each with the terms filed under it. Empty letters are left out. */
  groups: z.array(
    z.object({ letter: z.string().length(1), terms: z.array(glossaryTermCardSchema).min(1) }),
  ),
  /** The most recent change to any published term, for the index's "last updated" line. */
  updatedAt: z.iso.datetime().nullable(),
});
export type GlossaryIndexView = z.output<typeof glossaryIndexViewSchema>;

/** Groups term cards by letter, in A to Z order with "#" last, the way the index shows them. */
export function glossaryGroups(terms: readonly GlossaryTermCard[]): { letter: string; terms: GlossaryTermCard[] }[] {
  const groups = new Map<string, GlossaryTermCard[]>();
  for (const term of terms) {
    const letter = glossaryLetter(term.term);
    const bucket = groups.get(letter);
    if (bucket) bucket.push(term);
    else groups.set(letter, [term]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, list]) => ({ letter, terms: [...list].sort((a, b) => a.term.localeCompare(b.term)) }));
}
