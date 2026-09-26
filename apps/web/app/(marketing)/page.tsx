import { CONSULTATION_PATH } from '@calwebtech/shared';
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
import { SubscribeBand } from '@/components/home/subscribe-band';
import { FloatingCta } from '@/components/site/floating-cta';
import { SiteFooter } from '@/components/site/site-footer';
import { HeaderScrollState } from '@/components/site/header-scroll';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';
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

      {/* The site chrome, with the homepage's own calls to action: its forms are on this page. */}
      <HeaderScrollState />
      <SiteHeader chrome={chrome} ctas={content.header} />

      <main id="main">
        <HomeHero
          hero={content.hero}
          reviews={home.reviews}
          statistics={home.statistics}
          form={
            <div className="bg-canvas-raised text-ink">
              <div className="border-b border-hairline bg-canvas-sunken px-7 py-5">
                <p className="heading-md">{content.hero.form.heading}</p>
                <p className="body-sm mt-1 text-ink-muted">{content.hero.form.subheading}</p>
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
          action={
            <div className="border border-hairline bg-canvas-raised p-7 sm:p-9">
              <p className="heading-md text-ink">{content.book.heading}</p>
              <p className="body-base mt-3 text-ink-muted">{content.book.footnote}</p>
              <a
                href={CONSULTATION_PATH}
                className="button-label mt-7 inline-flex min-h-12 items-center bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {content.book.submitLabel}
              </a>
            </div>
          }
        />
        <SubscribeBand copy={content.subscribe} turnstileSiteKey={turnstileSiteKey} />
      </main>

      <SiteFooter chrome={chrome} />
      <FloatingCta link={content.floatingCta} />
      <AnchorScroll />
    </>
  );
}
