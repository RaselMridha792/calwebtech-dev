import {
  industriesIndexViewSchema,
  industryDetailViewSchema,
  industryPath,
  type IndustryDetailView,
} from '@calwebtech/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { industriesIndexSnapshot, industrySnapshots } from '@/static-content/industries';
import { IndustriesIndex, IndustryDetail } from './industry-page';
import { industryServiceJsonLd } from './json-ld';
import { INDUSTRY_SECTIONS, industrySectionTones } from './section-tones';

interface JsonLdNode {
  '@type'?: string;
  [key: string]: unknown;
}

const pages = Object.entries(industrySnapshots).map(
  ([slug, snapshot]) => [slug, industryDetailViewSchema.parse(snapshot)] as const,
);
const index = industriesIndexViewSchema.parse(industriesIndexSnapshot);

const headings = (html: string) =>
  [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gs)].map((match) => ({
    level: Number(match[1]),
    text: (match[2] ?? '').replace(/<[^>]+>/g, ''),
  }));

const jsonLd = (html: string): JsonLdNode[] =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (match) => JSON.parse(match[1] ?? '{}') as JsonLdNode,
  );

/** An industry record with no page copy and no proof, as the placeholder database has. */
const bare: IndustryDetailView = {
  slug: 'healthcare',
  name: 'Healthcare',
  title: 'Healthcare',
  seo: { title: 'Healthcare', description: 'Websites for healthcare providers.', ogImage: null },
  answerBlock:
    'Healthcare websites have to book appointments and meet accessibility rules. This record has no page copy yet, so the page shows this answer alone.',
  updatedAt: '2026-09-14T00:00:00.000Z',
  hero: { intro: null, primaryCta: null, secondaryCta: null, highlights: [], backdrop: null, line: null },
  painPoints: null,
  services: null,
  compliance: null,
  caseStudies: null,
  results: null,
  integrations: null,
  faq: null,
};

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('industry page', () => {
  it.each(pages)('%s has one h1, headings in order and section headings written as questions', (_slug, page) => {
    const list = headings(renderToStaticMarkup(<IndustryDetail page={page} />));
    expect(list.filter((heading) => heading.level === 1).map((heading) => heading.text)).toEqual([page.title]);
    expect(list[0]?.level).toBe(1);
    for (const [position, heading] of list.entries()) {
      const previous = list[position - 1];
      if (previous) expect(heading.level - previous.level, heading.text).toBeLessThanOrEqual(1);
      if (heading.level === 2) expect(heading.text, 'H2s are questions buyers type').toMatch(/\?$/);
    }
  });

  it.each(pages)('%s opens with the answer block before any call to action', (_slug, page) => {
    const html = renderToStaticMarkup(<IndustryDetail page={page} />);
    const answer = html.indexOf('data-answer-block');
    expect(answer).toBeGreaterThan(html.indexOf('<h1'));
    for (const cta of [page.hero.primaryCta, page.hero.secondaryCta]) {
      if (cta) expect(html.indexOf(`href="${cta.href}"`)).toBeGreaterThan(answer);
    }
  });

  it.each(pages)('%s carries one Service, one FAQPage and one BreadcrumbList node', (_slug, page) => {
    const types = jsonLd(renderToStaticMarkup(<IndustryDetail page={page} />)).map((node) => node['@type']);
    expect(types.sort()).toEqual(['BreadcrumbList', 'FAQPage', 'Service']);
  });

  it.each(pages)('%s never puts two sections with the same tone next to each other', (_slug, page) => {
    const tones = INDUSTRY_SECTIONS.flatMap((section) => {
      const tone = industrySectionTones(page)[section];
      return tone ? [tone] : [];
    });
    expect(tones.length).toBeGreaterThan(0);
    for (let position = 1; position < tones.length; position += 1) {
      expect(tones[position]).not.toBe(tones[position - 1]);
    }
    // The site layout's closing band is tinted, so the last section is white.
    expect(tones.at(-1)).toBe('white');
  });

  it('renders a record without copy or proof as the hero and answer block, with no FAQ data', () => {
    const html = renderToStaticMarkup(<IndustryDetail page={bare} />);
    expect(headings(html).map((heading) => heading.level)).toEqual([1]);
    expect(html).toContain('data-answer-block');
    expect(jsonLd(html).map((node) => node['@type']).sort()).toEqual(['BreadcrumbList', 'Service']);
    expect(industrySectionTones(bare)).toEqual({});
  });

  it('describes the page as a Service for the sector, provided by the organisation, with its services', () => {
    const page = pages.find(([slug]) => slug === 'distribution')?.[1];
    if (!page) throw new Error('The distribution snapshot is missing');
    const node = industryServiceJsonLd(page);
    expect(node).toMatchObject({
      '@type': 'Service',
      name: page.title,
      url: 'https://www.calwebtech.com/industries/distribution/',
      provider: { '@id': 'https://www.calwebtech.com/#organization' },
      audience: { '@type': 'BusinessAudience', audienceType: page.name },
    });
    const catalogue = node.hasOfferCatalog as { itemListElement: { itemOffered: { url: string } }[] };
    expect(catalogue.itemListElement.map((offer) => offer.itemOffered.url)).toEqual(
      page.services?.items.map((item) => `https://www.calwebtech.com/services/${item.slug}/`),
    );
    expect(industryServiceJsonLd(bare)).not.toHaveProperty('hasOfferCatalog');
  });

  it('shows the client beside every figure in the results band, and the consented quote', () => {
    const page = pages.find(([slug]) => slug === 'distribution')?.[1];
    if (!page?.results?.testimonial) throw new Error('The distribution snapshot has no results with a quote');
    const html = renderToStaticMarkup(<IndustryDetail page={page} />);
    const band = html.slice(html.indexOf('id="industry-results"'));
    for (const metric of page.results.metrics) expect(band).toContain(metric.clientName);
    expect(band).toContain(page.results.testimonial.clientName);
  });
});

describe('industries index', () => {
  it('links every published industry by name and closes the list with the card for other sectors', () => {
    const html = renderToStaticMarkup(<IndustriesIndex view={index} />);
    for (const industry of index.industries) {
      expect(html).toContain(`href="${industryPath(industry.slug)}"`);
    }
    expect(html).toContain(index.content.notListed.heading);
    expect(html).not.toContain(index.content.list.empty);
    const list = headings(html);
    expect(list.filter((heading) => heading.level === 1)).toHaveLength(1);
    for (const heading of list.filter((item) => item.level === 2)) expect(heading.text).toMatch(/\?$/);
    expect(html.indexOf('data-answer-block')).toBeLessThan(html.indexOf(`href="${index.content.primaryCta?.href ?? ''}"`));
  });

  it('shows the empty state, and no approach section without items, when nothing is published', () => {
    const empty = { ...index, industries: [], content: { ...index.content, approach: { ...index.content.approach, items: [] } } };
    const html = renderToStaticMarkup(<IndustriesIndex view={empty} />);
    expect(html).toContain(index.content.list.empty);
    expect(html).toContain(`href="${index.content.notListed.cta.href}"`);
    expect(html).not.toContain('id="approach"');
    expect(html).not.toContain('href="/industries/manufacturing/"');
  });
});
