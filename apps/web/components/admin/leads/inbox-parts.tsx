import { narrowingFilters, type AdminLeadList, type AdminLeadQuery } from '@calwebtech/shared';
import Link from 'next/link';
import { budgetShort, received, typeLabel } from './format';
import { leadPanelUrl, leadsUrl } from './query-url';
import { StatusPill } from './status-pill';

/** Previous and next as links, so paging is navigation and keeps working without script. */
export function Pager({ list, query }: { list: AdminLeadList; query: AdminLeadQuery }) {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 bg-admin-surface px-4 py-2">
      <p className="text-[12px] text-admin-body tabular-nums">
        Showing {first}–{last} of {list.total}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={leadsUrl(query, { page: list.page - 1 })} disabled={list.page <= 1}>
          Previous
        </PageLink>
        <span className="text-[12px] text-admin-body tabular-nums">
          {list.page} / {pages}
        </span>
        <PageLink href={leadsUrl(query, { page: list.page + 1 })} disabled={list.page >= pages}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const style = 'flex h-7 items-center rounded-[4px] border border-admin-line px-2.5 text-[12px] font-semibold';
  if (disabled) {
    return (
      <span aria-disabled className={`${style} text-admin-muted opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${style} text-admin-body hover:border-admin-focus hover:text-admin-ink`}>
      {children}
    </Link>
  );
}

/**
 * Two different absences, which need two different sentences: a database that has captured
 * nothing yet is not a mistake, and a view narrowed to nothing is.
 */
export function EmptyState({ query }: { query: AdminLeadQuery }) {
  const narrowed = narrowingFilters(query);

  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center px-6 py-[72px] text-center">
      <span aria-hidden className="mb-4 size-11 rounded-md border-2 border-admin-line" />
      <h2 className="font-display text-[19px] font-bold tracking-[-0.015em] text-admin-ink">
        {narrowed > 0 ? 'No leads match these filters' : 'No leads yet'}
      </h2>
      <p className="mt-2 text-[13.5px] leading-[22px] text-admin-body">
        {narrowed > 0
          ? `${String(narrowed)} ${narrowed === 1 ? 'filter is' : 'filters are'} narrowing this view. Widen the date range or clear them to see everything.`
          : 'This is a new production database. Nothing has been captured yet, so nothing is missing — the inbox fills itself from the live forms.'}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {narrowed > 0 ? (
          <Link
            href="/admin/leads/"
            className="flex h-8 items-center rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
          >
            Clear filters
          </Link>
        ) : null}
        <Link
          href="/admin/forms/"
          className="flex h-8 items-center rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh"
        >
          Check forms and routing
        </Link>
      </div>
      <p className="mt-4 text-[11.5px] text-admin-muted">
        Leads appear here the moment a form is submitted.
      </p>
    </div>
  );
}

/**
 * Under 1024px the table becomes a list of rows, because eight columns cannot be read at
 * 360px and a horizontally scrolling table is worse than no table.
 */
export function MobileList({
  list,
  query,
  openLeadId,
}: {
  list: AdminLeadList;
  query: AdminLeadQuery;
  openLeadId: string | null;
}) {
  return (
    <ul className="lg:hidden">
      {list.items.map((lead) => (
        <li key={lead.id}>
          <Link
            href={leadPanelUrl(query, lead.id)}
            className={`flex flex-col gap-1.5 border-b border-admin-line px-3.5 py-3 ${
              lead.id === openLeadId ? 'bg-admin-mist' : 'hover:bg-admin-hover'
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[14px] font-bold text-admin-ink">{lead.name}</span>
              <span className="shrink-0 text-[11px] text-admin-muted tabular-nums">{received(lead.createdAt)}</span>
            </span>
            <span className="truncate text-[12.5px] text-admin-body">
              {[lead.company, lead.source].filter(Boolean).join(' · ') || '—'}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill status={lead.status} />
              <span className="rounded-[3px] border border-admin-line px-1.5 py-px text-[10.5px] font-semibold tracking-[0.04em] text-admin-body uppercase">
                {typeLabel(lead.type)}
              </span>
              <span className="text-[12px] text-admin-body tabular-nums">{budgetShort(lead.budgetBand)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
