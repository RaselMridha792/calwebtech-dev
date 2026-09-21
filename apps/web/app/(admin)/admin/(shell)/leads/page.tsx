import {
  ADMIN_LEADS_PAGE_SIZE,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  adminLeadDetailSchema,
  adminLeadFilterOptionsSchema,
  adminLeadListSchema,
  adminLeadQuerySchema,
  canWrite,
  type AdminLeadQuery,
} from '@calwebtech/shared';
import { BulkBar } from '@/components/admin/leads/bulk-bar';
import { FilterBar } from '@/components/admin/leads/filter-bar';
import { EmptyState, MobileList, Pager } from '@/components/admin/leads/inbox-parts';
import { LeadPanel } from '@/components/admin/leads/lead-panel';
import { LeadsTable } from '@/components/admin/leads/leads-table';
import { leadsUrl } from '@/components/admin/leads/query-url';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * The leads inbox: one table for every capture point (docs/12-admin-dashboard.md).
 *
 * The whole view — filters, sort, page, and which lead is open — lives in the URL, so this
 * is a server component that re-renders on navigation. The only client code on the screen
 * is the bulk bar and the panel's save, which are the two things that genuinely need state.
 */
const SELECTION_FORM = 'leads-selection';

export default async function LeadsPage({ searchParams }: PageProps<'/admin/leads'>) {
  const user = await requireModule('leads', 'read');
  const params = await searchParams;
  const query = adminLeadQuerySchema.parse(params);
  const openLeadId = typeof params.lead === 'string' ? params.lead : null;

  const [list, options, open] = await Promise.all([
    adminGet(`/admin/leads?${toSearch(query)}`, adminLeadListSchema),
    adminGet('/admin/leads/filter-options', adminLeadFilterOptionsSchema),
    openLeadId ? adminFind(`/admin/leads/${encodeURIComponent(openLeadId)}`, adminLeadDetailSchema) : null,
  ]);

  const mayWrite = canWrite(user.role, 'leads');

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Leads</h1>
            <p className="mt-0.5 text-[12.5px] text-admin-body">
              {list.total} {list.total === 1 ? 'lead' : 'leads'} · {list.unassignedNew} unassigned and new · one table
              for every capture point
            </p>
          </div>
          <a
            href={`/api/admin/leads/export?${toSearch(query)}`}
            className="flex h-8 items-center rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink"
          >
            Export view
          </a>
        </div>

        <FilterBar query={query} options={options} />

        {mayWrite ? (
          <BulkBar
            containerId={SELECTION_FORM}
            owners={options.owners}
            statuses={LEAD_STATUSES.map((value) => ({ value, label: LEAD_STATUS_LABELS[value] }))}
          />
        ) : null}

        {list.items.length === 0 ? (
          <div className="flex-1 overflow-auto bg-admin-surface">
            <EmptyState query={query} />
          </div>
        ) : (
          <>
            {/*
              Not a form: the checkboxes only need a common ancestor the bulk bar can read,
              and every action on this screen is a link or an API call, never a submit.
            */}
            <div id={SELECTION_FORM} className="min-h-0 flex-1 overflow-auto bg-admin-surface">
              <div className="hidden lg:block">
                <LeadsTable list={list} query={query} openLeadId={openLeadId} />
              </div>
              <MobileList list={list} query={query} openLeadId={openLeadId} />
            </div>
            <Pager list={list} query={query} />
          </>
        )}
      </div>

      {open ? (
        <LeadPanel
          lead={open}
          query={query}
          owners={options.owners}
          mayWrite={mayWrite}
          statuses={LEAD_STATUSES.map((value) => ({ value, label: LEAD_STATUS_LABELS[value] }))}
        />
      ) : null}
    </div>
  );
}

/** The API takes the same query string the page was given, minus what it defaults anyway. */
function toSearch(query: AdminLeadQuery): string {
  const url = leadsUrl(query);
  const search = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(search);
  if (query.pageSize !== ADMIN_LEADS_PAGE_SIZE) params.set('pageSize', String(query.pageSize));
  return params.toString();
}
