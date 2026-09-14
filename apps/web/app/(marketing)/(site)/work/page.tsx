import {
  SITE_ROUTES,
  matchesWorkFilters,
  paginateWork,
  readWorkQuery,
  workIndexIndexing,
  type Metric,
  type WorkIndexView,
} from '@calwebtech/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MetricBand } from '@/components/site/bands';
import { PageHero } from '@/components/site/page-hero';
import { workIndexPageSeo } from '@/components/work/index-metadata';
import { WorkResults, WorkResultsSummary } from '@/components/work/work-index';
import { getWorkIndex } from '@/lib/api/work';
import { sitePageMetadata } from '@/lib/seo/page-metadata';

const CRUMBS = [{ name: 'Case studies', path: SITE_ROUTES.work }];

/** The proof band's figures: the company statistics, then the average review rating. */
function proofFigures(view: WorkIndexView): Metric[] {
  const { statistics, rating } = view.proof;
  const figures: Metric[] = [...statistics];
  if (rating) {
    figures.push({
      value: `${String(rating.average)}/5`,
      label: `${view.copy.ratingLabel} (${String(rating.reviewCount)} reviews)`,
    });
  }
  return figures;
}

export async function generateMetadata({ searchParams }: PageProps<'/work'>): Promise<Metadata> {
  const query = readWorkQuery(await searchParams);
  if (!query) return { robots: { index: false, follow: false } };
  const view = await getWorkIndex();
  const indexing = workIndexIndexing(query, view.copy.targets);
  const seo = indexing.target?.seo ?? view.copy.seo;
  return sitePageMetadata({
    // Later pages are indexable too, so each has its own title and description.
    ...workIndexPageSeo(seo, query.page),
    path: SITE_ROUTES.work,
    // Filter combinations that are not deliberate targets point at /work/ and stay out of search.
    canonicalPath: indexing.canonicalPath,
    noindex: indexing.noindex,
    ogImage: seo.ogImage,
  });
}

/**
 * `/work/`: every published case study, filtered by industry, service and platform from the
 * URL on the server, twelve to a page, with the proof band under them.
 */
export default async function WorkIndexPage({ searchParams }: PageProps<'/work'>) {
  const query = readWorkQuery(await searchParams);
  if (!query) notFound();
  const view = await getWorkIndex();
  const { copy } = view;
  const { target } = workIndexIndexing(query, copy.targets);
  const results = paginateWork(
    view.caseStudies.filter((study) => matchesWorkFilters(study, query.filters)),
    query.page,
  );
  if (!results) notFound();

  return (
    <>
      <PageHero
        crumbs={CRUMBS}
        eyebrow={copy.eyebrow}
        title={target?.title ?? copy.title}
        intro={target?.intro ?? copy.intro}
        primaryCta={copy.primaryCta}
        backdrop={copy.backdrop}
        aside={view.caseStudies.length > 0 ? <WorkResultsSummary view={view} /> : null}
      />
      <WorkResults view={view} filters={query.filters} results={results} />
      <MetricBand
        id="work-proof"
        heading={copy.proofHeading}
        intro={copy.proofIntro}
        metrics={proofFigures(view)}
        outcome={false}
      />
    </>
  );
}
