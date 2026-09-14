import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  countSentences,
  homePageViewSchema,
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workIndexViewSchema,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import home from '../home.json';
import { unfinishedCopy } from '../copy-rules';
import { workBeforeAndAfterSnapshot, workCaseStudySnapshots, workIndexSnapshot } from './index';

const FOLDER = import.meta.dirname;
const approved = homePageViewSchema.parse(home);

describe('work snapshots', () => {
  it('match the index contract, with publish-ready copy', () => {
    const view = workIndexViewSchema.parse(workIndexSnapshot);
    expect(unfinishedCopy(view)).toEqual([]);
    expect(view.caseStudies.length).toBeGreaterThan(0);
  });

  it('match the case study contract, one file per slug, with publish-ready copy', () => {
    const files = readdirSync(FOLDER).filter((file) => file.endsWith('.json') && !['index.json', 'before-and-after.json'].includes(file));
    expect(files.map((file) => path.basename(file, '.json')).sort()).toEqual(Object.keys(workCaseStudySnapshots).sort());

    for (const [slug, snapshot] of Object.entries(workCaseStudySnapshots)) {
      const view = workCaseStudyViewSchema.parse(snapshot);
      expect(view.slug, `${slug}.json`).toBe(slug);
      expect(unfinishedCopy(view), `${slug}.json`).toEqual([]);
      expect(countSentences(view.answerBlock)).toBeGreaterThanOrEqual(2);
    }
  });

  it('match the before and after contract, with publish-ready copy', () => {
    const view = workBeforeAndAfterViewSchema.parse(workBeforeAndAfterSnapshot);
    expect(unfinishedCopy(view)).toEqual([]);
  });

  it('list every case study once on the index, each with a page of its own', () => {
    const view = workIndexViewSchema.parse(workIndexSnapshot);
    expect(view.caseStudies.map((card) => card.slug).sort()).toEqual(Object.keys(workCaseStudySnapshots).sort());
  });

  it('offer only filter values some case study carries, and every value a case study carries', () => {
    const view = workIndexViewSchema.parse(workIndexSnapshot);
    const carried = (pick: (card: (typeof view.caseStudies)[number]) => readonly (string | null)[]) =>
      [...new Set(view.caseStudies.flatMap(pick).filter((slug): slug is string => slug !== null))].sort();
    expect(view.filters.industries.map((term) => term.slug).sort()).toEqual(carried((card) => [card.industry]));
    expect(view.filters.services.map((term) => term.slug).sort()).toEqual(carried((card) => card.services));
    expect(view.filters.platforms.map((term) => term.slug).sort()).toEqual(carried((card) => card.platforms));
  });

  it('reuse the approved proof: the homepage summaries, figures and quotes, with no new figures', () => {
    const index = workIndexViewSchema.parse(workIndexSnapshot);
    for (const project of approved.projects) {
      const card = index.caseStudies.find((item) => item.slug === project.slug);
      expect(card, project.slug).toBeDefined();
      expect(card?.summary).toBe(project.summary);
      expect(card?.metrics).toEqual(project.metrics);

      const page = workCaseStudyViewSchema.parse(workCaseStudySnapshots[project.slug]);
      expect(page.metrics).toEqual(project.metrics);
      if (page.quote) {
        const quotes = [...approved.testimonials, ...approved.projects.flatMap((item) => (item.quote ? [item.quote] : []))];
        expect(quotes.map((quote) => quote.quote)).toContain(page.quote.quote);
        expect(page.quote.company).toBe(project.clientName);
      }
    }
  });

  it('show the same card for a case study wherever it appears, and headings written as questions', () => {
    const index = workIndexViewSchema.parse(workIndexSnapshot);
    const cards = new Map(index.caseStudies.map((card) => [card.slug, card]));
    for (const [slug, snapshot] of Object.entries(workCaseStudySnapshots)) {
      const page = workCaseStudyViewSchema.parse(snapshot);
      for (const related of page.relatedCaseStudies) expect(related, `${slug} links ${related.slug}`).toEqual(cards.get(related.slug));
      expect(page.relatedCaseStudies.map((card) => card.slug)).not.toContain(slug);
      const card = cards.get(slug);
      expect(page.metrics.slice(0, 3)).toEqual(card?.metrics);
      expect(page.atAGlance.industry?.slug ?? null).toBe(card?.industry);
      expect(page.atAGlance.services.map((service) => service.slug)).toEqual(card?.services);
      expect(page.relatedServices.map((service) => service.slug)).toEqual(card?.services);
      expect(page.headline.metric).toEqual(page.metrics[0]);
      for (const heading of Object.values(page.headings)) expect(heading).toMatch(/\?$/);
    }
  });

  it('show the approved before and after comparison with its approved figures', () => {
    const view = workBeforeAndAfterViewSchema.parse(workBeforeAndAfterSnapshot);
    const comparison = view.comparisons.find((item) => item.clientName === approved.beforeAfter?.clientName);
    expect(comparison).toBeDefined();
    expect(comparison?.metrics).toEqual(approved.beforeAfter?.metrics);
    expect(comparison?.before).toEqual(approved.beforeAfter?.before);
    expect(comparison?.after).toEqual(approved.beforeAfter?.after);
  });

  it('link the menus’ filtered work links to results', () => {
    const view = workIndexViewSchema.parse(workIndexSnapshot);
    for (const service of ['custom-website-development', 'ecommerce-development', 'web-application-development', 'ai-search-visibility']) {
      expect(view.caseStudies.some((card) => card.services.includes(service)), service).toBe(true);
    }
  });
});
