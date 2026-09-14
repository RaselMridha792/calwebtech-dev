import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompanyEmpty, CompanyHero } from '@/components/company/company-hero';
import { RatingBreakdown, RatingCard, TestimonialList } from '@/components/company/reviews';
import { testimonialsJsonLd } from '@/components/company/structured-data';
import { JsonLd } from '@/components/seo/json-ld';
import { FaqSection } from '@/components/site/faq-section';
import { EmptyState } from '@/components/site/lists';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { getCompanyTestimonialsPage } from '@/lib/api/company';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getCompanyTestimonialsPage();
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({ ...page.content.seo, path: SITE_ROUTES.testimonials });
}

/**
 * /testimonials/: consented client quotes and the platform ratings, both from our own
 * database. Review and AggregateRating data only for reviews that exist.
 */
export default async function TestimonialsPage() {
  const page = await getCompanyTestimonialsPage();
  if (!page) notFound();
  const { content, reviews, testimonials } = page;
  const structuredData = testimonialsJsonLd(reviews, testimonials);

  return (
    <>
      <CompanyHero
        hero={content.hero}
        crumb={{ name: 'Testimonials', path: SITE_ROUTES.testimonials }}
        aside={reviews.averageRating !== null ? <RatingCard reviews={reviews} /> : undefined}
      />

      <Section id="quotes" tone="white" labelledBy="quotes-heading">
        <SectionHeading id="quotes-heading" title={content.quotes.heading} intro={content.quotes.intro} />
        {testimonials.length > 0 ? (
          <TestimonialList testimonials={testimonials} caseStudyLabel={content.quotes.caseStudyLabel} />
        ) : (
          <CompanyEmpty list="testimonials">
            <EmptyState>{content.quotes.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <Section id="ratings" tone="tint" labelledBy="ratings-heading">
        <SectionHeading id="ratings-heading" title={content.ratings.heading} intro={content.ratings.intro} />
        {reviews.sources.length > 0 ? (
          <RatingBreakdown reviews={reviews} method={content.ratings.method} />
        ) : (
          <CompanyEmpty list="ratings">
            <EmptyState>{content.ratings.empty}</EmptyState>
          </CompanyEmpty>
        )}
      </Section>

      <FaqSection
        id="faq"
        heading={content.faq.heading}
        intro={content.faq.intro}
        items={page.faqs}
        group="testimonials-faq"
        tone="white"
      />

      {structuredData.length > 0 ? <JsonLd data={structuredData} /> : null}
    </>
  );
}
