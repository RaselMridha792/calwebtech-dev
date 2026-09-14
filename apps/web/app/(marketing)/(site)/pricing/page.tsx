import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { CtaBand } from '@/components/site/bands';
import { PageHero } from '@/components/site/page-hero';
import { TopicFaqSection } from '@/components/static/faq';
import { PricingFactors, PricingIncluded, PricingQuoting, PricingTiers } from '@/components/static/pricing';
import { getStaticPricing } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getStaticPricing();
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.pricing });
}

/**
 * /pricing/ (docs/03-page-specs.md): the published price bands from `PricingTier`, what
 * every project includes, what moves the number, how the fixed price is set and the
 * pricing questions from `Faq`. Copy is the `static.pricing` setting.
 */
export default async function PricingPage() {
  const { content, tiers, faqs } = await getStaticPricing();
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Pricing', path: SITE_ROUTES.pricing }]}
        title={content.hero.title}
        answer={content.hero.answer}
        intro={content.hero.intro}
        primaryCta={content.cta.primaryCta}
        secondaryCta={content.cta.secondaryCta}
        backdrop={content.backdrop}
      />
      <PricingTiers copy={content.tiers} tiers={tiers} action={content.cta.primaryCta} />
      <PricingIncluded copy={content.included} />
      <PricingFactors copy={content.factors} />
      <PricingQuoting copy={content.quoting} />
      <TopicFaqSection heading={content.faq.heading} intro={content.faq.intro} items={faqs} group="pricing-faq" />
      <CtaBand
        id="pricing-cta"
        heading={content.cta.heading}
        body={content.cta.body}
        primaryCta={content.cta.primaryCta}
        secondaryCta={content.cta.secondaryCta}
        tone="band"
      />
    </>
  );
}
