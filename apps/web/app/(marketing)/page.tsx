import { BUDGET_BANDS } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { LeadForm } from '@/components/forms/lead-form';
import { FloatingCta, SiteFooter, SiteHeader, UtilityBar } from '@/components/home/chrome';
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
import { getHomePage } from '@/lib/api';

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
  const home = await getHomePage();
  const { content } = home;
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-999 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <UtilityBar contact={home.contact} reviews={home.reviews} utilityBar={content.utilityBar} />
      <SiteHeader home={home} />

      <main id="main">
        <HomeHero
          hero={content.hero}
          reviews={home.reviews}
          statistics={home.statistics}
          featured={home.projects[0] ?? null}
          form={
            <div className="overflow-hidden rounded-2xl bg-white text-ink shadow-form">
              <div className="border-b border-line bg-mist px-7 py-5">
                <h2 className="font-display text-[20px] font-extrabold">{content.hero.form.heading}</h2>
                <p className="mt-1 text-[14px] text-body">{content.hero.form.subheading}</p>
              </div>
              <LeadForm
                variant="hero"
                formId="home-hero"
                permalink="/"
                submitLabel={content.hero.form.submitLabel}
                success={content.formSuccess}
                budgetOptions={[]}
                footnote={content.hero.form.footnote ?? undefined}
                turnstileSiteKey={turnstileSiteKey}
              />
            </div>
          }
        />
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
              className="rounded-2xl border border-line bg-white p-7 shadow-panel sm:p-9"
            />
          }
        />
      </main>

      <SiteFooter home={home} />
      <FloatingCta link={content.floatingCta} />
      <RevealObserver />
      <AnchorScroll />
    </>
  );
}
