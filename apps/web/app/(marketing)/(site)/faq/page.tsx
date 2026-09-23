import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { CtaBand } from '@/components/site/bands';
import { PageHero } from '@/components/site/page-hero';
import { FaqGroups, FaqTopics } from '@/components/static/faq';
import { getStaticFaq } from '@/lib/api/static';
import { sitePageMetadata } from '@/lib/seo/page-metadata';
import { HERO_BACKDROPS } from '@/lib/hero-backdrops';

export async function generateMetadata(): Promise<Metadata> {
  const view = await getStaticFaq();
  return sitePageMetadata({ ...view.seo, path: SITE_ROUTES.faq });
}

/**
 * /faq/ (docs/03-page-specs.md): every site-wide question from `Faq`, grouped by the topics
 * the `static.faq` setting lists, with one FAQPage node. Groups without questions are left out.
 */
export default async function FaqPage() {
  const view = await getStaticFaq();
  return (
    <>
      <PageHero
        backdrop={HERO_BACKDROPS.faq}
        crumbs={[{ name: 'Frequently asked questions', path: SITE_ROUTES.faq }]}
        title={view.hero.title}
        answer={view.hero.answer}
        intro={view.hero.intro}
      >
        <FaqTopics view={view} />
      </PageHero>
      <FaqGroups view={view} />
      <CtaBand
        id="faq-cta"
        heading={view.cta.heading}
        body={view.cta.body}
        primaryCta={view.cta.primaryCta}
        secondaryCta={view.cta.secondaryCta}
        tone="band"
      />
    </>
  );
}
