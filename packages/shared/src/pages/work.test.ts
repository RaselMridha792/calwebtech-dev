import { describe, expect, it } from 'vitest';
import {
  findWorkFilterTarget,
  matchesWorkFilters,
  paginateWork,
  readWorkQuery,
  workCaseStudyCardSchema,
  workFilterTargetSchema,
  workHeading,
  workIndexIndexing,
  workIndexPath,
  type WorkFilterTarget,
} from './work';

const target: WorkFilterTarget = workFilterTargetSchema.parse({
  filters: { platform: 'shopify' },
  seo: { title: 'Shopify case studies', description: 'Shopify stores we have built and what changed for each.' },
  title: 'Shopify case studies',
  intro: 'Stores we have built on Shopify and what changed for each of them.',
});

describe('readWorkQuery', () => {
  it('reads the filters and page from the URL, ignoring empty values and unknown keys', () => {
    expect(readWorkQuery({})).toEqual({ filters: {}, page: 1 });
    expect(readWorkQuery({ industry: 'healthcare', service: '', platform: undefined, utm_source: 'mail', page: '2' })).toEqual({
      filters: { industry: 'healthcare' },
      page: 2,
    });
  });

  it('takes the first of repeated values and lowercases them', () => {
    expect(readWorkQuery({ service: ['Website-Redesign', 'care-plans'] })).toEqual({
      filters: { service: 'website-redesign' },
      page: 1,
    });
  });

  it('rejects a page that is not a whole number from 1', () => {
    for (const page of ['0', '-1', '1.5', 'two', '01', '999999']) {
      expect(readWorkQuery({ page }), page).toBeNull();
    }
  });
});

describe('workIndexPath', () => {
  it('writes filters in a fixed order and adds the page only past the first', () => {
    expect(workIndexPath({})).toBe('/work/');
    expect(workIndexPath({}, 1)).toBe('/work/');
    expect(workIndexPath({}, 3)).toBe('/work/?page=3');
    expect(workIndexPath({ platform: 'shopify', industry: 'saas' }, 2)).toBe('/work/?industry=saas&platform=shopify&page=2');
  });
});

describe('matchesWorkFilters', () => {
  const card = { industry: 'distribution', services: ['ecommerce-development', 'nextjs-development'], platforms: ['nextjs'] };

  it('requires every filter that is set', () => {
    expect(matchesWorkFilters(card, {})).toBe(true);
    expect(matchesWorkFilters(card, { industry: 'distribution', service: 'nextjs-development' })).toBe(true);
    expect(matchesWorkFilters(card, { industry: 'distribution', platform: 'shopify' })).toBe(false);
    expect(matchesWorkFilters({ ...card, industry: null }, { industry: 'distribution' })).toBe(false);
  });
});

describe('paginateWork', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it('shows twelve per page and says which are shown', () => {
    expect(paginateWork(items, 1)).toMatchObject({ page: 1, pageCount: 3, total: 25, from: 1, to: 12 });
    expect(paginateWork(items, 3)).toMatchObject({ items: [25], from: 25, to: 25 });
  });

  it('has no page past the last, but always a first page, even when empty', () => {
    expect(paginateWork(items, 4)).toBeNull();
    expect(paginateWork([], 1)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 });
    expect(paginateWork([], 2)).toBeNull();
  });
});

describe('workIndexIndexing', () => {
  it('lets the unfiltered listing and its pages canonicalise to themselves', () => {
    expect(workIndexIndexing({ filters: {}, page: 1 }, [])).toEqual({ canonicalPath: '/work/', noindex: false, target: null });
    expect(workIndexIndexing({ filters: {}, page: 2 }, [])).toEqual({ canonicalPath: '/work/?page=2', noindex: false, target: null });
  });

  it('canonicalises a combination that is not a deliberate target to /work/ and keeps it out of search', () => {
    expect(workIndexIndexing({ filters: { service: 'ecommerce-development' }, page: 1 }, [target])).toEqual({
      canonicalPath: '/work/',
      noindex: true,
      target: null,
    });
  });

  it('indexes a deliberate target under its own URL, and only with exactly its filters', () => {
    expect(workIndexIndexing({ filters: { platform: 'shopify' }, page: 1 }, [target])).toEqual({
      canonicalPath: '/work/?platform=shopify',
      noindex: false,
      target,
    });
    expect(findWorkFilterTarget([target], { platform: 'shopify', industry: 'saas' })).toBeNull();
  });
});

describe('workFilterTargetSchema', () => {
  it('needs at least one filter', () => {
    expect(workFilterTargetSchema.safeParse({ ...target, filters: {} }).success).toBe(false);
  });
});

describe('workCaseStudyCardSchema', () => {
  const card = {
    slug: 'example-project',
    clientName: 'Example client',
    summary: 'A one-line summary of the project.',
    tags: ['Remote'],
    image: null,
    metrics: [
      { value: 'A', label: 'First figure' },
      { value: 'B', label: 'Second figure' },
      { value: 'C', label: 'Third figure' },
    ],
    industry: null,
    services: [],
    platforms: [],
  };

  it('carries exactly three figures', () => {
    expect(workCaseStudyCardSchema.safeParse(card).success).toBe(true);
    expect(workCaseStudyCardSchema.safeParse({ ...card, metrics: card.metrics.slice(0, 2) }).success).toBe(false);
  });
});

describe('workHeading', () => {
  it('fills in the client name wherever the template names it', () => {
    expect(workHeading('What did we build for {client}?', 'Example client')).toBe('What did we build for Example client?');
    expect(workHeading('Which services did this project use?', 'Example client')).toBe('Which services did this project use?');
  });
});
