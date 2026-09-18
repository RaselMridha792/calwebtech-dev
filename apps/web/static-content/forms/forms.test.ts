import {
  FORMS_PROJECT_STEPS,
  FORMS_ROUTES,
  countSentences,
  formsAuditViewSchema,
  formsProjectViewSchema,
} from '@calwebtech/shared';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { unfinishedCopy } from '../copy-rules';
import { formsAuditSnapshot, formsProjectSnapshot } from './index';

// The getter module is server-only; the test needs its sitemap entries, not a server.
vi.mock('server-only', () => ({}));

const here = import.meta.dirname;
const jsonFiles = fs
  .readdirSync(here)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

/**
 * The forms family's snapshots (docs/10-site-pages.md): each is exactly what its endpoint
 * returns, matches the contract and carries publish-ready copy.
 */
describe('forms family snapshots', () => {
  it('has one file per page, named after its route', () => {
    expect(jsonFiles).toEqual(Object.values(FORMS_ROUTES).map((route) => route.replaceAll('/', '')).sort());
  });

  it('the start a project page matches its contract and has no unfinished copy', () => {
    const view = formsProjectViewSchema.parse(formsProjectSnapshot);
    expect(unfinishedCopy(view)).toEqual([]);
    expect(view.content.form.steps.map((step) => step.key)).toEqual([...FORMS_PROJECT_STEPS]);
    expect(view.services.length).toBeGreaterThan(0);
    expect(view.faqs.length).toBeGreaterThan(0);
  });

  it('the free website audit page matches its contract and has no unfinished copy', () => {
    const view = formsAuditViewSchema.parse(formsAuditSnapshot);
    expect(unfinishedCopy(view)).toEqual([]);
    expect(view.content.covers.items.length).toBeGreaterThan(0);
    expect(view.content.delivery.steps.length).toBeGreaterThan(0);
    expect(view.faqs.length).toBeGreaterThan(0);
  });

  it('opens both pages with a direct answer of two or three sentences', () => {
    for (const snapshot of [formsProjectViewSchema.parse(formsProjectSnapshot), formsAuditViewSchema.parse(formsAuditSnapshot)]) {
      const sentences = countSentences(snapshot.content.hero.answer);
      expect(sentences).toBeGreaterThanOrEqual(2);
      expect(sentences).toBeLessThanOrEqual(3);
    }
  });

  it('keeps every title and description inside the metadata limits', () => {
    for (const { content } of [
      formsProjectViewSchema.parse(formsProjectSnapshot),
      formsAuditViewSchema.parse(formsAuditSnapshot),
    ]) {
      expect(content.seo.title.length).toBeLessThanOrEqual(60);
      expect(content.seo.description.length).toBeLessThanOrEqual(155);
    }
  });

  it('links only to pages that exist, with lowercase trailing-slash paths', () => {
    const view = formsProjectViewSchema.parse(formsProjectSnapshot);
    const hrefs = view.content.alternatives.items.map((item) => item.link.href);
    expect(hrefs).toContain(FORMS_ROUTES.freeWebsiteAudit);
    for (const href of hrefs) expect(href).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/);
  });

  it('uses image hosts the app allows, with alt text on anything that is not decorative', () => {
    const audit = formsAuditViewSchema.parse(formsAuditSnapshot);
    const project = formsProjectViewSchema.parse(formsProjectSnapshot);
    const sources = [project.content.backdrop?.src, audit.content.backdrop?.src, audit.content.delivery.image?.src];
    for (const src of sources) {
      expect(src).toBeDefined();
      expect(src).toMatch(/^https:\/\/(images\.unsplash\.com|images\.pexels\.com)\//);
    }
    expect(audit.content.delivery.image?.alt.length).toBeGreaterThan(0);
  });

  it('names every path this family owns in the sitemap section for planning a project', async () => {
    const { sitemapEntries } = await import('@/lib/api/forms');
    const entries = await sitemapEntries();
    expect(entries.map((entry) => entry.path).sort()).toEqual([...Object.values(FORMS_ROUTES)].sort());
    for (const entry of entries) expect(entry.section).toBe('Plan a project');
  });
});
