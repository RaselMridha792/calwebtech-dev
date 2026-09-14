import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyEmpty, CompanyHero } from '@/components/company/company-hero';
import { AwardList, PartnerList } from '@/components/company/recognition';
import { FaqSection } from '@/components/site/faq-section';
import { EmptyState } from '@/components/site/lists';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { getCompanyAwardsPage } from '@/lib/api/company';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCompanyAwardsPage();
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.content.seo, path: SITE_ROUTES.awards });
}

/** /awards/: every award, newest first, then the partnerships we hold, and questions. */
export default async function AwardsPage() {
  const page = await getCompanyAwardsPage();
  if (!page) notFound();
  const { content } = page;

  return (
    <>
      <CompanyHero hero={content.hero} crumb={{ name: 'Awards', path: SITE_ROUTES.awards }} />

      <Section id="awards-list" tone="white" labelledBy="awards-list-heading">
        <SectionHeading id="awards-list-heading" title={content.recognition.heading} intro={content.recognition.intro} />
        {page.awards.length > 0 ? (
          <AwardList awards={page.awards} />
        ) : (
          <CompanyEmpty list="awards">
            <EmptyState>{content.recognition.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <Section id="partnerships" tone="tint" labelledBy="partnerships-heading">
        <SectionHeading
          id="partnerships-heading"
          title={content.partners.heading}
          intro={content.partners.intro}
          link={page.partners.length > 0 ? { label: content.partners.linkLabel, href: SITE_ROUTES.partners } : null}
        />
        {page.partners.length > 0 ? (
          <PartnerList partners={page.partners} compact />
        ) : (
          <CompanyEmpty list="partners">
            <EmptyState>{content.partners.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <FaqSection
        id="faq"
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={page.faqs}
        group="awards-faq"
        tone="white"
      />
    </>
  );
}
