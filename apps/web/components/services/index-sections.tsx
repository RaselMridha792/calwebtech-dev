import { servicePath, type ServicesIndexView } from '@calwebtech/shared';
import { CtaBand } from '@/components/site/bands';
import { CardGrid, LinkCard } from '@/components/site/cards';
import { EmptyState } from '@/components/site/lists';
import { Section, groundOf } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { reveal } from '@/components/ui/primitives';
import { PRICE_LABEL } from './detail-sections';
import { sectionTones } from './tones';

/**
 * The published services, one section per category in order, or the empty state while
 * nothing is published. The guidance band follows for a buyer who cannot tell which fits.
 * Each section's H2 is the question a buyer types; the category's name is the label above it.
 */
export function ServiceGroups({ view }: { view: ServicesIndexView }) {
  const { content, groups } = view;
  const tones = sectionTones(
    groups.map(() => 'light'),
    { before: 'band' },
  );
  return (
    <>
      {groups.length === 0 ? (
        <Section id="services" tone="white" deferred={false}>
          <EmptyState action={content.guidance.primaryCta}>{content.empty}</EmptyState>
        </Section>
      ) : (
        groups.map((group, index) => {
          const id = `services-${group.slug ?? 'other'}`;
          const tone = tones[index] ?? 'white';
          const ground = groundOf(tone);
          return (
            <Section key={id} id={id} tone={tone} labelledBy={`${id}-heading`} deferred={index > 0}>
              <p className={`mb-2 text-[14px] font-semibold ${ground === 'dark' ? 'text-ink-invert-muted' : ''}`} {...reveal()}>
                {group.name}
              </p>
              <SectionHeading id={`${id}-heading`} title={group.heading} intro={group.description} ground={ground} />
              <CardGrid columns={3}>
                {group.services.map((service, step) => (
                  <LinkCard
                    key={service.slug}
                    href={servicePath(service.slug)}
                    title={service.title}
                    body={service.summary}
                    meta={service.priceLabel ? `${PRICE_LABEL}: ${service.priceLabel}` : null}
                    linkLabel={content.cardLinkLabel}
                    step={step}
                  />
                ))}
              </CardGrid>
            </Section>
          );
        })
      )}
      <CtaBand
        id="service-guidance"
        tone="band"
        heading={content.guidance.heading}
        body={content.guidance.body}
        primaryCta={content.guidance.primaryCta}
        secondaryCta={content.guidance.secondaryCta}
      />
    </>
  );
}
