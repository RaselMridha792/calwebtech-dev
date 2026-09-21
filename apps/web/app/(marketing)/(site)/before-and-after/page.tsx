import { SITE_ROUTES, caseStudyPath, type WorkComparison } from '@calwebtech/shared';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/site/lists';
import { PageHero } from '@/components/site/page-hero';
import { Section } from '@/components/site/section';
import { SectionHeading } from '@/components/site/section-heading';
import { reveal } from '@/components/ui/primitives';
import { ComparisonSlider, ComparisonTable } from '@/components/work/comparison';
import { getBeforeAndAfter } from '@/lib/api/work';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getBeforeAndAfter();
  return sitePageMetadata({ ...copy.seo, path: SITE_ROUTES.beforeAndAfter });
}

type Copy = Awaited<ReturnType<typeof getBeforeAndAfter>>['copy'];

/** One project: what changed, the figures that moved and the slider, linked to its case study. */
function Comparison({ comparison, copy, index }: { comparison: WorkComparison; copy: Copy; index: number }) {
  const id = `comparison-${String(index + 1)}`;
  const headingId = `${id}-heading`;
  // White and ink alternate after the ink hero; neither repeats the closing band's tint.
  const tone = index % 2 === 0 ? 'white' : 'ink';
  const dark = tone === 'ink';
  return (
    <Section id={id} tone={tone} labelledBy={headingId} deferred={index > 0}>
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className={`lg:col-span-4 ${dark ? 'lg:order-last' : ''}`}>
          <SectionHeading
            id={headingId}
            title={comparison.heading}
            intro={comparison.summary}
            ground={dark ? 'dark' : 'light'}
            size="medium"
            className="mb-8"
          />
          <div className={dark ? '' : ' bg-navy-900 p-6'}>
            <ComparisonTable
              figures={comparison.metrics}
              caption={copy.metricsLabel}
              beforeLabel={copy.beforeLabel}
              afterLabel={copy.afterLabel}
            />
          </div>
          {comparison.slug ? (
            <a
              href={caseStudyPath(comparison.slug)}
              className={
                dark
                  ? 'mt-8 inline-flex h-12 items-center  bg-canvas-raised px-6 font-semibold text-ink hover:bg-canvas-sunken'
                  : 'mt-8 inline-flex h-12 items-center  bg-navy-900 px-6 font-semibold text-ink-invert hover:bg-navy-700'
              }
            >
              {copy.caseStudyLabel}
              <span className="sr-only">{`: ${comparison.clientName}`}</span>
            </a>
          ) : null}
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          <ComparisonSlider before={comparison.before} after={comparison.after} clientName={comparison.clientName} />
        </div>
      </div>
    </Section>
  );
}

/** `/before-and-after/`: every published project with before and after screenshots. */
export default async function BeforeAndAfterPage() {
  const { copy, comparisons } = await getBeforeAndAfter();
  return (
    <>
      <PageHero
        crumbs={[{ name: 'Before and after', path: SITE_ROUTES.beforeAndAfter }]}
        eyebrow={copy.eyebrow}
        title={copy.title}
        intro={copy.intro}
        backdrop={copy.backdrop}
      />
      {comparisons.length > 0 ? (
        comparisons.map((comparison, index) => (
          <Comparison key={`${comparison.clientName}-${String(index)}`} comparison={comparison} copy={copy} index={index} />
        ))
      ) : (
        <Section tone="white" deferred={false}>
          <EmptyState action={copy.emptyAction}>{copy.empty}</EmptyState>
        </Section>
      )}
    </>
  );
}
