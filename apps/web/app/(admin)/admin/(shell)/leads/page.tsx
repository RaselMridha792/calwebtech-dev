import {
  ADMIN_LEADS_PAGE_SIZE,
  CLOSED_LEAD_STATUSES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  adminLeadDetailSchema,
  adminLeadFilterOptionsSchema,
  adminLeadListSchema,
  adminLeadQuerySchema,
  canRead,
  canWrite,
  type AdminLeadList,
  type AdminLeadQuery,
  type LeadStatus,
} from '@calwebtech/shared';
import { DownloadIcon } from '@/components/admin/icons';
import { BulkBar } from '@/components/admin/leads/bulk-bar';
import { FilterBar } from '@/components/admin/leads/filter-bar';
import { EmptyState, MobileList, Pager } from '@/components/admin/leads/inbox-parts';
import { LeadPanel } from '@/components/admin/leads/lead-panel';
import { LeadsTable } from '@/components/admin/leads/leads-table';
import { leadsUrl } from '@/components/admin/leads/query-url';
import { LinkTabs, PageHeader, type TabLink } from '@/components/admin/ui/page';
import { CARD, button } from '@/components/admin/ui/styles';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * The leads inbox: one table for every capture point (docs/12-admin-dashboard.md).
 *
 * The whole view — filters, sort, page, and which lead is open — lives in the URL, so this
 * is a server component that re-renders on navigation. The only client code on the screen
 * is the bulk bar and the panel's save, which are the two things that genuinely need state.
 *
 * The page scrolls as one, so the table is never squeezed into a box of its own however
 * short the window; its header row sticks to the top as the rows pass under it. From 1024px
 * an open lead has its own column that stays in view, and below that it takes the width.
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
  const mayExport = canRead(user.role, 'export');
  const statuses = LEAD_STATUSES.map((value) => ({ value, label: LEAD_STATUS_LABELS[value] }));

  return (
    <main id="admin-main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none lg:flex lg:items-start">
      <div className={`flex min-w-0 flex-1 flex-col ${open ? 'max-lg:hidden' : ''}`}>
        <div className="flex shrink-0 flex-col gap-5 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <PageHeader
            eyebrow="Sales"
            title="Leads"
            count={list.total}
            description={
              <>
                Every enquiry from every form on the site, in one list.{' '}
                {list.unassignedNew > 0
                  ? `${String(list.unassignedNew)} ${list.unassignedNew === 1 ? 'is' : 'are'} new and ${list.unassignedNew === 1 ? 'has' : 'have'} no owner yet.`
                  : 'Every new lead has an owner.'}
              </>
            }
            actions={
              mayExport ? (
                <a href={`/api/admin/leads/export?${toSearch(query)}`} className={button('secondary')}>
                  <DownloadIcon className="size-4" />
                  Export this view
                </a>
              ) : null
            }
          />
          <LinkTabs label="Lead status" tabs={statusTabs(query, list)} />
          <FilterBar query={query} options={options} />
        </div>

        {mayWrite ? (
          <div className="shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
            <BulkBar containerId={SELECTION_FORM} owners={options.owners} statuses={statuses} />
          </div>
        ) : null}

        <div className="px-4 pt-4 pb-16 sm:px-6 lg:px-8">
          {/* `overflow-clip` rounds the corners without making a scroll box, so the header row can stick. */}
          <div className={`${CARD} overflow-clip`}>
            {list.items.length === 0 ? (
              <EmptyState query={query} />
            ) : (
              <>
                {/*
                  Not a form: the checkboxes only need a common ancestor the bulk bar can read,
                  and every action on this screen is a link or an API call, never a submit.
                */}
                <div id={SELECTION_FORM}>
                  <div className="hidden lg:block">
                    <LeadsTable list={list} query={query} openLeadId={openLeadId} />
                  </div>
                  <MobileList list={list} query={query} openLeadId={openLeadId} />
                </div>
                <Pager list={list} query={query} />
              </>
            )}
          </div>
        </div>
      </div>

      {open ? <LeadPanel lead={open} query={query} owners={options.owners} mayWrite={mayWrite} statuses={statuses} /> : null}
    </main>
  );
}

/**
 * The status tabs. "Open" is the inbox's default, which leaves won and lost leads out;
 * choosing Won or Lost brings closed leads into the counts, or theirs would read zero.
 */
function statusTabs(query: AdminLeadQuery, list: AdminLeadList): TabLink[] {
  const chosen = query.status?.length === 1 ? query.status[0] : undefined;
  const closed = new Set<LeadStatus>(CLOSED_LEAD_STATUSES);
  const openStatuses = LEAD_STATUSES.filter((status) => !closed.has(status));
  const openCount = openStatuses.reduce((sum, status) => sum + list.statusCounts[status], 0);
  const allCount = LEAD_STATUSES.reduce((sum, status) => sum + list.statusCounts[status], 0);

  return [
    {
      label: 'Open',
      href: leadsUrl(query, { status: undefined, includeClosed: false, page: 1 }),
      count: openCount,
      current: !query.status?.length && !query.includeClosed,
    },
    ...LEAD_STATUSES.map((status) => ({
      label: LEAD_STATUS_LABELS[status],
      href: leadsUrl(query, { status: [status], includeClosed: closed.has(status), page: 1 }),
      count: closed.has(status) && !query.includeClosed ? undefined : list.statusCounts[status],
      current: chosen === status,
    })),
    {
      label: 'All',
      href: leadsUrl(query, { status: undefined, includeClosed: true, page: 1 }),
      count: query.includeClosed ? allCount : undefined,
      current: !query.status?.length && query.includeClosed,
    },
  ];
}

/** The API takes the same query string the page was given, minus what it defaults anyway. */
function toSearch(query: AdminLeadQuery): string {
  const url = leadsUrl(query);
  const search = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(search);
  if (query.pageSize !== ADMIN_LEADS_PAGE_SIZE) params.set('pageSize', String(query.pageSize));
  return params.toString();
}
