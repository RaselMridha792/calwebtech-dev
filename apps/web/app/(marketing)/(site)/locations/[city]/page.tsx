import { SITE_ROUTES, locationPath, type LocationDetailView } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ClientsSection,
  LocalContextSection,
  LocalTestimonialSection,
  LocationContactCard,
  LocationServicesSection,
  NearbySection,
  ServiceAreaSection,
  WorkingModelSection,
  type LightTone,
} from '@/components/locations/sections';
import { locationJsonLd } from '@/components/locations/structured-data';
import { JsonLd } from '@/components/seo/json-ld';
import { CtaBand } from '@/components/site/bands';
import { FaqSection } from '@/components/site/faq-section';
import { PageHero } from '@/components/site/page-hero';
import { getLocationPage } from '@/lib/api/locations';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata({ params }: PageProps<'/locations/[city]'>): Promise<Metadata> {
  const { city } = await params;
  const page = await getLocationPage(city);
  if (!page) return { robots: { index: false, follow: false } };
  return sitePageMetadata({
    ...page.seo,
    path: locationPath(page.slug),
    ogImageAlt: page.image?.alt,
  });
}

type SectionEntry = ((tone: LightTone) => ReactNode) | { ink: ReactNode } | null;

/**
 * The sections under the hero, in order. Light sections take the tone their predecessor did
 * not have, so a section the record has no content for never leaves two of the same tone side
 * by side; an ink section resets the rhythm. The hero above is ink.
 */
function alternate(entries: readonly SectionEntry[]): ReactNode[] {
  let previous: LightTone | 'ink' = 'ink';
  return entries.flatMap((entry) => {
    if (entry === null) return [];
    if (typeof entry !== 'function') {
      previous = 'ink';
      return [entry.ink];
    }
    const tone: LightTone = previous === 'white' ? 'tint' : 'white';
    previous = tone;
    return [entry(tone)];
  });
}

function body(page: LocationDetailView): ReactNode[] {
  return alternate([
    (tone) => <LocalContextSection key="local-market" data={page.localContext} city={page.city} tone={tone} />,
    page.clients || page.caseStudies
      ? (tone) => <ClientsSection key="clients" clients={page.clients} caseStudies={page.caseStudies} tone={tone} />
      : null,
    page.services ? (tone) => <LocationServicesSection key="services" data={page.services} tone={tone} /> : null,
    page.workingModel ? { ink: <WorkingModelSection key="how-we-work" data={page.workingModel} /> } : null,
    page.serviceAreaSection
      ? (tone) => (
          <ServiceAreaSection
            key="service-area"
            data={page.serviceAreaSection}
            address={page.address}
            city={page.city}
            tone={tone}
          />
        )
      : null,
    page.testimonial ? (tone) => <LocalTestimonialSection key="client-feedback" data={page.testimonial} tone={tone} /> : null,
    page.nearby ? (tone) => <NearbySection key="other-locations" data={page.nearby} tone={tone} /> : null,
  ]);
}

/** A city page (docs/03-page-specs.md, "Location"): answer first, then local substance, then the local number. */
export default async function LocationPage({ params }: PageProps<'/locations/[city]'>) {
  const { city } = await params;
  const page = await getLocationPage(city);
  if (!page) notFound();

  const path = locationPath(page.slug);
  // No number to call while the site publishes none; the page falls back to email.
  const call =
    page.contact.phone && page.contact.phoneE164
      ? { label: `Call ${page.contact.phone}`, href: `tel:${page.contact.phoneE164}` }
      : { label: 'Email us', href: `mailto:${page.contact.email}` };
  const book = { label: 'Book a consultation', href: SITE_ROUTES.contact };

  return (
    <>
      <PageHero
        crumbs={[
          { name: 'Locations', path: SITE_ROUTES.locations },
          { name: page.city, path },
        ]}
        title={`Web design and development in ${page.city}`}
        answer={page.answerBlock}
        intro={page.heroIntro}
        primaryCta={book}
        secondaryCta={call}
        backdrop={page.image ? { src: page.image.src } : null}
        aside={<LocationContactCard page={page} />}
      />
      {body(page)}
      <CtaBand id="local-contact" tone="band" heading={page.cta.heading} body={page.cta.body} primaryCta={call} secondaryCta={book} />
      {page.faq ? (
        <FaqSection id="faq" heading={page.faq.heading} intro={page.faq.intro} items={page.faq.items} group="location-faq" tone="white" />
      ) : null}
      <JsonLd data={locationJsonLd(page)} />
    </>
  );
}
