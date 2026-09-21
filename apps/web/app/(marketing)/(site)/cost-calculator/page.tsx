import { CALCULATOR_ANCHORS, CALCULATOR_PATH } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { CalculatorSection } from '@/components/calculator/calculator-section';
import { Methodology, PriceBands } from '@/components/calculator/methodology';
import { CtaBand } from '@/components/site/bands';
import { FaqSection } from '@/components/site/faq-section';
import { PageHero } from '@/components/site/page-hero';
import { getCalculatorPage } from '@/lib/api/calculator';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getCalculatorPage();
  return sitePageMetadata({ ...content.seo, path: CALCULATOR_PATH });
}

/**
 * `/cost-calculator/` (docs/03-page-specs.md, "Cost calculator"): the honest range, the
 * eight questions, the result with its breakdown, how the figures are worked out, and the
 * pricing questions buyers ask.
 *
 * Structured data: BreadcrumbList from the hero, FAQPage from the questions
 * (docs/04-seo-keyword-map.md). The Organization node is the layout's.
 */
export default async function CostCalculatorPage() {
  const view = await getCalculatorPage();
  const { content } = view;

  return (
    <>
      <PageHero
        crumbs={[{ name: 'Cost calculator', path: CALCULATOR_PATH }]}
        title={content.hero.title}
        answer={content.hero.answer}
        intro={content.hero.intro}
        primaryCta={{ label: content.calculator.labels.start, href: `#${CALCULATOR_ANCHORS.tool}` }}
        secondaryCta={{ label: content.calculator.labels.methodology, href: `#${CALCULATOR_ANCHORS.methodology}` }}
        backdrop={content.hero.backdrop}
        aside={<PriceBands view={view} />}
      >
        {content.hero.points.length > 0 ? (
          <ul className="mt-8 space-y-3 text-[15.5px] text-ink-invert-muted">
            {content.hero.points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-ink" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </PageHero>

      <CalculatorSection
        view={view}
        permalink={CALCULATOR_PATH}
        {...(process.env.TURNSTILE_SITE_KEY ? { turnstileSiteKey: process.env.TURNSTILE_SITE_KEY } : {})}
      />

      <Methodology view={view} />

      <FaqSection
        id={CALCULATOR_ANCHORS.faq}
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={view.faqs}
        group="calculator-faq"
        tone="mist"
      />

      <CtaBand
        id="calculator-cta"
        heading={content.cta.heading}
        body={content.cta.body}
        primaryCta={content.cta.primaryCta}
        secondaryCta={content.cta.secondaryCta}
        tone="band"
      />
    </>
  );
}
