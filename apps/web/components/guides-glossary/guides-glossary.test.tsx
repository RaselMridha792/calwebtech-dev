import { GUIDE_GATE_FORM_ID } from '@calwebtech/shared';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GlossaryIndexPage from '@/app/(marketing)/(site)/glossary/page';
import GlossaryTermRoute, { generateMetadata as termMetadata } from '@/app/(marketing)/(site)/glossary/[term]/page';
import GuidesIndexPage from '@/app/(marketing)/(site)/guides/page';
import GuidePage, { generateMetadata as guideMetadata } from '@/app/(marketing)/(site)/guides/[slug]/page';
import { glossaryTermSnapshots, guideSnapshots } from '@/static-content/guides-glossary';
import { letterAnchor } from './glossary-index';

vi.mock('server-only', () => ({}));

/**
 * The guides and glossary pages rendered from the static snapshots, as the Vercel demo
 * serves them (API_INTERNAL_URL unset). The end-to-end spec covers the same pages against
 * the database.
 */

const guideProps = (slug: string) =>
  ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }) as unknown as PageProps<'/guides/[slug]'>;
const termProps = (term: string) =>
  ({ params: Promise.resolve({ term }), searchParams: Promise.resolve({}) }) as unknown as PageProps<'/glossary/[term]'>;

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
    const parsed = JSON.parse(
      (match[1] ?? 'null').replaceAll('\\u003c', '<').replaceAll('\\u003e', '>').replaceAll('\\u0026', '&'),
    ) as unknown;
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [parsed as Record<string, unknown>];
  });

/** The answer block precedes every link in the page except the breadcrumbs. */
function expectAnswerLeads(markup: string) {
  const answer = markup.indexOf('data-answer-block');
  expect(answer).toBeGreaterThan(-1);
  const body = markup.slice(0, answer);
  const links = [...body.matchAll(/<a\s/g)];
  // Only the breadcrumb trail may appear before the answer.
  const breadcrumbEnd = markup.indexOf('</nav>');
  expect(links.every((link) => (link.index ?? 0) < breadcrumbEnd)).toBe(true);
}

describe('/guides/', () => {
  it('is one H1 with the answer first, question headings and a card for each guide', async () => {
    const markup = await html(GuidesIndexPage());
    expectHeadingOrder(markup);
    expectQuestionHeadings(markup);
    expectNoTealOnHeadingsOrLinks(markup);
    expectAnswerLeads(markup);
    expect(markup).toContain('href="/guides/core-web-vitals-guide/"');
    expect(markup).toContain('href="/guides/b2b-website-planning-guide/"');
    expect(markup).toContain('href="/glossary/"');
    // Plain anchors, never next/link, on a marketing route (docs/09).
    expect(markup).not.toContain('data-prefetch');
  });

  it('says plainly what the gate asks for, before anyone reaches a form', async () => {
    const markup = await html(GuidesIndexPage());
    expect(markup).toContain('Do I have to give my email address?');
  });
});

describe('/guides/<slug>/', () => {
  it('renders the whole summary above the gate, with the download behind it', async () => {
    const markup = await html(GuidePage(guideProps('core-web-vitals-guide')));
    expectHeadingOrder(markup);
    expectQuestionHeadings(markup);
    expectNoTealOnHeadingsOrLinks(markup);
    expectAnswerLeads(markup);

    const summary = markup.indexOf('id="summary"');
    const gate = markup.indexOf('id="download"');
    expect(summary).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(summary);
    // The file itself is never linked before the lead is stored.
    expect(markup).not.toContain('/guides/core-web-vitals-guide.pdf');
    expect(markup).toContain(`name="guideSlug" value="core-web-vitals-guide"`);
    expect(markup).toContain(`value="RESOURCE"`);
    expect(markup).toContain(`value="${GUIDE_GATE_FORM_ID}"`);
  });

  it('carries the Article node, the FAQ node and the sources it quotes', async () => {
    const markup = await html(GuidePage(guideProps('b2b-website-planning-guide')));
    const types = jsonLd(markup).map((node) => node['@type']);
    expect(types).toContain('Article');
    expect(types).toContain('FAQPage');
    expect(types).toContain('BreadcrumbList');
    expect(types.filter((type) => type === 'FAQPage')).toHaveLength(1);
    expect(markup).toContain('https://web.dev/articles/vitals');
  });

  it('gives the gate a labelled name and email field, each with a real label element', async () => {
    const markup = await html(GuidePage(guideProps('core-web-vitals-guide')));
    for (const field of ['name', 'email']) {
      expect(markup).toContain(`for="${GUIDE_GATE_FORM_ID}-${field}"`);
      expect(markup).toContain(`id="${GUIDE_GATE_FORM_ID}-${field}"`);
    }
  });

  it('is metadata with a canonical path and a description under 155 characters', async () => {
    const metadata = await guideMetadata(guideProps('core-web-vitals-guide'));
    expect(metadata.alternates?.canonical).toMatch(/\/guides\/core-web-vitals-guide\/$/);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
  });

  it('is noindex for a slug that is not published', async () => {
    const metadata = await guideMetadata(guideProps('no-such-guide'));
    expect(metadata.robots).toEqual({ index: false, follow: false });
    await expect(html(GuidePage(guideProps('no-such-guide')))).rejects.toThrow();
  });
});

describe('/glossary/', () => {
  it('lists every term under its letter, with jump links to each group', async () => {
    const markup = await html(GlossaryIndexPage());
    expectHeadingOrder(markup);
    expectQuestionHeadings(markup);
    expectNoTealOnHeadingsOrLinks(markup);
    expectAnswerLeads(markup);
    for (const slug of Object.keys(glossaryTermSnapshots)) {
      expect(markup, slug).toContain(`href="/glossary/${slug}/"`);
    }
    expect(markup).toContain(`href="#${letterAnchor('A')}"`);
    expect(markup).toContain(`id="${letterAnchor('A')}"`);
    // The letters are navigation, not headings, so they never break the heading order.
    expect(markup).toContain('aria-label="Terms beginning with A"');
  });

  it('carries one DefinedTermSet holding every published term', async () => {
    const markup = await html(GlossaryIndexPage());
    const sets = jsonLd(markup).filter((node) => node['@type'] === 'DefinedTermSet');
    expect(sets).toHaveLength(1);
    const listed = (sets[0]?.hasDefinedTerm as { name: string }[] | undefined) ?? [];
    expect(listed).toHaveLength(Object.keys(glossaryTermSnapshots).length);
  });
});

describe('/glossary/<term>/', () => {
  it('opens with the definition, then meaning, commerce, example and the delivering service', async () => {
    const markup = await html(GlossaryTermRoute(termProps('core-web-vitals')));
    expectHeadingOrder(markup);
    expectQuestionHeadings(markup);
    expectNoTealOnHeadingsOrLinks(markup);
    expectAnswerLeads(markup);
    expect(markup).toContain('id="meaning"');
    expect(markup).toContain('id="commercial"');
    expect(markup).toContain('id="example"');
    expect(markup).toContain('href="/services/ai-search-visibility/"');
    expect(markup).toContain('Last updated 15 September 2026');
    // The result colour is reserved for the outcome figure.
    expect(markup).toMatch(/text-result[^>]*>\+?1\.4s|1\.4s/);
  });

  it('carries the DefinedTerm node inside the glossary set', async () => {
    const markup = await html(GlossaryTermRoute(termProps('headless-cms')));
    const term = jsonLd(markup).find((node) => node['@type'] === 'DefinedTerm');
    expect(term?.name).toBe('Headless CMS');
    expect((term?.inDefinedTermSet as { '@id': string } | undefined)?.['@id']).toMatch(/\/glossary\/#glossary$/);
  });

  it('links related terms the delivering service also covers', async () => {
    const markup = await html(GlossaryTermRoute(termProps('headless-cms')));
    expect(markup).toContain('href="/glossary/server-side-rendering/"');
    expect(markup).toContain('href="/glossary/static-site-generation/"');
  });

  it('is metadata with a canonical path, and noindex for a slug that is not published', async () => {
    const metadata = await termMetadata(termProps('headless-cms'));
    expect(metadata.alternates?.canonical).toMatch(/\/glossary\/headless-cms\/$/);
    expect(await termMetadata(termProps('constructor'))).toEqual({ robots: { index: false, follow: false } });
    await expect(html(GlossaryTermRoute(termProps('constructor')))).rejects.toThrow();
  });

  it('renders every published term without a contract failure', async () => {
    for (const slug of Object.keys(glossaryTermSnapshots)) {
      const markup = await html(GlossaryTermRoute(termProps(slug)));
      expectHeadingOrder(markup);
      expectQuestionHeadings(markup);
    }
    for (const slug of Object.keys(guideSnapshots)) {
      const markup = await html(GuidePage(guideProps(slug)));
      expectHeadingOrder(markup);
    }
  });
});
