import {
  workBeforeAndAfterViewSchema,
  workCaseStudyViewSchema,
  workIndexViewSchema,
  type WorkCaseStudyCard,
  type WorkIndexView,
} from '@calwebtech/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BeforeAndAfterPage from '@/app/(marketing)/(site)/before-and-after/page';
import CaseStudyPage, { generateMetadata as caseStudyMetadata } from '@/app/(marketing)/(site)/work/[slug]/page';
import WorkIndexPage, { generateMetadata as workIndexMetadata } from '@/app/(marketing)/(site)/work/page';
import { workBeforeAndAfterSnapshot, workCaseStudySnapshots, workIndexSnapshot } from '@/static-content/work';
import { QuoteSection } from './case-study';
import { WorkResults } from './work-index';

vi.mock('server-only', () => ({}));

/**
 * The work family's pages rendered from the static snapshots, as the Vercel demo serves them
 * (API_INTERNAL_URL unset). End-to-end tests cover the same pages against the database.
 */

type Search = Record<string, string | string[] | undefined>;

const indexProps = (search: Search) =>
  ({ params: Promise.resolve({}), searchParams: Promise.resolve(search) }) as unknown as PageProps<'/work'>;
const caseStudyProps = (slug: string) =>
  ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }) as unknown as PageProps<'/work/[slug]'>;

const html = async (page: Promise<ReactElement>) => renderToStaticMarkup(await page);

/** Heading levels in document order. */
const headingLevels = (markup: string) => [...markup.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));

function expectHeadingOrder(markup: string) {
  const levels = headingLevels(markup);
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  for (let index = 1; index < levels.length; index += 1) {
    expect((levels[index] ?? 0) - (levels[index - 1] ?? 0), `heading ${String(index)}`).toBeLessThanOrEqual(1);
  }
}

/** Every H2 on these content pages is a question a buyer types. */
function expectQuestionHeadings(markup: string) {
  const h2s = [...markup.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((match) => (match[1] ?? '').replace(/<[^>]+>/g, ''));
  expect(h2s.length).toBeGreaterThan(0);
  for (const text of h2s) expect(text, text).toMatch(/\?$/);
}

function expectNoTealOnHeadingsOrLinks(markup: string) {
  expect(markup).not.toMatch(/<(h[1-6]|a|button)\b[^>]*\b(text|bg)-result\b/);
}

const jsonLd = (markup: string) =>
  [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].flatMap((match) => {
    const parsed = JSON.parse(match[1] ?? 'null') as unknown;
    return Array.isArray(parsed) ? (parsed as { '@type'?: string }[]) : [parsed as { '@type'?: string }];
  });

async function expectNotFound(page: Promise<unknown>) {
  await expect(page).rejects.toMatchObject({ digest: expect.stringContaining('404') as unknown });
}

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', '');
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/work/', () => {
  const view = workIndexViewSchema.parse(workIndexSnapshot);

  it('lists every case study with filter links written into the URL, one H1 and question headings', async () => {
    const markup = await html(WorkIndexPage(indexProps({})));
    expectHeadingOrder(markup);
    expectQuestionHeadings(markup);
    expectNoTealOnHeadingsOrLinks(markup);
    for (const study of view.caseStudies) expect(markup).toContain(`href="/work/${study.slug}/"`);
    expect(markup).toContain('href="/work/?industry=healthcare#work-results"');
    expect(markup).toContain('href="/work/?platform=shopify#work-results"');
    expect(markup).not.toContain('aria-label="Pagination"');
  });

  it('filters on the server from the URL and marks the chosen value', async () => {
    const markup = await html(WorkIndexPage(indexProps({ industry: 'healthcare' })));
    expect(markup).toContain('href="/work/cascadia-health/"');
    expect(markup).not.toContain('href="/work/northmark-supply/"');
    expect(markup).toMatch(/<a href="\/work\/#work-results" aria-current="true"[^>]*>Healthcare/);
    expect(markup).toContain('Showing 1 to 1 of 1 case study');
  });

  it('combines filters: a service and a platform together', async () => {
    const markup = await html(WorkIndexPage(indexProps({ service: 'nextjs-development', platform: 'nextjs' })));
    expect(markup).toContain('href="/work/northmark-supply/"');
    expect(markup).toContain('href="/work/truvia-labs/"');
    expect(markup).not.toContain('href="/work/meridian-parts/"');
  });

  it('says when no case study matches, with a way back to all of them', async () => {
    const markup = await html(WorkIndexPage(indexProps({ industry: 'construction' })));
    expect(markup).toContain(view.copy.noMatches);
    expect(markup).toMatch(new RegExp(`<a href="/work/#work-results"[^>]*>${view.copy.filters.clear}</a>`));
  });

  it('answers 404 for a page number that is malformed or past the last page', async () => {
    await expectNotFound(WorkIndexPage(indexProps({ page: 'two' })));
    await expectNotFound(WorkIndexPage(indexProps({ page: '2' })));
  });

  it('canonicalises filtered views to /work/ and keeps them out of search', async () => {
    const plain = await workIndexMetadata(indexProps({}));
    expect(plain.alternates?.canonical).toBe('https://www.calwebtech.com/work/');
    const filtered = await workIndexMetadata(indexProps({ service: 'ecommerce-development' }));
    expect(filtered.alternates?.canonical).toBe('https://www.calwebtech.com/work/');
    expect(filtered.robots).toEqual({ index: false, follow: false });
  });
});

describe('WorkResults', () => {
  const copy = workIndexViewSchema.parse(workIndexSnapshot).copy;
  const empty: WorkIndexView = {
    copy,
    caseStudies: [],
    filters: { industries: [], services: [], platforms: [] },
    proof: { statistics: [], rating: null },
  };

  it('renders the empty state when nothing is published', () => {
    const markup = renderToStaticMarkup(
      <WorkResults view={empty} filters={{}} results={{ items: [], page: 1, pageCount: 1, total: 0, from: 0, to: 0 }} />,
    );
    expect(markup).toContain(copy.empty);
    expect(markup).not.toContain(copy.filters.label);
  });

  it('paginates past twelve, keeping the filters in every page link', () => {
    const base = workIndexViewSchema.parse(workIndexSnapshot).caseStudies[0] as WorkCaseStudyCard;
    const many = Array.from({ length: 13 }, (_, index) => ({ ...base, slug: `${base.slug}-${String(index)}` }));
    const markup = renderToStaticMarkup(
      <WorkResults
        view={{ ...empty, caseStudies: many }}
        filters={{ industry: 'distribution' }}
        results={{ items: many.slice(12), page: 2, pageCount: 2, total: 13, from: 13, to: 13 }}
      />,
    );
    expect(markup).toContain('aria-label="Pagination"');
    expect(markup).toContain('href="/work/?industry=distribution#work-results" rel="prev"');
    expect(markup).toMatch(/aria-current="page"[^>]*><span class="sr-only">Page <\/span>2/);
  });
});

describe('/work/<slug>/', () => {
  it.each(Object.keys(workCaseStudySnapshots))('%s opens with the answer block and has one H1 and ordered headings', async (slug) => {
    const markup = await html(CaseStudyPage(caseStudyProps(slug)));
    expectHeadingOrder(markup);
    expectQuestionHeadings(markup);
    expectNoTealOnHeadingsOrLinks(markup);

    const h1 = markup.indexOf('<h1');
    const answer = markup.indexOf('data-answer-block');
    expect(answer).toBeGreaterThan(h1);
    expect(markup.slice(h1, answer)).not.toMatch(/<a\s/);

    const types = jsonLd(markup).map((node) => node['@type']);
    expect(types).toContain('Article');
    expect(types).toContain('BreadcrumbList');
    expect(markup).toContain('id="results"');
    expect(markup).toContain('id="at-a-glance"');
  });

  it('links up to every service used and the industry, and carries the client quote as a Review', async () => {
    const markup = await html(CaseStudyPage(caseStudyProps('northmark-supply')));
    expect(markup).toContain('href="/industries/distribution/"');
    expect(markup).toContain('href="/services/ecommerce-development/"');
    expect(markup).toContain('href="/work/?platform=nextjs"');
    expect(jsonLd(markup).map((node) => node['@type'])).toContain('Review');
  });

  it('gives a case study without a quote no Review node', async () => {
    const markup = await html(CaseStudyPage(caseStudyProps('verona-home')));
    expect(jsonLd(markup).map((node) => node['@type'])).not.toContain('Review');
  });

  it('answers 404 for an unknown slug, including names of object properties', async () => {
    await expectNotFound(CaseStudyPage(caseStudyProps('no-such-project')));
    await expectNotFound(CaseStudyPage(caseStudyProps('constructor')));
    const metadata = await caseStudyMetadata(caseStudyProps('constructor'));
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('writes an article title and description within the limits, with a canonical', async () => {
    const metadata = await caseStudyMetadata(caseStudyProps('cascadia-health'));
    expect((metadata.title as { absolute: string }).absolute.length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(metadata.alternates?.canonical).toBe('https://www.calwebtech.com/work/cascadia-health/');
  });
});

describe('QuoteSection', () => {
  const view = workCaseStudyViewSchema.parse(workCaseStudySnapshots['northmark-supply']);
  const quote = view.quote;
  const video = {
    clientName: quote?.clientName ?? view.clientName,
    role: quote?.role ?? null,
    company: quote?.company ?? null,
    poster: view.cover,
    videoUrl: '/media/northmark-supply-testimonial.mp4',
  };

  it('shows the video testimonial beside the quote, with a play button that opens a dialog', () => {
    const markup = renderToStaticMarkup(<QuoteSection view={{ ...view, videoTestimonial: video }} tone="white" />);
    expect(quote).not.toBeNull();
    expect(markup).toContain('<blockquote');
    expect(markup).toContain(`aria-label="Play video testimonial from ${video.clientName}, ${String(video.company)}"`);
    expect(markup).toContain('<dialog');
    expect(markup).toContain('src="/media/northmark-supply-testimonial.mp4"');
    expect(markup).toContain('preload="none"');
    expectNoTealOnHeadingsOrLinks(markup);
  });

  it('shows a video testimonial on its own when there is no written quote, and nothing with neither', () => {
    const videoOnly = renderToStaticMarkup(
      <QuoteSection view={{ ...view, quote: null, videoTestimonial: { ...video, poster: null } }} tone="tint" />,
    );
    expect(videoOnly).toContain('id="quote-heading"');
    expect(videoOnly).not.toContain('<blockquote');
    expect(videoOnly).toContain('<dialog');
    expect(renderToStaticMarkup(<QuoteSection view={{ ...view, quote: null, videoTestimonial: null }} tone="white" />)).toBe('');
  });
});

describe('/before-and-after/', () => {
  it('shows each comparison with the keyboard-operable slider and what moved', async () => {
    const view = workBeforeAndAfterViewSchema.parse(workBeforeAndAfterSnapshot);
    const markup = await html(BeforeAndAfterPage());
    expectHeadingOrder(markup);
    expectNoTealOnHeadingsOrLinks(markup);
    for (const comparison of view.comparisons) {
      expect(markup).toContain(comparison.heading.replaceAll("'", '&#x27;'));
      expect(markup).toContain('type="range"');
    }
    // One table of figures per comparison that has figures, and none for one that has none:
    // HelloWay's were invented and came out (decision 66).
    const withFigures = view.comparisons.filter((comparison) => comparison.metrics.length > 0).length;
    expect(markup.split('<caption').length - 1).toBe(withFigures);
  });
});
