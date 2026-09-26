import { describe, expect, it } from 'vitest';
import { comparisonInputSchema } from './admin-comparisons';
import { homepageComparison, workBeforeAndAfterViewSchema } from './pages/work';

const picture = (name: string) => ({ src: `/media/test-${name}.jpg`, alt: `Test ${name} picture` });

const comparison = {
  clientName: 'Test Client',
  heading: 'What changed when Test Client redesigned?',
  summary: 'Test summary of what changed.',
  before: picture('before'),
  after: picture('after'),
};

describe('comparisonInputSchema', () => {
  it('takes a comparison with no figures, no size and no case study', () => {
    expect(comparisonInputSchema.parse(comparison)).toEqual({
      ...comparison,
      metrics: [],
      projectId: null,
      order: 0,
      onHomepage: false,
    });
  });

  it('refuses a picture without a description, and a heading that is not a question', () => {
    const refused = comparisonInputSchema.safeParse({
      ...comparison,
      heading: 'Test heading',
      after: { src: '/media/test-after.jpg', alt: ' ' },
    });
    expect(refused.success).toBe(false);
    const paths = refused.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['heading', 'after.alt']));
  });

  it('takes a picture’s size as both numbers or neither', () => {
    expect(comparisonInputSchema.safeParse({ ...comparison, before: { ...picture('before'), width: 1448, height: 1086 } }).success).toBe(true);
    const half = comparisonInputSchema.safeParse({ ...comparison, before: { ...picture('before'), width: 1448 } });
    expect(half.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['before.height']);
  });

  it('holds at most four figures, each within the page’s bounds', () => {
    const figure = { label: 'Test measure', before: '1', after: '2' };
    expect(comparisonInputSchema.safeParse({ ...comparison, metrics: Array.from({ length: 4 }, () => figure) }).success).toBe(true);
    expect(comparisonInputSchema.safeParse({ ...comparison, metrics: Array.from({ length: 5 }, () => figure) }).success).toBe(false);
    expect(comparisonInputSchema.safeParse({ ...comparison, metrics: [{ ...figure, label: 'x'.repeat(61) }] }).success).toBe(false);
  });
});

describe('homepageComparison', () => {
  const view = workBeforeAndAfterViewSchema.parse({
    copy: {
      seo: { title: 'Test title', description: 'Test description.', ogImage: null },
      eyebrow: 'Test',
      title: 'Test title',
      intro: 'Test intro.',
      metricsLabel: 'Test figures',
      beforeLabel: 'Before',
      afterLabel: 'After',
      caseStudyLabel: 'Test link',
      empty: 'Test empty.',
      emptyAction: { label: 'Test', href: '/work/' },
    },
    comparisons: [
      { ...comparison, clientName: 'Test First', slug: null, metrics: [] },
      { ...comparison, clientName: 'Test Marked', slug: null, metrics: [], onHomepage: true },
      { ...comparison, clientName: 'Test Also Marked', slug: null, metrics: [], onHomepage: true },
    ],
  });

  it('is the first comparison marked for the homepage, in the page’s order', () => {
    expect(homepageComparison(view)).toEqual({ clientName: 'Test Marked', before: comparison.before, after: comparison.after, metrics: [] });
  });

  it('is null when none is marked, and a comparison not marked defaults to false', () => {
    expect(view.comparisons[0]?.onHomepage).toBe(false);
    expect(homepageComparison({ comparisons: view.comparisons.slice(0, 1) })).toBeNull();
  });
});
