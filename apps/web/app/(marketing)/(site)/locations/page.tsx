import { SITE_ROUTES } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { ApproachSection, LocationCard, type LightTone } from '@/components/locations/sections';
import { CardGrid } from '@/components/site/cards';
import { EmptyState } from '@/components/site/lists';
import { PageHero } from '@/components/site/page-hero';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { getLocationsIndex } from '@/lib/api/locations';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getLocationsIndex();
  return sitePageMetadata({ ...content.seo, path: SITE_ROUTES.locations });
}

/** `/locations/`: published locations grouped by tier (docs/03-page-specs.md, docs/04 "Location rules"). */
export default async function LocationsPage() {
  const { content, groups } = await getLocationsIndex();
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Locations', path: SITE_ROUTES.locations }]}
        title={content.title}
        answer={content.answerBlock}
        intro={content.intro}
        primaryCta={{ label: 'Book a consultation', href: SITE_ROUTES.contact }}
      />
      {groups.length > 0 ? (
        groups.map((group, index) => {
          const tone: LightTone = index % 2 === 0 ? 'white' : 'tint';
          const headingId = `tier-${group.tier.toLowerCase().replace('_', '-')}-heading`;
          return (
            <Section key={group.tier} tone={tone} labelledBy={headingId}>
              <SectionHeading id={headingId} title={group.heading} intro={group.intro} />
              <CardGrid columns={3}>
                {group.locations.map((location, step) => (
                  <LocationCard key={location.slug} location={location} step={step} />
                ))}
              </CardGrid>
            </Section>
          );
        })
      ) : (
        <Section tone="white" deferred={false}>
          <EmptyState action={{ label: 'Contact us', href: SITE_ROUTES.contact }}>{content.empty}</EmptyState>
        </Section>
      )}
      <ApproachSection data={content.approach} />
    </>
  );
}
