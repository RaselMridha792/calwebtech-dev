import {
  SUPPRESSION_REASONS,
  SUPPRESSION_REASON_LABELS,
  adminSuppressionListSchema,
  canWrite,
  type SuppressionReason,
} from '@calwebtech/shared';
import Link from 'next/link';
import { AudienceTabs } from '@/components/admin/audience/audience-tabs';
import { SuppressionForm } from '@/components/admin/audience/suppression-form';
import { SearchIcon, SubscribersIcon } from '@/components/admin/icons';
import { AdminPage, ChipLinks, EmptyState, PageHeader } from '@/components/admin/ui/page';
import { INPUT, KICKER, LIST, TAG, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string | undefined> = SUPPRESSION_REASON_LABELS;

/**
 * The suppression list: every address no campaign may reach.
 *
 * Addresses can be added here and never removed. Bounces, complaints and unsubscribes come
 * in on their own; this screen is for the address somebody asked, by phone or by email, not
 * to be written to.
 */
export default async function AdminSuppressionPage({ searchParams }: PageProps<'/admin/subscribers/suppression'>) {
  const user = await requireModule('subscribers', 'read');
  const params = await searchParams;
  const reason: SuppressionReason | '' =
    typeof params.reason === 'string' ? (SUPPRESSION_REASONS.find((r) => r === params.reason) ?? '') : '';
  const search = typeof params.search === 'string' ? params.search : '';
  const page = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1;

  const query = new URLSearchParams({ ...(reason ? { reason } : {}), ...(search ? { search } : {}), page: String(page) });
  const list = await adminGet(`/admin/suppressions?${query.toString()}`, adminSuppressionListSchema);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const narrowed = Boolean(reason || search);
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);

  const href = (change: Record<string, string>): string => {
    const next = new URLSearchParams({ ...(reason ? { reason } : {}), ...(search ? { search } : {}), ...change });
    for (const [key, value] of [...next.entries()]) if (!value) next.delete(key);
    const text = next.toString();
    return `/admin/subscribers/suppression/${text ? `?${text}` : ''}`;
  };

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Sales"
        title="Suppression list"
        count={list.total}
        description="Addresses that no campaign, segment or import can send to. Bounces, complaints and unsubscribes land here on their own, and nothing here takes an address off the list."
      />

      <AudienceTabs current="suppression" />

      {canWrite(user.role, 'subscribers') ? <SuppressionForm /> : null}

      <div className="flex flex-col gap-4">
        <form role="search" method="get" action="/admin/subscribers/suppression/" className="flex flex-wrap items-center gap-2">
          {reason ? <input type="hidden" name="reason" value={reason} /> : null}
          <div className="relative w-full sm:w-[320px]">
            <label htmlFor="suppression-search" className="sr-only">
              Search the list
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-muted" />
            <input
              id="suppression-search"
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Email address"
              className={`${INPUT} pl-9 ${search ? 'border-admin-edge' : ''}`}
            />
          </div>
          <button type="submit" className={button('secondary')}>
            Search
          </button>
          {narrowed ? (
            <Link href="/admin/subscribers/suppression/" className={button('ghost')}>
              Clear all
            </Link>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <span className={KICKER}>Reason</span>
          <ChipLinks
            label="Why an address is suppressed"
            chips={[
              { href: href({ reason: '', page: '' }), label: 'Every reason', current: !reason },
              ...SUPPRESSION_REASONS.map((option) => ({
                href: href({ reason: option, page: '' }),
                label: SUPPRESSION_REASON_LABELS[option],
                current: reason === option,
              })),
            ]}
          />
        </div>
      </div>

      <div className={LIST}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<SubscribersIcon className="size-5" />}
            title={narrowed ? 'No address matches this view' : 'The list is empty'}
            actions={
              narrowed ? (
                <Link href="/admin/subscribers/suppression/" className={button('secondary')}>
                  Clear filters
                </Link>
              ) : null
            }
          >
            {narrowed
              ? 'Try a different spelling, or show every reason.'
              : 'Nobody has bounced, complained or unsubscribed yet, and no address has been added by hand.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-admin-line2">
            {list.items.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                <span className="min-w-0 flex-1 basis-60 text-[14.5px] font-semibold break-all text-ink-invert">{entry.email}</span>
                <span className={TAG}>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                <span className="text-[13px] text-admin-muted tabular-nums sm:min-w-27.5 sm:text-right">
                  {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav
            aria-label="Pages"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 px-4 py-3 sm:px-5"
          >
            <p className="text-[13px] text-ink-invert-muted tabular-nums">
              Showing {first}–{last} of {list.total}
            </p>
            <div className="flex items-center gap-2">
              <PageLink href={href({ page: String(page - 1) })} disabled={page <= 1}>
                Previous
              </PageLink>
              <span className="px-1 text-[13px] text-ink-invert-muted tabular-nums">{`Page ${String(page)} of ${String(pages)}`}</span>
              <PageLink href={href({ page: String(page + 1) })} disabled={page >= pages}>
                Next
              </PageLink>
            </div>
          </nav>
        ) : null}
      </div>
    </AdminPage>
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
