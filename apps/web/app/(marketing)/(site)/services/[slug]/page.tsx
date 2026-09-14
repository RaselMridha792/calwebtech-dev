import { SITE_ROUTES, servicePath } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Fragment, type ReactNode } from 'react';
import {
  ComparisonSection,
  HeroPriceBand,
  IncludedSection,
  IndustriesSection,
  PricingSection,
  ProblemSection,
  ProcessSection,
  ProofSection,
  RelatedServicesSection,
  TechnologySection,
  TestimonialSection,
} from '@/components/services/detail-sections';
import { EnquirySection } from '@/components/services/enquiry-section';
import { serviceOfferJsonLd } from '@/components/services/json-ld';
import { sectionTones, type TonePreference } from '@/components/services/tones';
import { JsonLd } from '@/components/seo/json-ld';
import { FaqSection } from '@/components/site/faq-section';
import { PageHero } from '@/components/site/page-hero';
import type { SectionTone } from '@/components/site/section';
import { getServicePage } from '@/lib/api/services';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/services/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const page = await getServicePage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.seo, path: servicePath(page.slug) });
}

interface Slot {
  key: string;
  prefers: TonePreference;
  render: (tone: SectionTone) => ReactNode;
}

/**
 * A service page, with the sections of docs/03-page-specs.md "Service detail" in order.
 * Sections a record has nothing for are left out, and the tones of the rest are assigned
 * after, so the section rhythm never repeats a tone.
 */
export default async function ServicePage({ params }: PageProps<'/services/[slug]'>) {
  const { slug } = await params;
  const page = await getServicePage(slug);
  if (!page) notFound();

  const { problem, included, process: steps, technology, proof, comparison, pricing, industries, testimonial, faq, related } = page;
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;
  const slots: Slot[] = [];
  if (problem) slots.push({ key: 'problem', prefers: 'light', render: (tone) => <ProblemSection problem={problem} tone={tone} /> });
  if (included) slots.push({ key: 'included', prefers: 'light', render: (tone) => <IncludedSection included={included} tone={tone} /> });
  if (steps) slots.push({ key: 'process', prefers: 'ink', render: (tone) => <ProcessSection process={steps} tone={tone} /> });
  if (technology) {
    slots.push({ key: 'technology', prefers: 'light', render: (tone) => <TechnologySection technology={technology} tone={tone} /> });
  }
  if (proof) slots.push({ key: 'proof', prefers: 'light', render: (tone) => <ProofSection proof={proof} tone={tone} /> });
  if (comparison) {
    slots.push({ key: 'comparison', prefers: 'light', render: (tone) => <ComparisonSection comparison={comparison} tone={tone} /> });
  }
  if (pricing) {
    slots.push({ key: 'pricing', prefers: 'band', render: (tone) => <PricingSection pricing={pricing} price={page.price} tone={tone} /> });
  }
  if (industries) {
    slots.push({ key: 'industries', prefers: 'light', render: (tone) => <IndustriesSection industries={industries} tone={tone} /> });
  }
  if (testimonial) {
    slots.push({ key: 'testimonial', prefers: 'light', render: (tone) => <TestimonialSection testimonial={testimonial} tone={tone} /> });
  }
  if (faq) {
    slots.push({
      key: 'faq',
      prefers: 'light',
      render: (tone) => (
        <FaqSection
          heading={faq.heading}
          intro={faq.intro}
          items={faq.items}
          group="service-faq"
          tone={tone === 'ink' || tone === 'band' ? 'white' : tone}
        />
      ),
    });
  }
  slots.push({
    key: 'enquiry',
    prefers: 'light',
    render: (tone) => <EnquirySection page={page} tone={tone} turnstileSiteKey={turnstileSiteKey} />,
  });
  if (related) {
    slots.push({ key: 'related', prefers: 'light', render: (tone) => <RelatedServicesSection related={related} tone={tone} /> });
  }
  const tones = sectionTones(slots.map((slot) => slot.prefers));

  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Services', path: SITE_ROUTES.services },
          { name: page.title, path: servicePath(page.slug) },
        ]}
        eyebrow={page.category?.name}
        title={page.title}
        answer={page.answerBlock}
        intro={page.hero.outcome}
        primaryCta={page.hero.primaryCta}
        secondaryCta={page.hero.secondaryCta}
        backdrop={page.hero.backdrop}
      >
        {page.price ? <HeroPriceBand price={page.price} /> : null}
      </PageHero>
      {slots.map((slot, index) => (
        <Fragment key={slot.key}>{slot.render(tones[index] ?? 'white')}</Fragment>
      ))}
      <JsonLd data={serviceOfferJsonLd(page)} />
    </>
  );
}
