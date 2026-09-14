import {
  GLOSSARY_RELATED_LIMIT,
  answerBlockSchema,
  glossaryIndexViewSchema,
  glossaryLetter,
  glossaryTermViewSchema,
  guideDetailViewSchema,
  guidesIndexViewSchema,
  type GlossaryTermView,
  type GuideDetailView,
} from '@calwebtech/shared';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { unfinishedCopy } from '../copy-rules';
import home from '../home.json';
import {
  glossaryIndexSnapshot,
  glossaryTermSnapshot,
  glossaryTermSnapshots,
  guideSnapshot,
  guideSnapshots,
  guidesIndexSnapshot,
} from './index';

const LAUNCH_GUIDES = ['b2b-website-planning-guide', 'core-web-vitals-guide'];

const guides: [string, GuideDetailView][] = Object.entries(guideSnapshots).map(([slug, view]) => [
  slug,
  guideDetailViewSchema.parse(view),
]);
const terms: [string, GlossaryTermView][] = Object.entries(glossaryTermSnapshots).map(([slug, view]) => [
  slug,
  glossaryTermViewSchema.parse(view),
]);
const guidesIndex = guidesIndexViewSchema.parse(guidesIndexSnapshot);
const glossaryIndex = glossaryIndexViewSchema.parse(glossaryIndexSnapshot);

/** A sibling family's snapshot, or null while it is not on this branch. */
function siblingSnapshot<T>(file: string, schema: z.ZodType<T>): T | null {
  const path = join(import.meta.dirname, '..', file);
  return existsSync(path) ? schema.parse(JSON.parse(readFileSync(path, 'utf8'))) : null;
}

const servicesIndex = siblingSnapshot(
  'services/index.json',
  z.object({
    groups: z.array(z.object({ services: z.array(z.object({ slug: z.string(), title: z.string(), summary: z.string() })) })),
  }),
);
const services = new Map(
  (servicesIndex?.groups ?? []).flatMap((group) => group.services).map((service) => [service.slug, service]),
);

/** Every string anywhere in a view, for the proof checks. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

function summaryWords(view: GuideDetailView): number {
  return view.summary.sections
    .flatMap((section) => [section.heading ?? '', ...section.paragraphs, ...section.bullets])
    .join(' ')
    .trim()
    .split(/\s+/).length;
}

describe('guides snapshots', () => {
  it('hold the launch guides, one file per view, each named after its slug', () => {
    expect(Object.keys(guideSnapshots).sort()).toEqual([...LAUNCH_GUIDES].sort());
    const files = readdirSync(join(import.meta.dirname, 'guides')).filter((file) => file.endsWith('.json'));
    expect(files.sort()).toEqual(['index.json', ...LAUNCH_GUIDES.map((slug) => `${slug}.json`)].sort());
    for (const [slug, view] of guides) expect(view.slug, `${slug}.json`).toBe(slug);
  });

  it('list every guide on the index with the same card copy', () => {
    expect(guidesIndex.guides.map((guide) => guide.slug).sort()).toEqual([...LAUNCH_GUIDES].sort());
    for (const card of guidesIndex.guides) {
      const view = guides.find(([slug]) => slug === card.slug)?.[1];
      expect(card.title).toBe(view?.title);
      expect(card.pageCountLabel).toBe(view?.hero.pageCountLabel);
      expect(card.cover).toEqual(view?.hero.cover);
    }
  });

  it('open with an answer block and carry an ungated summary long enough to rank alone', () => {
    for (const [slug, view] of guides) {
      expect(answerBlockSchema.safeParse(view.answerBlock).success, slug).toBe(true);
      const words = summaryWords(view);
      expect(words, `${slug}: ${String(words)} words`).toBeGreaterThanOrEqual(600);
      expect(words, `${slug}: ${String(words)} words`).toBeLessThanOrEqual(900);
      // Every section after the opening one is a question a buyer types.
      expect(view.summary.sections[0]?.heading).toBeNull();
      for (const section of view.summary.sections.slice(1)) expect(section.heading, slug).toMatch(/\?$/);
      expect(new Set(view.summary.sections.map((section) => section.id)).size).toBe(view.summary.sections.length);
    }
  });

  it('put the download behind the gate, and the file it names exists in public/', () => {
    for (const [slug, view] of guides) {
      expect(view.gate.fileUrl, slug).toBe(`/guides/${slug}.pdf`);
      const file = join(import.meta.dirname, '..', '..', 'public', 'guides', `${slug}.pdf`);
      expect(existsSync(file), `${slug}.pdf is published`).toBe(true);
      expect(statSync(file).size, `${slug}.pdf is a real file`).toBeGreaterThan(20_000);
      // The page count on the page is the page count of the file that is actually served.
      const pages = (readFileSync(file).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(view.gate.fileLabel, slug).toBe(`PDF, ${String(pages)} pages`);
      expect(view.hero.pageCountLabel, slug).toBe(`${String(pages)} pages`);
    }
  });

  it('link the service that delivers the work and name it the way the services family does', () => {
    for (const [slug, view] of guides) {
      expect(view.service, slug).not.toBeNull();
      const listed = services.get(view.service?.item.slug ?? '');
      if (!listed) continue;
      expect(view.service?.item.title).toBe(listed.title);
      expect(view.service?.item.line).toBe(listed.summary);
    }
  });

  it('cite a public source for every established figure they quote', () => {
    for (const [slug, view] of guides) {
      expect(view.sources?.items.length, slug).toBeGreaterThan(0);
      for (const source of view.sources?.items ?? []) expect(source.href, slug).toMatch(/^https:\/\//);
    }
  });

  it('relate the other guide and only terms that are published here', () => {
    for (const [slug, view] of guides) {
      for (const related of view.related?.guides ?? []) expect(related.slug, slug).not.toBe(slug);
      for (const term of view.related?.terms ?? []) {
        expect(Object.hasOwn(glossaryTermSnapshots, term.slug), `${slug}: ${term.slug}`).toBe(true);
      }
      expect(view.related?.terms.length ?? 0, slug).toBeLessThanOrEqual(GLOSSARY_RELATED_LIMIT);
    }
  });
});

describe('glossary snapshots', () => {
  it('hold thirty to forty terms, one file per view, each named after its slug', () => {
    const slugs = Object.keys(glossaryTermSnapshots);
    expect(slugs.length).toBeGreaterThanOrEqual(30);
    expect(slugs.length).toBeLessThanOrEqual(40);
    const files = readdirSync(join(import.meta.dirname, 'glossary')).filter((file) => file.endsWith('.json'));
    expect(files.sort()).toEqual(['index.json', ...slugs.map((slug) => `${slug}.json`)].sort());
    for (const [slug, view] of terms) expect(view.slug, `${slug}.json`).toBe(slug);
  });

  it('group every term on the index A to Z, with "#" last and nothing missing', () => {
    const listed = glossaryIndex.groups.flatMap((group) => group.terms.map((term) => term.slug));
    expect([...listed].sort()).toEqual(Object.keys(glossaryTermSnapshots).sort());
    for (const group of glossaryIndex.groups) {
      for (const card of group.terms) {
        expect(glossaryLetter(card.term), card.slug).toBe(group.letter);
        const view = terms.find(([slug]) => slug === card.slug)?.[1];
        expect(card.term).toBe(view?.term);
        expect(card.definition).toBe(view?.definition);
      }
    }
    const letters = glossaryIndex.groups.map((group) => group.letter);
    expect([...letters].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))).toEqual(letters);
  });

  it('open each term with a one-sentence definition inside a complete answer block', () => {
    for (const [slug, view] of terms) {
      expect(answerBlockSchema.safeParse(view.answerBlock).success, slug).toBe(true);
      expect(view.answerBlock?.startsWith(view.definition), slug).toBe(true);
      expect(view.definition.endsWith('.'), slug).toBe(true);
      expect(view.letter, slug).toBe(glossaryLetter(view.term));
    }
  });

  it('give every term the sections docs/03 asks for: meaning, commerce, example and a service', () => {
    for (const [slug, view] of terms) {
      expect(view.body.paragraphs.length, slug).toBeGreaterThanOrEqual(2);
      expect(view.body.heading, slug).toMatch(/\?$/);
      expect(view.commercial?.heading, slug).toMatch(/\?$/);
      expect(view.example?.body, slug).toBeTruthy();
      expect(view.service, slug).not.toBeNull();
      expect(view.related?.terms.length ?? 0, slug).toBeLessThanOrEqual(GLOSSARY_RELATED_LIMIT);
    }
  });

  it('relate the terms the same delivering service covers, the way the API does', () => {
    const byService = new Map<string, string[]>();
    for (const [slug, view] of terms) {
      const service = view.service?.slug ?? '';
      byService.set(service, [...(byService.get(service) ?? []), slug]);
    }
    for (const [slug, view] of terms) {
      const siblings = (byService.get(view.service?.slug ?? '') ?? [])
        .filter((other) => other !== slug)
        .map((other) => terms.find(([key]) => key === other)?.[1])
        .filter((other): other is GlossaryTermView => other !== undefined)
        .sort((a, b) => a.term.localeCompare(b.term))
        .slice(0, GLOSSARY_RELATED_LIMIT)
        .map((other) => other.slug);
      expect(view.related?.terms.map((term) => term.slug) ?? [], slug).toEqual(siblings);
    }
  });

  it('name each delivering service exactly as the services family lists it', () => {
    for (const [slug, view] of terms) {
      const listed = services.get(view.service?.slug ?? '');
      if (!listed) continue;
      expect({ title: view.service?.title, line: view.service?.line }, slug).toEqual({
        title: listed.title,
        line: listed.summary,
      });
    }
  });
});

describe('guides and glossary copy', () => {
  it('is publish-ready: nothing empty and nothing unfinished', () => {
    expect(unfinishedCopy(guidesIndex)).toEqual([]);
    expect(unfinishedCopy(glossaryIndex)).toEqual([]);
    for (const [slug, view] of guides) expect(unfinishedCopy(view), slug).toEqual([]);
    for (const [slug, view] of terms) expect(unfinishedCopy(view), slug).toEqual([]);
  });

  it('reuses only approved proof: every example figure is a homepage case study figure', () => {
    const approved = new Map(home.projects.map((project) => [project.slug, project]));
    for (const [slug, view] of terms) {
      const study = view.example?.caseStudy;
      if (!study) continue;
      const project = approved.get(study.slug);
      expect(project, `${slug}: ${study.slug}`).toBeDefined();
      expect(study.clientName).toBe(project?.clientName);
      expect(project?.metrics, `${slug}: ${study.metric.value}`).toContainEqual(study.metric);
    }
  });

  it('invents no client, and quotes only figures that are approved proof or a linked standard', () => {
    // Percentages and money anywhere in the copy must be an approved figure, sign aside.
    const bare = (figure: string) => figure.replace(/^[−+-]/, '');
    const approvedFigures = new Set(
      [
        ...home.projects.flatMap((project) => project.metrics.map((metric) => metric.value)),
        // The approved price points of the landing page and the pricing tiers.
        '$12,000',
        '$25,000',
        '$60,000',
        '$1,500',
      ].map(bare),
    );
    for (const [slug, view] of [...terms, ...guides]) {
      const text = strings(view).join(' ');
      for (const figure of text.match(/[−+-]?\d[\d,.]*%|\$\d[\d,.]*[MmKk]?/g) ?? []) {
        expect(approvedFigures, `${slug}: ${figure}`).toContain(bare(figure));
      }
    }
  });

  it('returns nothing for a slug that is not an own key, so the page is a 404', () => {
    for (const slug of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'unknown-term']) {
      expect(guideSnapshot(slug)).toBeUndefined();
      expect(glossaryTermSnapshot(slug)).toBeUndefined();
    }
    expect(guideSnapshot('core-web-vitals-guide')).toBe(guideSnapshots['core-web-vitals-guide']);
    expect(glossaryTermSnapshot('headless-cms')).toBe(glossaryTermSnapshots['headless-cms']);
  });
});
