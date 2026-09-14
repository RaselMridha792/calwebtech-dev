import {
  industryPath,
  servicePath,
  workFilterPath,
  type WorkCaseStudyView,
  type WorkVideoTestimonial,
} from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { byline } from '@/lib/text';
import { Showreel } from '../home/showreel';
import { CardGrid, CaseStudyCard, LinkCard, TestimonialCard } from '../site/cards';
import { Section, type SectionTone } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import { ComparisonSlider, ComparisonTable } from './comparison';

type View = WorkCaseStudyView;

/** A light section tone for a case study section; the before and after section is ink. */
export type LightTone = Extract<SectionTone, 'white' | 'tint' | 'mist'>;

/**
 * Beside the hero: the cover image with the headline outcome over it, or the outcome alone
 * when the case study has no cover.
 */
export function CaseStudyHeadline({ view }: { view: View }) {
  const { headline, cover } = view;
  const figure = (
    <div className={cover ? 'absolute inset-x-4 bottom-4 rounded-xl bg-ink/90 p-5 sm:p-6' : 'glass rounded-2xl p-7'}>
      <p className="text-[13.5px] font-medium text-white/75">{headline.label}</p>
      <p className="mt-2 font-display text-[44px] leading-none font-extrabold text-result sm:text-[52px]">
        {headline.metric.value}
      </p>
      <p className="mt-2 text-[15px] text-white/85">{headline.metric.label}</p>
    </div>
  );
  if (!cover) return figure;
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-media">
      <div className="relative aspect-4/3 bg-ink2">
        <ResponsiveImage
          src={cover.src}
          alt={cover.alt}
          fill
          priority
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover"
        />
      </div>
      {figure}
    </div>
  );
}

const linkClass = 'font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary';

function GlanceItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-[13.5px] font-medium">{label}</dt>
      <dd className="mt-1.5 text-[16px] leading-snug text-ink">{children}</dd>
    </div>
  );
}

function joinLinks(items: readonly { key: string; href: string; label: string }[]) {
  return items.map((item, index) => (
    <span key={item.key}>
      {index > 0 ? ', ' : null}
      <a href={item.href} className={linkClass}>
        {item.label}
      </a>
    </span>
  ));
}

/** Whether the at-a-glance strip has anything to show. */
export function hasAtAGlance({ atAGlance: glance }: View): boolean {
  return (
    glance.industry !== null ||
    glance.services.length > 0 ||
    glance.platforms.length > 0 ||
    glance.location !== null ||
    glance.duration !== null ||
    glance.year !== null ||
    glance.liveUrl !== null
  );
}

/** Industry, services, platform, location, duration, year and live site, where known. */
export function AtAGlance({ view, tone }: { view: View; tone: LightTone }) {
  if (!hasAtAGlance(view)) return null;
  const { atAGlance: glance, labels, headings } = view;
  const headingId = 'at-a-glance-heading';
  return (
    <Section id="at-a-glance" tone={tone} labelledBy={headingId}>
      <SectionHeading id={headingId} title={headings.atAGlance} size="medium" className="mb-8" />
      <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {glance.industry ? (
          <GlanceItem label={labels.industry}>
            <a href={industryPath(glance.industry.slug)} className={linkClass}>
              {glance.industry.name}
            </a>
          </GlanceItem>
        ) : null}
        {glance.services.length > 0 ? (
          <GlanceItem label={labels.services}>
            {joinLinks(glance.services.map((service) => ({ key: service.slug, href: servicePath(service.slug), label: service.name })))}
          </GlanceItem>
        ) : null}
        {glance.platforms.length > 0 ? (
          <GlanceItem label={labels.platform}>
            {joinLinks(
              glance.platforms.map((platform) => ({
                key: platform.slug,
                href: workFilterPath({ platform: platform.slug }),
                label: platform.name,
              })),
            )}
          </GlanceItem>
        ) : null}
        {glance.location ? <GlanceItem label={labels.location}>{glance.location}</GlanceItem> : null}
        {glance.duration ? <GlanceItem label={labels.duration}>{glance.duration}</GlanceItem> : null}
        {glance.year ? <GlanceItem label={labels.year}>{String(glance.year)}</GlanceItem> : null}
        {glance.liveUrl ? (
          <GlanceItem label={labels.liveSite}>
            <a href={glance.liveUrl} className={linkClass} rel="noopener" target="_blank">
              {labels.visitSite}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </GlanceItem>
        ) : null}
      </dl>
    </Section>
  );
}

/** A heading beside its paragraphs: the challenge, the approach, the build and the outcome. */
export function NarrativeSection({
  id,
  heading,
  paragraphs,
  tone,
  children,
}: {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  tone: LightTone;
  children?: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <Section id={id} tone={tone} labelledBy={headingId}>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading id={headingId} title={heading} size="medium" className="mb-0" />
        </div>
        <div className="max-w-[68ch] space-y-5 text-[17px] leading-relaxed lg:col-span-7" {...reveal(1)}>
          {paragraphs.map((paragraph, index) => (
            <p key={`${String(index)}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
          {children}
        </div>
      </div>
    </Section>
  );
}

/** How the published figures were measured, under the outcome. */
export function MeasurementNote({ label, children }: { label: string; children: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-6">
      <p className="font-display text-[16px] font-bold text-ink">{label}</p>
      <p className="mt-2 text-[15.5px] leading-relaxed">{children}</p>
    </div>
  );
}

/** Photographs that show the kind of work, each with its own description. */
export function GallerySection({ view, tone }: { view: View; tone: LightTone }) {
  if (view.gallery.length === 0) return null;
  const headingId = 'gallery-heading';
  const columns = view.gallery.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <Section id="gallery" tone={tone} labelledBy={headingId}>
      <SectionHeading id={headingId} title={view.headings.gallery} size="medium" className="mb-10" />
      <ul className={`grid gap-5 ${columns}`}>
        {view.gallery.map((image, index) => (
          <li key={image.src} className="relative aspect-4/3 overflow-hidden rounded-2xl bg-mist" {...reveal(index)}>
            <ResponsiveImage
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The site before and after, with the slider and what moved. */
export function CaseStudyBeforeAfter({ view }: { view: View }) {
  const { beforeAfter } = view;
  if (!beforeAfter) return null;
  const headingId = 'before-after-heading';
  return (
    <Section id="before-after" tone="ink" labelledBy={headingId}>
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <SectionHeading id={headingId} title={view.headings.beforeAfter} ground="dark" size="medium" className="mb-8" />
          <ComparisonTable
            figures={beforeAfter.metrics}
            caption={view.labels.comparison}
            beforeLabel={view.labels.before}
            afterLabel={view.labels.after}
          />
        </div>
        <div className="lg:col-span-8">
          <ComparisonSlider before={beforeAfter.before} after={beforeAfter.after} clientName={view.clientName} />
        </div>
      </div>
    </Section>
  );
}

/**
 * The client on camera: the cover as the poster, and a play button that opens the video in
 * a dialog. The video downloads only when it is played.
 */
export function VideoTestimonialCard({ video }: { video: WorkVideoTestimonial }) {
  const detail = byline(video.role, video.company);
  const who = [video.clientName, video.company].filter((part): part is string => Boolean(part)).join(', ');
  return (
    <figure className="relative h-full min-h-[280px] overflow-hidden rounded-2xl bg-ink">
      {video.poster ? (
        <ResponsiveImage
          src={video.poster.src}
          alt={video.poster.alt}
          fill
          sizes="(min-width: 1024px) 30vw, 100vw"
          className="object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/50 to-ink/10" aria-hidden="true" />
      <Showreel variant="overlay" label={`Play video testimonial from ${who}`} videoUrl={video.videoUrl} poster={null} />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 p-6">
        <b className="block text-white">{video.clientName}</b>
        {detail ? <span className="text-[14px] text-white/75">{detail}</span> : null}
      </figcaption>
    </figure>
  );
}

/** Whether the client's words section has anything to show. */
export function hasClientWords(view: View): boolean {
  return view.quote !== null || view.videoTestimonial !== null;
}

/**
 * The client's words: the quote and the video testimonial, each from a testimonial they
 * consented to publish. Either may be missing; with neither, nothing renders.
 */
export function QuoteSection({ view, tone }: { view: View; tone: LightTone }) {
  if (!hasClientWords(view)) return null;
  const { quote, videoTestimonial } = view;
  const headingId = 'quote-heading';
  return (
    <Section id="client-quote" tone={tone} labelledBy={headingId}>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading id={headingId} title={view.headings.quote} size="medium" className="mb-0" />
        </div>
        <div className={`grid gap-6 lg:col-span-7 ${quote && videoTestimonial ? 'sm:grid-cols-2' : ''}`} {...reveal(1)}>
          {quote ? <TestimonialCard testimonial={quote} showRating /> : null}
          {videoTestimonial ? <VideoTestimonialCard video={videoTestimonial} /> : null}
        </div>
      </div>
    </Section>
  );
}

/** Every service the project used, linked up to its page. */
export function RelatedServices({ view, tone }: { view: View; tone: LightTone }) {
  if (view.relatedServices.length === 0) return null;
  const headingId = 'related-services-heading';
  return (
    <Section id="related-services" tone={tone} labelledBy={headingId}>
      <SectionHeading id={headingId} title={view.headings.relatedServices} size="medium" className="mb-10" />
      <CardGrid>
        {view.relatedServices.map((service, index) => (
          <LinkCard
            key={service.slug}
            href={servicePath(service.slug)}
            title={service.name}
            body={service.summary}
            linkLabel={view.labels.serviceLink}
            step={index}
          />
        ))}
      </CardGrid>
    </Section>
  );
}

/** Up to three similar case studies. */
export function RelatedCaseStudies({ view, tone }: { view: View; tone: LightTone }) {
  if (view.relatedCaseStudies.length === 0) return null;
  const headingId = 'related-case-studies-heading';
  return (
    <Section id="related-case-studies" tone={tone} labelledBy={headingId}>
      <SectionHeading id={headingId} title={view.headings.relatedCaseStudies} size="medium" className="mb-10" />
      <CardGrid>
        {view.relatedCaseStudies.map((study, index) => (
          <CaseStudyCard key={study.slug} study={study} linkLabel={view.labels.caseStudyLink} step={index} />
        ))}
      </CardGrid>
    </Section>
  );
}
