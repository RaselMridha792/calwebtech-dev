import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyEmpty, CompanyHero } from '@/components/company/company-hero';
import { QuestionCards } from '@/components/company/question-cards';
import { TechnologyGroups } from '@/components/company/technology-groups';
import { MetricBand } from '@/components/site/bands';
import { FaqSection } from '@/components/site/faq-section';
import { EmptyState } from '@/components/site/lists';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { getCompanyTechnologyPage } from '@/lib/api/company';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCompanyTechnologyPage();
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.content.seo, path: SITE_ROUTES.technology });
}

/** /technology/: technologies grouped by category with proficiency notes, this site as proof, questions. */
export default async function TechnologyPage() {
  const page = await getCompanyTechnologyPage();
  if (!page) notFound();
  const { content } = page;

  return (
    <>
      <CompanyHero hero={content.hero} crumb={{ name: 'Technology', path: SITE_ROUTES.technology }} />

      <Section id="stack" tone="white" labelledBy="stack-heading">
        <SectionHeading id="stack-heading" title={content.stack.heading} intro={content.stack.intro} />
        {page.groups.length > 0 ? (
          <TechnologyGroups groups={page.groups} />
        ) : (
          <CompanyEmpty list="technology">
            <EmptyState>{content.stack.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <MetricBand
        id="this-site"
        heading={content.proof.heading}
        intro={content.proof.intro}
        metrics={content.proof.stats}
        tone="ink"
        outcome={false}
      />

      <Section id="choosing" tone="tint" labelledBy="choosing-heading">
        <SectionHeading id="choosing-heading" title={content.choosing.heading} intro={content.choosing.intro} />
        <QuestionCards items={content.choosing.items} />
      </Section>

      <FaqSection
        id="faq"
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={page.faqs}
        group="technology-faq"
        tone="white"
      />
    </>
  );
}
