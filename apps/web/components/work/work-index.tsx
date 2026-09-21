import {
  WORK_FILTER_PARAMS,
  matchesWorkFilters,
  workIndexPath,
  type WorkCaseStudyCard,
  type WorkFilterParam,
  type WorkFilters,
  type WorkIndexView,
  type WorkPage,
  type WorkTerm,
} from '@calwebtech/shared';
import { asPhrase } from '@/lib/text';
import { CardGrid, CaseStudyCard } from '../site/cards';
import { EmptyState } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';

/** The results list's id: filter and page links return the reader to it after the reload. */
export const WORK_RESULTS_ID = 'work-results';

const resultsHref = (filters: WorkFilters, page = 1) => `${workIndexPath(filters, page)}#${WORK_RESULTS_ID}`;

/** "Showing 1 to 12 of 25 case studies". */
const showing = ({ from, to, total }: { from: number; to: number; total: number }) =>
  `Showing ${String(from)} to ${String(to)} of ${String(total)} ${total === 1 ? 'case study' : 'case studies'}`;

/** The filters without one facet. */
function withoutFacet(filters: WorkFilters, key: WorkFilterParam): WorkFilters {
  const rest: WorkFilters = {};
  for (const other of WORK_FILTER_PARAMS) {
    const value = filters[other];
    if (other !== key && value) rest[other] = value;
  }
  return rest;
}

/**
 * Beside the hero: the listing summed up in figures, then the headline result of the
 * first three case studies. Figures come straight from the published case studies.
 */
export function WorkResultsSummary({ view }: { view: WorkIndexView }) {
  const { caseStudies, filters, copy } = view;
  if (caseStudies.length === 0) return null;
  const counts = [
    { value: caseStudies.length, label: copy.summaryLabels.caseStudies },
    { value: filters.industries.length, label: copy.summaryLabels.industries },
    { value: filters.services.length, label: copy.summaryLabels.services },
    { value: filters.platforms.length, label: copy.summaryLabels.platforms },
  ].filter((count) => count.value > 0);
  const highlights = caseStudies.slice(0, 3).flatMap((study) => {
    const [metric] = study.metrics;
    return metric ? [{ study, metric }] : [];
  });

  return (
    <div className="glass p-6 sm:p-8">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-2">
        {counts.map((count) => (
          <div key={count.label} className="flex flex-col-reverse">
            <dt className="mt-1.5 text-[13.5px] text-ink-invert-muted">{count.label}</dt>
            <dd className="font-display text-[34px] leading-none font-extrabold">{count.value}</dd>
          </div>
        ))}
      </dl>
      {highlights.length > 0 ? (
        <div className="mt-8 border-t border-ink-invert/15 pt-6">
          <p className="text-[14px] font-semibold text-ink-invert-muted">{copy.highlightsLabel}</p>
          <ul className="mt-4 space-y-4">
            {highlights.map(({ study, metric }) => (
              <li key={study.slug} className="flex items-baseline gap-4">
                <span className="w-[5.5rem] shrink-0 font-display text-[26px] leading-none font-extrabold text-gold-ink">
                  {metric.value}
                </span>
                <span className="text-[14.5px] leading-snug text-ink-invert-muted">
                  {`${asPhrase(metric.label)}, `}
                  <b className="font-semibold text-ink-invert">{study.clientName}</b>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const FACET_TERMS: Record<WorkFilterParam, keyof WorkIndexView['filters']> = {
  industry: 'industries',
  service: 'services',
  platform: 'platforms',
};

const chip =
  'inline-flex min-h-10 items-center gap-1.5  border px-3.5 py-1.5 text-[14px] font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary';
const chipIdle = `${chip} border-hairline bg-canvas-raised text-ink hover:border-ink`;
const chipActive = `${chip} border-ink bg-navy-900 text-ink-invert`;

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <li>
      <a href={href} aria-current={active ? 'true' : undefined} className={active ? chipActive : chipIdle}>
        {label}
        {/* A space for the accessible name; flex layout ignores it. */}
        {count === undefined ? null : ' '}
        {count === undefined ? null : (
          <span className={`font-normal ${active ? 'text-ink-invert-muted' : 'text-ink-muted'}`}>{`(${String(count)})`}</span>
        )}
      </a>
    </li>
  );
}

/**
 * The industry, service and platform facets as links, so every combination is a URL that
 * loads server-side and can be shared. A selected value links to the view without it; the
 * count says how many case studies the link leads to.
 */
export function WorkFilterBar({
  view,
  filters,
}: {
  view: WorkIndexView;
  filters: WorkFilters;
}) {
  const { copy, caseStudies } = view;
  const active = WORK_FILTER_PARAMS.some((key) => Boolean(filters[key]));
  const facets = WORK_FILTER_PARAMS.map((key) => ({ key, label: copy.filters[key], terms: view.filters[FACET_TERMS[key]] }));

  return (
    <nav aria-label={copy.filters.label} className="border border-hairline bg-canvas-raised p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:gap-8">
        {facets.map((facet) => (
          <FilterFacet key={facet.key} facet={facet} filters={filters} caseStudies={caseStudies} allLabel={copy.filters.all} />
        ))}
        {active ? (
          <div className="lg:self-end">
            <a
              href={resultsHref({})}
              className="inline-flex min-h-10 items-center py-1.5 font-semibold text-gold-ink underline underline-offset-4 hover:text-gold-600"
            >
              {copy.filters.clear}
            </a>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function FilterFacet({
  facet,
  filters,
  caseStudies,
  allLabel,
}: {
  facet: { key: WorkFilterParam; label: string; terms: readonly WorkTerm[] };
  filters: WorkFilters;
  caseStudies: readonly WorkCaseStudyCard[];
  allLabel: string;
}) {
  const { key } = facet;
  const labelId = `work-filter-${key}`;
  const selected = filters[key];
  const without = withoutFacet(filters, key);
  const countWith = (slug: string) =>
    caseStudies.filter((study) => matchesWorkFilters(study, { ...filters, [key]: slug })).length;

  return (
    <div>
      <p id={labelId} className="font-display text-[15px] font-bold text-ink">
        {facet.label}
      </p>
      <ul aria-labelledby={labelId} className="mt-3 flex flex-wrap gap-2">
        <FilterChip href={resultsHref(without)} label={allLabel} active={!selected} />
        {facet.terms.map((term) => {
          const isSelected = selected === term.slug;
          return (
            <FilterChip
              key={term.slug}
              href={resultsHref(isSelected ? without : { ...filters, [key]: term.slug })}
              label={term.name}
              count={countWith(term.slug)}
              active={isSelected}
            />
          );
        })}
      </ul>
    </div>
  );
}

/** Previous, numbered and next page links, shown only past one page. */
export function WorkPagination({
  filters,
  page,
  pageCount,
}: {
  filters: WorkFilters;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const box =
    'inline-flex h-11 min-w-11 items-center justify-center  border px-3 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary';
  return (
    <nav aria-label="Pagination" className="mt-12">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {page > 1 ? (
          <li>
            <a href={resultsHref(filters, page - 1)} rel="prev" className={`${box} border-hairline bg-canvas-raised text-ink hover:border-ink`}>
              Previous
            </a>
          </li>
        ) : null}
        {pages.map((number) => (
          <li key={number}>
            <a
              href={resultsHref(filters, number)}
              aria-current={number === page ? 'page' : undefined}
              className={number === page ? `${box} border-ink bg-navy-900 text-ink-invert` : `${box} border-hairline bg-canvas-raised text-ink hover:border-ink`}
            >
              <span className="sr-only">Page </span>
              {number}
            </a>
          </li>
        ))}
        {page < pageCount ? (
          <li>
            <a href={resultsHref(filters, page + 1)} rel="next" className={`${box} border-hairline bg-canvas-raised text-ink hover:border-ink`}>
              Next
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/**
 * The filters, the matching case studies and pagination. An empty listing says nothing is
 * published; a filter combination with no match says so and offers to clear the filters.
 */
export function WorkResults({
  view,
  filters,
  results,
}: {
  view: WorkIndexView;
  filters: WorkFilters;
  results: WorkPage<WorkCaseStudyCard>;
}) {
  const { copy } = view;
  const headingId = `${WORK_RESULTS_ID}-heading`;
  const published = view.caseStudies.length > 0;

  return (
    <Section id={WORK_RESULTS_ID} tone="white" labelledBy={headingId} deferred={false}>
      <SectionHeading id={headingId} title={copy.resultsHeading} className="mb-8" />
      {published ? (
        <>
          <WorkFilterBar view={view} filters={filters} />
          {results.total > 0 ? (
            <p className="mt-8 text-[15px]">{showing(results)}</p>
          ) : null}
          {results.total > 0 ? (
            <CardGrid className="mt-6">
              {results.items.map((study, index) => (
                <CaseStudyCard key={study.slug} study={study} linkLabel={copy.caseStudyLabel} step={index} />
              ))}
            </CardGrid>
          ) : (
            <EmptyState className="mt-8" action={{ label: copy.filters.clear, href: resultsHref({}) }}>
              {copy.noMatches}
            </EmptyState>
          )}
          <WorkPagination filters={filters} page={results.page} pageCount={results.pageCount} />
        </>
      ) : (
        <EmptyState action={copy.primaryCta}>{copy.empty}</EmptyState>
      )}
    </Section>
  );
}
