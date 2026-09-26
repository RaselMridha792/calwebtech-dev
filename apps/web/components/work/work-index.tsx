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
import { ArrowIcon, ChevronIcon } from '../ui/icons';
import { FilterMenus } from './filter-menus';
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
          <div key={count.label} className="flex flex-col-reverse justify-end">
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

/**
 * One option in a filter menu: the term, and how many case studies choosing it leads to.
 * The term is the link's first text, and a chosen one carries `aria-current`. A term that
 * would lead to nothing, alongside the other filters, is shown but not offered as a link.
 */
function FilterOption({
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
  const row =
    'relative flex min-h-11 items-center justify-between gap-6 px-4 py-2 text-[14.5px] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-gold-ink';
  if (count === 0 && !active) {
    return (
      <li>
        <span aria-disabled="true" className={`${row} text-ink-muted/60 before:hidden`}>
          {label}
          <span className="meta">0</span>
        </span>
      </li>
    );
  }
  return (
    <li>
      <a
        href={href}
        aria-current={active ? 'true' : undefined}
        className={`${row} transition-colors duration-150 hover:bg-canvas-sunken focus-visible:bg-canvas-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
          active ? 'bg-canvas-sunken font-semibold text-ink' : 'text-ink before:hidden'
        }`}
      >
        {label}
        {/* A space for the accessible name; flex layout ignores it. */}
        {count === undefined ? null : ' '}
        {count === undefined ? null : <span className="meta text-ink-muted">{String(count)}</span>}
      </a>
    </li>
  );
}

/**
 * The industry, service and platform facets as a toolbar of menus, and the filters in force
 * as removable pills under it. Every option is a link, so every combination is a URL that
 * loads server-side and can be shared; a chosen value links to the view without it, and the
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
  const facets = WORK_FILTER_PARAMS.map((key) => ({ key, label: copy.filters[key], terms: view.filters[FACET_TERMS[key]] }));
  const chosen = facets.flatMap((facet) => {
    const term = facet.terms.find((candidate) => candidate.slug === filters[facet.key]);
    return term ? [{ facet, term }] : [];
  });
  const active = WORK_FILTER_PARAMS.some((key) => Boolean(filters[key]));

  return (
    <nav aria-label={copy.filters.label} className="border-y border-hairline">
      <div className="flex flex-wrap items-center gap-3 py-4">
        {facets.map((facet) => (
          <FilterMenu key={facet.key} facet={facet} filters={filters} caseStudies={caseStudies} allLabel={copy.filters.all} />
        ))}
      </div>
      {active ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline py-3">
          {chosen.map(({ facet, term }) => (
            <a
              key={facet.key}
              href={resultsHref(withoutFacet(filters, facet.key))}
              aria-label={`Remove ${facet.label}: ${term.name}`}
              className="group inline-flex h-9 items-center gap-2.5 bg-navy-900 ps-3.5 pe-3 text-[13.5px] text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="text-ink-invert-muted">{facet.label}</span>
              <span className="font-semibold">{term.name}</span>
              <span aria-hidden className="text-[16px] leading-none text-gold-500 transition-transform duration-200 group-hover:rotate-90">
                ×
              </span>
            </a>
          ))}
          <a
            href={resultsHref({})}
            className="ms-2 inline-flex min-h-9 items-center text-[14px] font-semibold text-gold-ink underline underline-offset-4 hover:text-gold-600"
          >
            {copy.filters.clear}
          </a>
        </div>
      ) : null}
      <FilterMenus />
    </nav>
  );
}

/**
 * One facet as a menu: a button naming the facet, and the chosen term when there is one,
 * that drops a list of every term with its count. A native `<details>`, so it works before
 * and without script; FilterMenus closes it on a click outside or Escape.
 */
function FilterMenu({
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
  const chosen = facet.terms.find((term) => term.slug === selected);
  const without = withoutFacet(filters, key);
  const countWith = (slug: string) =>
    caseStudies.filter((study) => matchesWorkFilters(study, { ...filters, [key]: slug })).length;

  return (
    <details data-filter-menu="" className="group/menu relative max-sm:w-full">
      <summary
        className={`flex h-11 cursor-pointer list-none items-center gap-2.5 border px-4 text-[14.5px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden ${
          chosen
            ? 'border-navy-900 bg-navy-900 text-ink-invert'
            : 'border-hairline bg-canvas-raised text-ink hover:border-ink-muted group-open/menu:border-ink'
        }`}
      >
        <span id={labelId} className={chosen ? 'text-ink-invert-muted' : ''}>
          {facet.label}
        </span>
        {chosen ? <span className="max-w-[16rem] truncate">{chosen.name}</span> : null}
        <ChevronIcon className="ms-auto h-2.5 w-2.5 opacity-70 transition-transform duration-300 ease-out-quint group-open/menu:rotate-180" />
      </summary>
      <div className="absolute top-full left-0 z-30 mt-2 w-full min-w-[18rem] border border-hairline bg-canvas-raised py-2 shadow-lift sm:w-max sm:max-w-[24rem]">
        <ul aria-labelledby={labelId} className="max-h-[22rem] overflow-y-auto">
          <FilterOption href={resultsHref(without)} label={allLabel} active={!selected} />
          {facet.terms.map((term) => {
            const isSelected = selected === term.slug;
            return (
              <FilterOption
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
    </details>
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
  // Pages as numbers on a rule, not a row of boxes: the current one ink with a champagne rule
  // under it, the others muted until the pointer draws theirs.
  const item =
    'relative inline-flex h-12 min-w-11 items-center justify-center gap-2 px-3 font-semibold transition-colors duration-150 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-left after:bg-gold-ink after:transition-transform after:duration-420 after:ease-out-quint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:after:transition-none';
  const idle = `${item} text-ink-muted after:scale-x-0 hover:text-ink hover:after:scale-x-100`;
  return (
    <nav aria-label="Pagination" className="mt-14 border-t border-hairline">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        {page > 1 ? (
          <li className="me-auto">
            <a href={resultsHref(filters, page - 1)} rel="prev" className={idle}>
              <ArrowIcon className="w-4 rotate-180" />
              Previous
            </a>
          </li>
        ) : null}
        {pages.map((number) => (
          <li key={number}>
            <a
              href={resultsHref(filters, number)}
              aria-current={number === page ? 'page' : undefined}
              className={number === page ? `${item} text-ink after:scale-x-100` : idle}
            >
              <span className="sr-only">Page </span>
              {number}
            </a>
          </li>
        ))}
        {page < pageCount ? (
          <li className="ms-auto">
            <a href={resultsHref(filters, page + 1)} rel="next" className={idle}>
              Next
              <ArrowIcon className="w-4" />
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
