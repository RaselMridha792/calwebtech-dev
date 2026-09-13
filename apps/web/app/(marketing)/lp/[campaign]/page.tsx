import { BUDGET_BANDS, START_TIMELINES, SEO_DESCRIPTION_MAX } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LeadForm } from '@/components/forms/lead-form';
import {
  FaqSection,
  FinalCtaSection,
  GuaranteesSection,
  LandingFooter,
  PricingSection,
  StickyMobileCta,
} from '@/components/landing/close';
import {
  BeforeAfterSection,
  PartnersSection,
  ProcessSection,
  ResultsSection,
  TeamSection,
  TestimonialsSection,
} from '@/components/landing/proof';
import { ProblemSection, ServicesSection, SolutionSection } from '@/components/landing/story';
import { LandingHeader, LandingHero, TrustBar } from '@/components/landing/top';
import { RevealObserver } from '@/components/motion/reveal-observer';
import { getLandingPage } from '@/lib/api';

// Campaign pages are rendered on first request and cached. Records come from the
// API, which the CI build cannot reach, so nothing is prerendered at build time.
export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams(): { campaign: string }[] {
  return [];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export async function generateMetadata({ params }: PageProps<'/lp/[campaign]'>): Promise<Metadata> {
  const { campaign } = await params;
  const page = await getLandingPage(campaign);
  if (!page) return { robots: { index: false, follow: false } };

  const title = page.seo?.title ?? page.name;
  const description = page.seo?.description ?? truncate(page.content.hero.intro, SEO_DESCRIPTION_MAX);
  const canonical = page.seo?.canonical ?? `/lp/${page.slug}/`;

  return {
    title,
    description,
    alternates: { canonical },
    // Campaign pages are noindex by default; an editor opts a page in per record.
    robots: page.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      ...(page.seo?.ogImage ? { images: [page.seo.ogImage] } : {}),
    },
  };
}

export default async function CampaignLandingPage({ params }: PageProps<'/lp/[campaign]'>) {
  const { campaign } = await params;
  const page = await getLandingPage(campaign);
  if (!page) notFound();

  const { content, contact } = page;
  const permalink = `/lp/${page.slug}/`;

  return (
    <>
      <a
        href="#form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[999] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to the form
      </a>

      <LandingHeader reviews={page.reviews} contact={contact} ctaLabel={content.header.ctaLabel} />

      <main>
        <LandingHero
          hero={content.hero}
          form={
            <div className="overflow-hidden rounded-2xl bg-white text-ink shadow-form">
              <div className="border-b border-line bg-mist px-7 py-5">
                <h2 className="font-display text-[20px] font-extrabold">{content.heroForm.heading}</h2>
                <p className="mt-1 text-[14px] text-body">{content.heroForm.subheading}</p>
              </div>
              <LeadForm
                variant="hero"
                formId="lp-hero"
                landingPageSlug={page.slug}
                permalink={permalink}
                submitLabel={content.heroForm.submitLabel}
                success={content.formSuccess}
                budgetOptions={BUDGET_BANDS}
                assurances={content.heroForm.assurances}
              />
            </div>
          }
        />
        <TrustBar label={content.trustBar.label} clients={page.clients} />
        <ProblemSection problem={content.problem} />
        <SolutionSection solution={content.solution} />
        <ServicesSection services={content.services} />
        <ResultsSection results={content.results} items={page.results} />
        <ProcessSection process={content.process} steps={page.processSteps} />
        <BeforeAfterSection beforeAfter={content.beforeAfter} comparison={page.beforeAfter} />
        <PartnersSection
          partners={content.partners}
          items={page.partners}
          technologies={page.technologies}
        />
        <TeamSection team={content.team} members={page.team} />
        <TestimonialsSection
          testimonials={content.testimonials}
          items={page.testimonials}
          reviews={page.reviews}
        />
        <GuaranteesSection guarantees={content.guarantees} />
        <PricingSection pricing={content.pricing} tiers={page.pricingTiers} />
        <FaqSection faq={content.faq} items={page.faqs} contact={contact} />
        <FinalCtaSection
          finalCta={content.finalCta}
          form={
            <LeadForm
              variant="full"
              formId="lp-final"
              landingPageSlug={page.slug}
              permalink={permalink}
              submitLabel={content.finalCta.submitLabel}
              success={content.formSuccess}
              budgetOptions={BUDGET_BANDS}
              timelineOptions={START_TIMELINES}
              serviceOptions={content.finalCta.serviceOptions}
              footnote={content.finalCta.formFootnote}
              className="rounded-2xl border border-line bg-white p-7 shadow-panel sm:p-9"
            />
          }
        />
      </main>

      <LandingFooter contact={contact} />
      <StickyMobileCta contact={contact} ctaLabel={content.header.ctaLabel} />
      <RevealObserver />
    </>
  );
}
