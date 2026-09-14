import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyEmpty, CompanyHero } from '@/components/company/company-hero';
import { QuestionCards } from '@/components/company/question-cards';
import { personJsonLd } from '@/components/company/structured-data';
import { TeamGrid } from '@/components/company/team-grid';
import { JsonLd } from '@/components/seo/json-ld';
import { FaqSection } from '@/components/site/faq-section';
import { EmptyState } from '@/components/site/lists';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { getCompanyTeamPage } from '@/lib/api/company';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCompanyTeamPage();
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.content.seo, path: SITE_ROUTES.team });
}

/** /team/: every active team member, who is responsible for what, and questions. */
export default async function TeamPage() {
  const page = await getCompanyTeamPage();
  if (!page) notFound();
  const { content } = page;

  return (
    <>
      <CompanyHero hero={content.hero} crumb={{ name: 'Team', path: SITE_ROUTES.team }} />

      <Section id="people" tone="white" labelledBy="people-heading">
        <SectionHeading id="people-heading" title={content.members.heading} intro={content.members.intro} />
        {page.members.length > 0 ? (
          <TeamGrid members={page.members} />
        ) : (
          <CompanyEmpty list="team">
            <EmptyState>{content.members.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <Section id="roles" tone="tint" labelledBy="roles-heading">
        <SectionHeading id="roles-heading" title={content.roles.heading} intro={content.roles.intro} />
        <QuestionCards items={content.roles.items} />
      </Section>

      <FaqSection
        id="faq"
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={page.faqs}
        group="team-faq"
        tone="white"
      />

      {page.members.length > 0 ? (
        <JsonLd data={page.members.map((member) => personJsonLd(member, SITE_ROUTES.team))} />
      ) : null}
    </>
  );
}
