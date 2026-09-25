import { narrowingFilters, type AdminLeadList, type AdminLeadQuery } from '@calwebtech/shared';
import Link from 'next/link';
import { LeadsIcon } from '../icons';
import { EmptyState as Empty } from '../ui/page';
import { TAG, button } from '../ui/styles';
import { budgetShort, received, typeLabel } from './format';
import { leadPanelUrl, leadsUrl } from './query-url';
import { StatusPill } from './status-pill';

/** Previous and next as links, so paging is navigation and keeps working without script. */
export function Pager({ list, query }: { list: AdminLeadList; query: AdminLeadQuery }) {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);

  return (
    <nav aria-label="Pages" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-admin-line2 px-4 py-3 sm:px-5">
      <p className="text-[13px] text-ink-invert-muted tabular-nums">
        Showing {first}–{last} of {list.total}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={leadsUrl(query, { page: list.page - 1 })} disabled={list.page <= 1}>
          Previous
        </PageLink>
        <span className="px-1 text-[13px] text-ink-invert-muted tabular-nums">
          Page {list.page} of {pages}
        </span>
        <PageLink href={leadsUrl(query, { page: list.page + 1 })} disabled={list.page >= pages}>
          Next
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className={button('secondary', 'sm')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={button('secondary', 'sm')}>
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
    <Empty
      icon={<LeadsIcon className="size-5" />}
      title={narrowed > 0 ? 'No leads match these filters' : 'No leads yet'}
      actions={
        <>
          {narrowed > 0 ? (
            <Link href="/admin/leads/" className={button('secondary')}>
              Clear filters
            </Link>
          ) : null}
          <Link href="/admin/forms/" className={button(narrowed > 0 ? 'ghost' : 'primary')}>
            Check forms and routing
          </Link>
        </>
      }
    >
      {narrowed > 0
        ? `${String(narrowed)} ${narrowed === 1 ? 'filter is' : 'filters are'} narrowing this view. Widen the date range or clear them to see everything.`
        : 'Nothing has been captured yet, so nothing is missing. Leads appear here the moment someone sends a form on the site.'}
    </Empty>
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
    <ul className="divide-y divide-admin-line2 lg:hidden">
      {list.items.map((lead) => (
        <li key={lead.id}>
          <Link
            href={leadPanelUrl(query, lead.id)}
            aria-current={lead.id === openLeadId ? 'true' : undefined}
            className={`flex flex-col gap-2 px-4 py-3.5 transition-colors duration-150 ${
              lead.id === openLeadId ? 'bg-admin-mist' : 'hover:bg-admin-hover'
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-semibold text-ink-invert">{lead.name}</span>
              <span className="shrink-0 text-[12.5px] text-admin-muted tabular-nums">{received(lead.createdAt)}</span>
            </span>
            <span className="truncate text-[13.5px] text-ink-invert-muted">
              {[lead.company, lead.source].filter(Boolean).join(' · ') || 'No company given'}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusPill status={lead.status} />
              <span className={TAG}>{typeLabel(lead.type)}</span>
              {lead.budgetBand ? (
                <span className="text-[12.5px] text-ink-invert-muted tabular-nums">{budgetShort(lead.budgetBand)}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
