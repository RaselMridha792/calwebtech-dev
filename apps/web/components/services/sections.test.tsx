import { serviceDetailViewSchema, servicesIndexViewSchema, type ServiceDetailView } from '@calwebtech/shared';
import { Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FaqSection } from '@/components/site/faq-section';
import { serviceSnapshots, servicesIndexSnapshot } from '@/static-content/services';
import {
  ComparisonSection,
  HeroPriceBand,
  IncludedSection,
  IndustriesSection,
  PricingSection,
  ProblemSection,
  ProcessSection,
  ProofSection,
  RelatedServicesSection,
  TechnologySection,
  TestimonialSection,
} from './detail-sections';
import { ServiceGroups } from './index-sections';
import { sectionTones } from './tones';

/** Every section below the hero except the enquiry form (a client component), as the page orders them. */
function sections(page: ServiceDetailView): string {
  const parts: { prefers: 'light' | 'ink' | 'band'; render: (tone: ReturnType<typeof sectionTones>[number]) => ReactNode }[] = [];
  const { problem, included, process: steps, technology, proof, comparison, pricing, industries, testimonial, faq, related } = page;
  if (problem) parts.push({ prefers: 'light', render: (tone) => <ProblemSection problem={problem} tone={tone} /> });
  if (included) parts.push({ prefers: 'light', render: (tone) => <IncludedSection included={included} tone={tone} /> });
  if (steps) parts.push({ prefers: 'ink', render: (tone) => <ProcessSection process={steps} tone={tone} /> });
  if (technology) parts.push({ prefers: 'light', render: (tone) => <TechnologySection technology={technology} tone={tone} /> });
  if (proof) parts.push({ prefers: 'light', render: (tone) => <ProofSection proof={proof} tone={tone} /> });
  if (comparison) parts.push({ prefers: 'light', render: (tone) => <ComparisonSection comparison={comparison} tone={tone} /> });
  if (pricing) parts.push({ prefers: 'band', render: (tone) => <PricingSection pricing={pricing} price={page.price} tone={tone} /> });
  if (industries) parts.push({ prefers: 'light', render: (tone) => <IndustriesSection industries={industries} tone={tone} /> });
  if (testimonial) parts.push({ prefers: 'light', render: (tone) => <TestimonialSection testimonial={testimonial} tone={tone} /> });
  if (faq) parts.push({ prefers: 'light', render: () => <FaqSection heading={faq.heading} items={faq.items} group="service-faq" /> });
  if (related) parts.push({ prefers: 'light', render: (tone) => <RelatedServicesSection related={related} tone={tone} /> });
  const tones = sectionTones(parts.map((part) => part.prefers));
  return renderToStaticMarkup(
    <>
      {parts.map((part, index) => (
        <Fragment key={String(index)}>{part.render(tones[index] ?? 'white')}</Fragment>
      ))}
    </>,
  );
}

const pages = Object.entries(serviceSnapshots).map(([slug, view]) => [slug, serviceDetailViewSchema.parse(view)] as const);

describe('service page sections', () => {
  it.each(pages)('%s: section headings are H2 questions, with H3 below them and no H1', (_slug, page) => {
    const html = sections(page);
    expect(html).not.toMatch(/<h1[\s>]/);
    const h2s = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1] ?? '');
    expect(h2s.length).toBeGreaterThanOrEqual(8);
    for (const heading of h2s) expect(heading.endsWith('?'), heading).toBe(true);
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('<h3'));
  });

  it.each(pages)('%s: every labelled section points at a heading that exists, and ids are unique', (_slug, page) => {
    const html = sections(page);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, labelledBy] of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(ids).toContain(labelledBy);
  });

  it.each(pages)('%s: the comparison is a table with column and row headers in a focusable region', (_slug, page) => {
    if (!page.comparison) return;
    const html = renderToStaticMarkup(<ComparisonSection comparison={page.comparison} tone="white" />);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html.match(/<th scope="col"/g)).toHaveLength(4);
    expect(html.match(/<th scope="row"/g)).toHaveLength(page.comparison.rows.length);
  });

  it('keeps teal for outcome figures and round check marks, never headings, prices or links', () => {
    const [, page] = pages[0] ?? [];
    if (!page) throw new Error('no snapshot');
    const html = sections(page);
    const teal = [...html.matchAll(/<(\w+)[^>]*class="([^"]*\btext-result\b[^"]*)"[^>]*>/g)];
    expect(teal.length).toBeGreaterThan(0);
    for (const [, tag, classes = ''] of teal) {
      const figure = tag === 'dd' && classes.includes('font-extrabold');
      const checkMark = tag === 'span' && classes.includes('rounded-full');
      expect(figure || checkMark, `${String(tag)}: ${classes}`).toBe(true);
    }
    const price = page.price;
    if (price) expect(renderToStaticMarkup(<HeroPriceBand price={price} />)).not.toContain('result');
  });
});

describe('services index sections', () => {
  const view = servicesIndexViewSchema.parse(servicesIndexSnapshot);

  it('renders one section per category with a link card per service, then the guidance band', () => {
    const html = renderToStaticMarkup(<ServiceGroups view={view} />);
    for (const group of view.groups) expect(html).toContain(`id="services-${group.slug ?? 'other'}"`);
    expect(html.match(/href="\/services\/[a-z-]+\/"/g)).toHaveLength(10);
    expect(html).toContain(view.content.guidance.heading);
  });

  it('shows the empty state, with a way forward, when nothing is published', () => {
    const html = renderToStaticMarkup(<ServiceGroups view={{ ...view, groups: [] }} />);
    expect(html).toContain(view.content.empty);
    expect(html).toContain(`href="${view.content.guidance.primaryCta.href}"`);
    expect(html).not.toMatch(/href="\/services\/[a-z-]+\/"/);
  });
});
