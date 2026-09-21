import { BUDGET_BANDS } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { LeadForm } from '@/components/forms/lead-form';
import { HomeHero } from '@/components/home/hero';
import {
  BookSection,
  EstimateBand,
  Insights,
  Locations,
  PricingBands,
  ProcessTimeline,
  Recognition,
  TechnologyProof,
  TestimonialsBand,
  Whitepaper,
  WhyUs,
} from '@/components/home/sections-bottom';
import {
  BeforeAfterHome,
  CapabilityBand,
  FeaturedWork,
  IndustriesGrid,
  LogoBand,
  MidCta,
  ProblemRouter,
  PullQuote,
  ServicesGrid,
} from '@/components/home/sections-top';
import { AnchorScroll } from '@/components/motion/anchor-scroll';
import { RevealObserver } from '@/components/motion/reveal-observer';
import { FloatingCta } from '@/components/site/floating-cta';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';
import { UtilityBar } from '@/components/site/utility-bar';
import { getHomePage } from '@/lib/api';
import { getSiteChrome } from '@/lib/api/site';

// Rendered per request. The CI build cannot reach the API to prerender, and a changed
// record or setting (homepage.indexing) must apply without a redeploy. The API caches
// the built view for 30 seconds (docs/08-decisions.md).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const home = await getHomePage();
  const { title, description } = home.content.seo;
  return {
    title,
    description,
    alternates: { canonical: '/' },
    // Noindex until real content replaces the placeholders and the setting is flipped.
    robots: home.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: 'website', title, description, url: '/' },
  };
}

export default async function HomePage() {
  const [home, chrome] = await Promise.all([getHomePage(), getSiteChrome()]);
  const { content } = home;
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;

  return (
    <>
      <SkipLink />

      <UtilityBar chrome={chrome} />
      {/* The site chrome, with the homepage's own calls to action: its forms are on this page. */}
      <SiteHeader chrome={chrome} ctas={content.header} />

      <main id="main">
        <HomeHero hero={content.hero} reviews={home.reviews} statistics={home.statistics} />
        <LogoBand label={content.clients.label} clients={home.clients} />
        <CapabilityBand capability={content.capability} />
        <ProblemRouter problemRouter={content.problemRouter} faqs={home.problemRouter} />
        <ServicesGrid services={content.services} items={home.services} />
        <FeaturedWork work={content.work} projects={home.projects} />
        <PullQuote quote={home.pullQuote} />
        <MidCta midCta={content.midCta} />
        <BeforeAfterHome beforeAfter={content.beforeAfter} comparison={home.beforeAfter} />
        <IndustriesGrid industries={content.industries} items={home.industries} />
        <EstimateBand estimate={content.estimate} />
        <WhyUs whyUs={content.whyUs} />
        <TechnologyProof technology={content.technology} groups={home.technologyGroups} />
        <ProcessTimeline process={content.process} steps={home.processSteps} />
        <TestimonialsBand
          testimonials={content.testimonials}
          items={home.testimonials}
          reviews={home.reviews}
          video={home.videoTestimonial}
          press={home.press}
        />
        <Recognition recognition={content.recognition} awards={home.awards} expertise={home.expertise} />
        <Insights insights={content.insights} posts={home.posts} />
        <Whitepaper whitepaper={content.whitepaper} guide={home.guide} />
        <Locations locations={content.locations} items={home.locations} />
        <PricingBands pricing={content.pricing} tiers={home.pricingTiers} />
        <BookSection
          book={content.book}
          form={
            <LeadForm
              variant="full"
              formId="home-book"
              leadType="CONSULTATION"
              contactField="phone"
              permalink="/"
              submitLabel={content.book.submitLabel}
              success={content.formSuccess}
              budgetOptions={BUDGET_BANDS}
              serviceOptions={content.book.serviceOptions}
              referralOptions={content.book.referralOptions}
              footnote={content.book.footnote}
              turnstileSiteKey={turnstileSiteKey}
              className="border border-hairline bg-canvas-raised p-7 sm:p-9"
            />
          }
        />
      </main>

      <SiteFooter chrome={chrome} />
      <FloatingCta link={content.floatingCta} />
      <RevealObserver />
      <AnchorScroll />
    </>
  );
}
