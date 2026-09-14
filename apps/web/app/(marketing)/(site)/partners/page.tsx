import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyEmpty, CompanyHero } from '@/components/company/company-hero';
import { PartnerList } from '@/components/company/recognition';
import { FaqSection } from '@/components/site/faq-section';
import { EmptyState } from '@/components/site/lists';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { reveal } from '@/components/ui/primitives';
import { getCompanyPartnersPage } from '@/lib/api/company';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCompanyPartnersPage();
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.content.seo, path: SITE_ROUTES.partners });
}

/** /partners/: each partnership and what it means for a client, how we stay independent, questions. */
export default async function PartnersPage() {
  const page = await getCompanyPartnersPage();
  if (!page) notFound();
  const { content } = page;

  return (
    <>
      <CompanyHero hero={content.hero} crumb={{ name: 'Partners', path: SITE_ROUTES.partners }} />

      <Section id="partners-list" tone="white" labelledBy="partners-list-heading">
        <SectionHeading id="partners-list-heading" title={content.partners.heading} intro={content.partners.intro} />
        {page.partners.length > 0 ? (
          <PartnerList partners={page.partners} meaningLabel={content.partners.meaningLabel} />
        ) : (
          <CompanyEmpty list="partners">
            <EmptyState>{content.partners.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <Section id="independence" tone="tint" labelledBy="independence-heading">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              id="independence-heading"
              title={content.independence.heading}
              intro={content.independence.intro}
              className=""
            />
          </div>
          <div className="space-y-5 text-[17px] leading-relaxed lg:col-span-7" {...reveal(1)}>
            {content.independence.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>

      <FaqSection
        id="faq"
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={page.faqs}
        group="partners-faq"
        tone="white"
      />
    </>
  );
}
