import { Prisma, type ReviewSource } from '@calwebtech/db';
import { HOME_CONTENT, PLACEHOLDER_CONTACT } from '@calwebtech/db/seed';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { HomeProjectRecord } from '../home/home-page.mapper';
import { toSiteChromeView, type SiteChromeRecords } from './site-chrome.mapper';

const at = new Date('2026-09-01T00:00:00Z');

function records(overrides: Partial<SiteChromeRecords> = {}): SiteChromeRecords {
  return {
    contentSetting: HOME_CONTENT,
    contactSetting: PLACEHOLDER_CONTACT,
    proofSetting: null,
    indexingSetting: null,
    reviewSources: [],
    categories: [],
    services: [],
    industries: [],
    projects: [],
    locations: [],
    ...overrides,
  };
}

function project(slug: string, outcomeMetrics: HomeProjectRecord['outcomeMetrics']): HomeProjectRecord {
  return {
    id: slug,
    title: 'Test project',
    slug,
    clientName: `Client ${slug}`,
    clientAlias: null,
    answerBlock: 'Test answer block.',
    summary: 'Test project summary.',
    liveUrl: null,
    location: null,
    segment: null,
    coverImageUrl: null,
    coverImageAlt: null,
    gallery: null,
    challenge: null,
    approach: null,
    buildNotes: null,
    outcome: null,
    outcomeMetrics,
    duration: null,
    year: null,
    featured: true,
    beforeImageUrl: null,
    afterImageUrl: null,
    beforeAfterMetrics: null,
    status: 'PUBLISHED',
    seo: null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    industryId: null,
    industry: null,
    testimonials: [],
  };
}

function hrefsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(hrefsOf);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) =>
    key === 'href' && typeof item === 'string' ? [item] : hrefsOf(item),
  );
}

describe('toSiteChromeView', () => {
  it('is noindex unless the site.indexing setting is exactly { index: true }', () => {
    expect(toSiteChromeView(records()).indexable).toBe(false);
    expect(toSiteChromeView(records({ indexingSetting: { index: 'yes' } })).indexable).toBe(false);
    expect(toSiteChromeView(records({ indexingSetting: { index: false } })).indexable).toBe(false);
    expect(toSiteChromeView(records({ indexingSetting: { index: true } })).indexable).toBe(true);
  });

  it('resolves every homepage anchor in the copy, so each link works from any page', () => {
    const chrome = toSiteChromeView(records());
    expect(hrefsOf(chrome).filter((href) => href.startsWith('#'))).toEqual([]);
    // The placeholder copy's header points at #book and #estimate on the homepage.
    expect(chrome.header.primaryCta.href).toBe('/contact/');
    expect(chrome.header.secondaryCta.href).toBe('/#estimate');
  });

  it('lists published services and industries by their pages when the copy sets no menus', () => {
    const chrome = toSiteChromeView(
      records({
        categories: [{ name: 'Test group', services: [{ slug: 'test-service', title: 'Test service' }] }],
        services: [{ slug: 'test-service', title: 'Test service' }],
        industries: [{ slug: 'test-industry', name: 'Test industry' }],
      }),
    );
    expect(chrome.megaMenu.services.columns).toEqual([
      { title: 'Test group', links: [{ label: 'Test service', href: '/services/test-service/' }] },
    ]);
    expect(chrome.megaMenu.industries.links).toEqual([{ label: 'Test industry', href: '/industries/test-industry/' }]);
    expect(chrome.footer.columns[0]).toEqual({
      title: 'Services',
      links: [{ label: 'Test service', href: '/services/test-service/' }],
    });
  });

  it('features case studies with outcome figures only', () => {
    const chrome = toSiteChromeView(
      records({
        projects: [
          project('no-figures', []),
          project('malformed', { value: '10' }),
          project('with-figures', [{ value: '10', label: 'Test figure' }]),
        ],
      }),
    );
    expect(chrome.megaMenu.work.featured).toEqual([
      { href: '/work/with-figures/', clientName: 'Client with-figures', image: null, metric: { value: '10', label: 'Test figure' } },
    ]);
  });

  it('carries the rating badge with platform counts', () => {
    const review = (platform: string, rating: number, reviewCount: number): ReviewSource => ({
      id: platform,
      platform,
      rating: new Prisma.Decimal(rating),
      reviewCount,
      profileUrl: null,
      refreshedAt: at,
    });
    const chrome = toSiteChromeView(records({ reviewSources: [review('Test platform', 5, 3)] }));
    expect(chrome.reviews).toMatchObject({ averageRating: 5, totalReviews: 3 });
    expect(chrome.reviews.sources).toEqual([{ platform: 'Test platform', rating: 5, reviewCount: 3 }]);
  });

  it('throws on malformed copy or contact details rather than rendering pages without navigation', () => {
    expect(() => toSiteChromeView(records({ contentSetting: null }))).toThrow(ZodError);
    expect(() => toSiteChromeView(records({ contactSetting: { phone: 'x' } }))).toThrow(ZodError);
  });
});
