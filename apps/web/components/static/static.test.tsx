import {
  STATIC_LEGAL_SLUGS,
  STATIC_THANK_YOU_TYPES,
  staticContactViewSchema,
  staticFaqViewSchema,
  staticLegalViewSchema,
  staticNotFoundViewSchema,
  staticPricingViewSchema,
  staticProcessViewSchema,
  staticThankYouViewSchema,
} from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  staticContactSnapshot,
  staticFaqSnapshot,
  staticLegalSnapshots,
  staticNotFoundSnapshot,
  staticPricingSnapshot,
  staticProcessSnapshot,
  staticThankYouSnapshots,
} from '@/static-content/static';
import { PageHero } from '../site/page-hero';
import { ContactDetailsCard, ContactFormSection, ContactNextSteps, EnquiryRouting } from './contact';
import { FaqGroups, FaqTopics } from './faq';
import { LegalPage } from './legal';
import { NotFoundPage } from './not-found';
import { ProcessAfterLaunch, ProcessPoints, ProcessStages } from './process';
import { PricingFactors, PricingIncluded, PricingQuoting, PricingTiers } from './pricing';
import { ThankYouDetails, ThankYouResponse, ThankYouSecondary } from './thank-you';

const render = (node: ReactNode) => renderToStaticMarkup(node);

/** Heading levels in document order. */
const levels = (html: string) => [...html.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));

/** One h1 first, and no heading more than one level below the one before it. */
function expectHeadingOrder(html: string): void {
  const found = levels(html);
  expect(found.filter((level) => level === 1)).toHaveLength(1);
  expect(found[0]).toBe(1);
  found.forEach((level, index) => {
    if (index > 0) expect(level, `heading ${String(index)} of ${found.join(',')}`).toBeLessThanOrEqual((found[index - 1] ?? 1) + 1);
  });
}

const jsonLdTypes = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    (match) => (JSON.parse(match[1] ?? '{}') as { '@type'?: string })['@type'],
  );

describe('static family pages rendered from their snapshots', () => {
  it('pricing: answer before the calls to action, every tier, headings in order', () => {
    const { content, tiers, faqs } = staticPricingViewSchema.parse(staticPricingSnapshot);
    const html = render(
      <>
        <PageHero
          crumbs={[{ name: 'Pricing', path: '/pricing/' }]}
          title={content.hero.title}
          answer={content.hero.answer}
          primaryCta={content.cta.primaryCta}
        />
        <PricingTiers copy={content.tiers} tiers={tiers} action={content.cta.primaryCta} />
        <PricingIncluded copy={content.included} />
        <PricingFactors copy={content.factors} />
        <PricingQuoting copy={content.quoting} />
      </>,
    );
    expectHeadingOrder(html);
    expect(html.indexOf('data-answer-block')).toBeLessThan(html.indexOf(content.cta.primaryCta.href));
    for (const tier of tiers) expect(html).toContain(tier.priceLabel);
    expect(faqs.length).toBeGreaterThan(0);
  });

  it('pricing: an empty state with a way forward while no tier is published', () => {
    const { content } = staticPricingViewSchema.parse(staticPricingSnapshot);
    const html = render(<PricingTiers copy={content.tiers} tiers={[]} action={content.cta.primaryCta} />);
    expect(html).toContain(content.tiers.empty);
    expect(html).toContain(`href="${content.cta.primaryCta.href}"`);
  });

  it('process: every stage with its timing, what you get and what we need', () => {
    const { content, steps } = staticProcessViewSchema.parse(staticProcessSnapshot);
    const html = render(
      <>
        <PageHero crumbs={[{ name: 'Process', path: '/process/' }]} title={content.hero.title} answer={content.hero.answer} />
        <ProcessStages copy={content.steps} steps={steps} action={content.cta.primaryCta} />
        <ProcessPoints id="principles" copy={content.principles} tone="mist" />
        <ProcessPoints id="delays" copy={content.delays} tone="white" />
        <ProcessAfterLaunch copy={content.afterLaunch} />
      </>,
    );
    expectHeadingOrder(html);
    for (const step of steps) {
      expect(html).toContain(step.timing);
      for (const item of [...step.youGet, ...step.weNeed]) expect(html).toContain(item);
    }
    expect(render(<ProcessStages copy={content.steps} steps={[]} action={content.cta.primaryCta} />)).toContain(content.steps.empty);
  });

  it('contact: details, offices, the form slot and a routed link for every topic', () => {
    const view = staticContactViewSchema.parse(staticContactSnapshot);
    const html = render(
      <>
        <PageHero ground="light" crumbs={[{ name: 'Contact', path: '/contact/' }]} title={view.content.hero.title} aside={<ContactDetailsCard view={view} />} />
        <ContactFormSection view={view} form={<form data-testid="lead-form" />} />
        <EnquiryRouting view={view} />
        <ContactNextSteps view={view} />
      </>,
    );
    expectHeadingOrder(html);
    expect(html).toContain('data-testid="lead-form"');
    expect(html).toContain(`href="tel:${view.contact.phoneE164}"`);
    for (const type of view.enquiryTypes) expect(html).toContain(`href="/contact/?enquiry=${type.slug}#contact-form"`);
    expect(render(<EnquiryRouting view={{ ...view, enquiryTypes: [] }} />)).toBe('');
  });

  it('FAQ: topic links to each group and one FAQPage node for all the questions', () => {
    const view = staticFaqViewSchema.parse(staticFaqSnapshot);
    const html = render(
      <>
        <PageHero ground="light" crumbs={[{ name: 'FAQ', path: '/faq/' }]} title={view.hero.title} answer={view.hero.answer}>
          <FaqTopics view={view} />
        </PageHero>
        <FaqGroups view={view} />
      </>,
    );
    expectHeadingOrder(html);
    for (const group of view.groups) expect(html).toContain(`href="#${group.key}"`);
    expect(jsonLdTypes(html).filter((type) => type === 'FAQPage')).toHaveLength(1);
    const empty = render(<FaqGroups view={{ ...view, groups: [] }} />);
    expect(empty).toContain(view.empty);
    expect(jsonLdTypes(empty)).not.toContain('FAQPage');
  });

  it.each(STATIC_THANK_YOU_TYPES)('thank-you %s: what was sent, the response window and a secondary action', (type) => {
    const page = staticThankYouViewSchema.parse(staticThankYouSnapshots[type]);
    const html = render(
      <>
        <PageHero ground="light" crumbs={[{ name: page.eyebrow, path: `/thank-you/${type}/` }]} title={page.title} aside={<ThankYouResponse page={page} />} />
        <ThankYouDetails page={page} />
        <ThankYouSecondary page={page} />
      </>,
    );
    expectHeadingOrder(html);
    expect(html).toContain(page.response.value);
    for (const item of page.received.items) expect(html).toContain(item.replaceAll("'", '&#x27;'));
    expect(html).toContain(`href="${page.secondary.cta.href}"`);
  });

  it.each(STATIC_LEGAL_SLUGS)('legal %s: one h1, contents linking to every section, tables that scroll on their own', (slug) => {
    const page = staticLegalViewSchema.parse(staticLegalSnapshots[slug]);
    const html = render(<LegalPage page={page} path={`/${slug}/`} />);
    expectHeadingOrder(html);
    for (const section of page.sections) {
      expect(html).toContain(`href="#${section.id}"`);
      expect(html).toContain(`id="${section.id}"`);
    }
    if (page.sections.some((section) => section.blocks.some((block) => block.type === 'table'))) {
      expect(html).toContain('overflow-x-auto');
    }
    expect(html).not.toMatch(/href="javascript:/);
  });

  it('not found: a titled page with a search that works without script and six destinations', () => {
    const view = staticNotFoundViewSchema.parse(staticNotFoundSnapshot);
    const html = render(<NotFoundPage view={view} />);
    expectHeadingOrder(html);
    expect(html).toContain('<title>');
    const form = /<form role="search"[^>]*>/.exec(html)?.[0] ?? '';
    expect(form).toContain('action="/sitemap/"');
    expect(form).toContain('method="get"');
    expect(html).toMatch(/<label for="site-search-query"/);
    expect(html).toContain('document.currentScript');
    // The example text is text too (WCAG 1.4.3): the body token at full strength, never faded.
    const input = /<input id="site-search-query"[^>]*>/.exec(html)?.[0] ?? '';
    expect(input).toMatch(/placeholder:text-body(\s|")/);
    for (const item of view.destinations.items) expect(html).toContain(`href="${item.href}"`);
  });

  it('not found: still a working 404, with search and a way on, when the stored copy cannot be read', () => {
    const html = render(<NotFoundPage view={null} />);
    expectHeadingOrder(html);
    expect(html).toContain('<form role="search"');
    expect(html).toContain('href="/contact/"');
    expect(html).not.toContain('href="tel:');
  });
});
