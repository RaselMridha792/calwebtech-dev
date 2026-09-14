import { SITE_ROUTES, industryPath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  IndustryCaseStudies,
  IndustryCompliance,
  IndustryHighlights,
  IndustryIntegrations,
  IndustryPainPoints,
  IndustryResults,
  IndustryServices,
} from '@/components/industries/industry-sections';
import { industryServiceJsonLd } from '@/components/industries/json-ld';
import { industrySectionTones } from '@/components/industries/section-tones';
import { JsonLd } from '@/components/seo/json-ld';
import { FaqSection } from '@/components/site/faq-section';
import { PageHero } from '@/components/site/page-hero';
import { getIndustryPage } from '@/lib/api/industries';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/industries/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await getIndustryPage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.seo, path: industryPath(page.slug) });
}

/**
 * An industry page (docs/03-page-specs.md, Industry detail): the answer block under the H1,
 * then pain points, matched services, compliance notes, case studies, the sector's results
 * with a client quote, integrations and FAQs. The site layout closes it with the
 * conversion band. Sections without copy or records are left out.
 */
export default async function IndustryPage({ params }: PageProps<'/industries/[slug]'>) {
  const { slug } = await params;
  const page = await getIndustryPage(slug);
  if (!page) notFound();

  const tones = industrySectionTones(page);
  const light = (tone: (typeof tones)[keyof typeof tones]) => (tone === 'tint' ? 'tint' : 'white');
  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Industries', path: SITE_ROUTES.industries },
          { name: page.name, path: industryPath(page.slug) },
        ]}
        title={page.title}
        answer={page.answerBlock}
        intro={page.hero.intro}
        primaryCta={page.hero.primaryCta}
        secondaryCta={page.hero.secondaryCta}
        backdrop={page.hero.backdrop}
        aside={page.hero.highlights.length > 0 ? <IndustryHighlights hero={page.hero} /> : undefined}
      />
      {page.painPoints ? <IndustryPainPoints section={page.painPoints} tone={light(tones.painPoints)} /> : null}
      {page.services ? <IndustryServices section={page.services} tone={light(tones.services)} /> : null}
      {page.compliance ? <IndustryCompliance section={page.compliance} tone={light(tones.compliance)} /> : null}
      {page.caseStudies ? <IndustryCaseStudies section={page.caseStudies} tone={light(tones.caseStudies)} /> : null}
      {page.results ? <IndustryResults section={page.results} backdrop={page.hero.backdrop} /> : null}
      {page.integrations ? (
        <IndustryIntegrations section={page.integrations} tone={light(tones.integrations)} />
      ) : null}
      {page.faq ? (
        <FaqSection
          id="industry-faq"
          heading={page.faq.heading}
          intro={page.faq.intro}
          items={page.faq.items}
          group="industry-faq"
          tone={light(tones.faq)}
        />
      ) : null}
      <JsonLd data={industryServiceJsonLd(page)} />
    </>
  );
}
