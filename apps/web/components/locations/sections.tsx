import {
  SITE_ROUTES,
  locationPath,
  servicePath,
  type LocationCard as LocationCardView,
  type LocationDetailView,
  type LocationsIndexView,
} from '@calwebtech/shared';
import { CardGrid, CaseStudyCard, LinkCard, TestimonialCard } from '../site/cards';
import { Section, groundOf, type SectionTone } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { ArrowIcon, PhoneIcon } from '../ui/icons';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

/** A light section tone; the page alternates them so no two neighbours match. */
export type LightTone = Extract<SectionTone, 'white' | 'tint'>;

const placeName = (city: string, state: string | null) => (state ? `${city}, ${state}` : city);

/** The office card beside the H1: service area statement, address and how to get in touch. */
export function LocationContactCard({ page }: { page: LocationDetailView }) {
  return (
    <div className="glass p-7 text-[15px]" {...reveal(1)}>
      <p className="font-display text-[19px] font-bold">
        {page.address ? `Our ${page.city} office` : `Serving ${page.city}`}
      </p>
      {page.serviceArea ? <p className="mt-2.5 leading-relaxed text-ink-invert-muted">{page.serviceArea}</p> : null}
      <dl className="mt-6 space-y-4 border-t border-ink-invert/15 pt-6">
        {page.address ? (
          <div>
            <dt className="text-[13px] text-ink-invert-muted">Address</dt>
            <dd className="mt-1 whitespace-pre-line text-ink-invert">{page.address}</dd>
          </div>
        ) : null}
        {page.contact.phone && page.contact.phoneE164 ? (
          <div>
            <dt className="text-[13px] text-ink-invert-muted">Phone</dt>
            <dd className="mt-1">
              <a href={`tel:${page.contact.phoneE164}`} className="inline-flex items-center gap-2 py-1 font-semibold text-ink-invert hover:underline">
                <PhoneIcon className="h-4 w-4" />
                {page.contact.phone}
              </a>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[13px] text-ink-invert-muted">Email</dt>
          <dd className="mt-1">
            <a href={`mailto:${page.contact.email}`} className="inline-block py-1 font-semibold break-all text-ink-invert hover:underline">
              {page.contact.email}
            </a>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** What the local market is like: the record's local context and the sectors that shape it. */
export function LocalContextSection({ data, city, tone }: { data: LocationDetailView['localContext']; city: string; tone: LightTone }) {
  return (
    <Section id="local-market" tone={tone} labelledBy="local-market-heading">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-7">
          <SectionHeading id="local-market-heading" title={data.heading} intro={data.intro} className="mb-8" />
          <div className="max-w-[68ch] space-y-5 text-[17px] leading-relaxed">
            {data.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
        </div>
        {data.industries.length > 0 ? (
          <div className="lg:col-span-5" {...reveal(1)}>
            <div className="border border-hairline bg-canvas-raised p-7 lg:sticky lg:top-28">
              <p className="font-display text-[19px] font-bold text-ink">{`Sectors that shape ${city}`}</p>
              <ul className="mt-5 divide-y divide-hairline border-t border-hairline text-[16px] text-ink">
                {data.industries.map((industry) => (
                  <li key={industry} className="py-3.5">
                    {industry}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** Clients served here and the case studies chosen for this market. */
export function ClientsSection({
  clients,
  caseStudies,
  tone,
}: {
  clients: LocationDetailView['clients'];
  caseStudies: LocationDetailView['caseStudies'];
  tone: LightTone;
}) {
  if (!clients && !caseStudies) return null;
  return (
    <Section id="clients" tone={tone} labelledBy={clients ? 'clients-heading' : 'case-studies-heading'}>
      {clients ? (
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-7">
            <SectionHeading id="clients-heading" title={clients.heading} intro={clients.intro} className="mb-0" />
          </div>
          <ul className="flex flex-wrap content-start gap-3 lg:col-span-5 lg:pt-3" {...reveal(1)}>
            {clients.names.map((name) => (
              <li key={name} className="border border-hairline bg-canvas-raised px-5 py-3 font-display text-[18px] font-bold text-ink">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {caseStudies ? (
        <div className={clients ? 'mt-16 lg:mt-20' : ''}>
          <SectionHeading
            id="case-studies-heading"
            title={caseStudies.heading}
            intro={caseStudies.intro}
            link={{ label: 'See all work', href: SITE_ROUTES.work }}
          />
          <CardGrid columns={3}>
            {caseStudies.items.map((study, index) => (
              <CaseStudyCard key={study.slug} study={study} step={index} />
            ))}
          </CardGrid>
        </div>
      ) : null}
    </Section>
  );
}

/** Services, described for this market, each linking to its service page. */
export function LocationServicesSection({ data, tone }: { data: LocationDetailView['services']; tone: LightTone }) {
  if (!data) return null;
  return (
    <Section id="services" tone={tone} labelledBy="services-heading">
      <SectionHeading
        id="services-heading"
        title={data.heading}
        intro={data.intro}
        link={{ label: 'All services', href: SITE_ROUTES.services }}
      />
      <CardGrid columns={3}>
        {data.items.map((item, index) => (
          <LinkCard
            key={item.slug}
            href={servicePath(item.slug)}
            title={item.title}
            body={item.body}
            linkLabel="See the service"
            step={index}
          />
        ))}
      </CardGrid>
    </Section>
  );
}

/** Meeting model, time zone and response, on the ink ground. */
export function WorkingModelSection({ data }: { data: LocationDetailView['workingModel'] }) {
  if (!data) return null;
  return (
    <Section id="how-we-work" tone="ink" labelledBy="how-we-work-heading">
      <SectionHeading id="how-we-work-heading" title={data.heading} intro={data.intro} ground={groundOf('ink')} />
      {/* Points on rules, not glass cards; each rule draws champagne under the pointer. */}
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {data.points.map((point, index) => (
          <li key={point.title} className="group relative border-t border-ink-invert/20 pt-7 pb-2 before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-gold-500 before:transition-transform before:duration-500 before:ease-out-quint hover:before:scale-x-100" {...reveal(index)}>
            <p className="meta text-ink-invert-muted transition-colors duration-150 group-hover:text-gold-500">{String(index + 1).padStart(2, '0')}</p>
            <p className="heading-md mt-4">{point.title}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-invert-muted">{point.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The places covered in person, the office address and a photograph of the area. */
export function ServiceAreaSection({
  data,
  address,
  city,
  tone,
}: {
  data: LocationDetailView['serviceAreaSection'];
  address: string | null;
  city: string;
  tone: LightTone;
}) {
  if (!data) return null;
  return (
    <Section id="service-area" tone={tone} labelledBy="service-area-heading">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-20">
        <div className={data.image ? 'lg:col-span-6' : 'lg:col-span-10'}>
          <SectionHeading id="service-area-heading" title={data.heading} intro={data.intro} className="mb-8" />
          {data.places.length > 0 ? (
            <ul className="flex flex-wrap gap-2.5 text-[15px]" aria-label={`Places we cover around ${city}`}>
              {data.places.map((place) => (
                <li key={place} className="flex items-center gap-2 border border-hairline bg-canvas-raised px-3.5 py-2 text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-navy-900" aria-hidden="true" />
                  {place}
                </li>
              ))}
            </ul>
          ) : null}
          {address ? (
            <div className="mt-8 border-t border-hairline pt-6" {...reveal(1)}>
              <p className="text-[14px]">{`${city} office`}</p>
              <p className="mt-1.5 text-[17px] leading-relaxed whitespace-pre-line text-ink">{address}</p>
            </div>
          ) : null}
        </div>
        {data.image ? (
          <div className="lg:col-span-6" {...reveal(1)}>
            <div className="relative aspect-[4/3] overflow-hidden bg-canvas-sunken">
              <ResponsiveImage
                src={data.image.src}
                alt={data.image.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** A quote from a client in this market. */
export function LocalTestimonialSection({ data, tone }: { data: LocationDetailView['testimonial']; tone: LightTone }) {
  if (!data) return null;
  return (
    <Section id="client-feedback" tone={tone} labelledBy="client-feedback-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5">
          <SectionHeading
            id="client-feedback-heading"
            title={data.heading}
            link={{ label: 'Read more client feedback', href: SITE_ROUTES.testimonials }}
            className="mb-0"
          />
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          <TestimonialCard testimonial={data.item} showRating />
        </div>
      </div>
    </Section>
  );
}

/** Links to at most six other published locations. */
export function NearbySection({ data, tone }: { data: LocationDetailView['nearby']; tone: LightTone }) {
  if (!data) return null;
  return (
    <Section id="other-locations" tone={tone} labelledBy="other-locations-heading">
      <SectionHeading
        id="other-locations-heading"
        title={data.heading}
        intro={data.intro}
        link={{ label: 'All locations', href: SITE_ROUTES.locations }}
      />
      <CardGrid columns={3}>
        {data.items.map((item, index) => (
          <LinkCard
            key={item.slug}
            href={locationPath(item.slug)}
            title={placeName(item.city, item.state)}
            body={item.serviceArea}
            linkLabel={`Web design in ${item.city}`}
            step={index}
          />
        ))}
      </CardGrid>
    </Section>
  );
}

/**
 * A location on `/locations/`: no box, the photograph slowly pushing in under the pointer,
 * or a rule drawing champagne when there is none. The link is stretched over the entry.
 */
export function LocationCard({ location, step }: { location: LocationCardView; step: number }) {
  return (
    <li
      className="group relative flex flex-col has-focus-visible:outline-2 has-focus-visible:outline-offset-8 has-focus-visible:outline-focus"
      {...reveal(step)}
    >
      {location.image ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-canvas-sunken">
          <ResponsiveImage
            src={location.image.src}
            alt={location.image.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[1600ms] ease-out-quint motion-safe:group-hover:scale-105"
          />
        </div>
      ) : null}
      <div
        className={`relative flex flex-1 flex-col ${
          location.image
            ? 'pt-6'
            : 'border-t border-hairline pt-6 before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-gold-ink before:transition-transform before:duration-500 before:ease-out-quint group-hover:before:scale-x-100'
        }`}
      >
        <h3 className="display-md text-ink">{placeName(location.city, location.state)}</h3>
        {location.serviceArea ? <p className="body-base mt-3 text-ink-muted">{location.serviceArea}</p> : null}
        {location.address ? (
          <p className="meta mt-5 border-t border-hairline pt-4 whitespace-pre-line text-ink">{location.address}</p>
        ) : null}
        <a
          href={locationPath(location.slug)}
          className="button-label mt-auto flex items-center gap-2 self-start pt-5 text-gold-ink after:absolute after:inset-0 focus-visible:outline-none"
        >
          {`Web design in ${location.city}`}
          <ArrowIcon className="w-4 transition-transform duration-420 ease-out-quint motion-safe:group-hover:translate-x-1.5" />
        </a>
      </div>
    </li>
  );
}

/** How clients anywhere are served, on the index page. */
export function ApproachSection({ data }: { data: LocationsIndexView['content']['approach'] }) {
  if (!data) return null;
  return (
    <Section id="working-remotely" tone="ink" labelledBy="working-remotely-heading">
      <SectionHeading id="working-remotely-heading" title={data.heading} intro={data.intro} ground="dark" />
      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {data.points.map((point, index) => (
          <li key={point.title} className="group relative border-t border-ink-invert/20 pt-7 pb-2 before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-gold-500 before:transition-transform before:duration-500 before:ease-out-quint hover:before:scale-x-100" {...reveal(index)}>
            <p className="heading-md">{point.title}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-invert-muted">{point.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
