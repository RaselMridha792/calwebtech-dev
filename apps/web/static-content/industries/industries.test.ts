import { readdirSync } from 'node:fs';
import path from 'node:path';
import { industriesIndexViewSchema, industryDetailViewSchema, industryPath } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { unfinishedCopy } from '../copy-rules';
import { industriesIndexSnapshot, industrySnapshots } from './index';

const detailFiles = readdirSync(import.meta.dirname).filter((file) => file.endsWith('.json') && file !== 'index.json');

/** Proof in the approved demo content (home.json, the landing page and reference/*.html). */
const APPROVED_CLIENTS = ['Northmark Supply', 'Verona Home', 'Truvia Labs', 'Cascadia Health', 'Meridian Parts'];
const APPROVED_QUOTES = ['Dale Ferris', 'Priya Raman', 'Marcus Bell'];

describe('industries snapshots', () => {
  it('match the index contract, with publish-ready copy, listing every industry page', () => {
    const view = industriesIndexViewSchema.parse(industriesIndexSnapshot);
    expect(unfinishedCopy(industriesIndexSnapshot)).toEqual([]);
    expect(view.industries.map((industry) => industry.slug)).toEqual(Object.keys(industrySnapshots));
  });

  it('register every detail file under the slug it is named after', () => {
    const names = detailFiles.map((file) => path.basename(file, '.json'));
    expect(names.sort()).toEqual(Object.keys(industrySnapshots).sort());
  });

  it.each(Object.entries(industrySnapshots))('%s matches the detail contract, with publish-ready copy', (slug, snapshot) => {
    const view = industryDetailViewSchema.parse(snapshot);
    expect(view.slug).toBe(slug);
    expect(industryPath(view.slug)).toBe(`/industries/${slug}/`);
    expect(unfinishedCopy(snapshot)).toEqual([]);
    expect(view.painPoints?.items).toHaveLength(4);
    expect(view.faq?.items.length).toBeGreaterThanOrEqual(5);
    expect(view.faq?.items.length).toBeLessThanOrEqual(6);
  });

  it.each(Object.entries(industrySnapshots))('%s reuses only approved proof', (slug, snapshot) => {
    const view = industryDetailViewSchema.parse(snapshot);
    for (const card of view.caseStudies?.items ?? []) expect(APPROVED_CLIENTS).toContain(card.clientName);
    if (view.caseStudies) expect(view.caseStudies.link.href).toBe(`/work/?industry=${slug}`);
    const quote = view.results?.testimonial;
    if (quote) expect(APPROVED_QUOTES).toContain(quote.clientName);

    // Every figure in the band is one a case study on the same page carries.
    const shown = new Set(
      view.caseStudies?.items.flatMap((card) => card.metrics.map((metric) => `${card.clientName}: ${metric.value}`)),
    );
    for (const metric of view.results?.metrics ?? []) expect(shown).toContain(`${metric.clientName}: ${metric.value}`);
  });
});
