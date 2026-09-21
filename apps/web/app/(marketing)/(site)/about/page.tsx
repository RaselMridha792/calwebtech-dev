import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyEmpty, CompanyHero } from '@/components/company/company-hero';
import { QuestionCards } from '@/components/company/question-cards';
import { AwardList, PartnerList } from '@/components/company/recognition';
import { Story } from '@/components/company/story';
import { aboutPageJsonLd } from '@/components/company/structured-data';
import { TeamGrid } from '@/components/company/team-grid';
import { JsonLd } from '@/components/seo/json-ld';
import { MetricBand } from '@/components/site/bands';
import { FaqSection } from '@/components/site/faq-section';
import { EmptyState } from '@/components/site/lists';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { getCompanyAboutPage } from '@/lib/api/company';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCompanyAboutPage();
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.content.seo, path: SITE_ROUTES.about });
}

/** /about/: story, figures, team preview, values, recognition and questions (docs/03-page-specs.md). */
export default async function AboutPage() {
  const page = await getCompanyAboutPage();
  if (!page) notFound();
  const { content } = page;
  const hasRecognition = page.awards.length > 0 || page.partners.length > 0;

  return (
    <>
      <CompanyHero hero={content.hero} crumb={{ name: 'About', path: SITE_ROUTES.about }} />

      <Story story={content.story} />

      <MetricBand
        id="figures"
        heading={content.statistics.heading}
        intro={content.statistics.intro}
        metrics={page.statistics.map((statistic) => ({ value: `${statistic.value}${statistic.suffix}`, label: statistic.label }))}
        tone="ink"
        outcome={false}
      />

      <Section id="team" tone="tint" labelledBy="team-heading">
        <SectionHeading
          id="team-heading"
          title={content.team.heading}
          intro={content.team.intro}
          link={page.team.length > 0 ? { label: content.team.linkLabel, href: SITE_ROUTES.team } : null}
        />
        {page.team.length > 0 ? (
          <TeamGrid members={page.team} />
        ) : (
          <CompanyEmpty list="team">
            <EmptyState>{content.team.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <Section id="values" tone="white" labelledBy="values-heading">
        <SectionHeading id="values-heading" title={content.values.heading} intro={content.values.intro} />
        <QuestionCards items={content.values.items} />
      </Section>

      <Section id="recognition" tone="mist" labelledBy="recognition-heading">
        <SectionHeading
          id="recognition-heading"
          title={content.recognition.heading}
          intro={content.recognition.intro}
          link={page.awards.length > 0 ? { label: content.recognition.awardsLinkLabel, href: SITE_ROUTES.awards } : null}
        />
        {hasRecognition ? (
          <>
            {page.awards.length > 0 ? <AwardList awards={page.awards} compact /> : null}
            {page.partners.length > 0 ? (
              <div className={page.awards.length > 0 ? 'mt-6' : ''}>
                <PartnerList partners={page.partners} compact />
                <a
                  href={SITE_ROUTES.partners}
                  className="mt-6 inline-block py-1 font-semibold text-gold-ink hover:text-gold-600"
                >
                  {content.recognition.partnersLinkLabel}
                </a>
              </div>
            ) : null}
          </>
        ) : (
          <CompanyEmpty list="recognition">
            <EmptyState>{content.recognition.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <FaqSection
        id="faq"
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={page.faqs}
        group="about-faq"
        tone="white"
      />

      <JsonLd
        data={aboutPageJsonLd({ path: SITE_ROUTES.about, name: content.seo.title, description: content.seo.description })}
      />
    </>
  );
}
