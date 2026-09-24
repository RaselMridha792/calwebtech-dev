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

  const href = (change: Record<string, string>): string => {
    const next = new URLSearchParams({ ...(reason ? { reason } : {}), ...(search ? { search } : {}), ...change });
    for (const [key, value] of [...next.entries()]) if (!value) next.delete(key);
    const text = next.toString();
    return `/admin/subscribers/suppression/${text ? `?${text}` : ''}`;
  };

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Suppression list</h1>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {list.total} {list.total === 1 ? 'address' : 'addresses'}. No campaign, segment or import can send to an address
          on this list, and nothing here takes one off it.
        </p>

        <AudienceTabs current="suppression" />

        {canWrite(user.role, 'subscribers') ? <SuppressionForm /> : null}

        <form method="get" action="/admin/subscribers/suppression/" className="mb-3 flex flex-wrap items-end gap-2">
          {reason ? <input type="hidden" name="reason" value={reason} /> : null}
          <label className="flex min-w-[220px] flex-1 flex-col gap-[3px]">
            <span className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Search</span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Email address"
              className="h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
            />
          </label>
          <button
            type="submit"
            className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus"
          >
            Search
          </button>
        </form>

        <nav aria-label="Why an address is suppressed" className="mb-4 flex flex-wrap gap-2">
          <FilterLink href={href({ reason: '', page: '' })} current={!reason}>
            Every reason
          </FilterLink>
          {SUPPRESSION_REASONS.map((option) => (
            <FilterLink key={option} href={href({ reason: option, page: '' })} current={reason === option}>
              {SUPPRESSION_REASON_LABELS[option]}
            </FilterLink>
          ))}
        </nav>

        {list.items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-admin-body">
            {reason || search ? 'No address matches this view.' : 'The list is empty.'}
          </p>
        ) : (
          <ul className="border-t border-admin-line">
            {list.items.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-admin-line py-3">
                <span className="text-[13px] font-semibold break-all text-admin-ink">{entry.email}</span>
                <span className="text-[12px] text-admin-muted">{REASON_LABELS[entry.reason] ?? entry.reason}</span>
                <span className="ms-auto text-[12px] text-admin-body tabular-nums">
                  {new Date(entry.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[12.5px] text-admin-body">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className="font-semibold text-admin-link hover:underline">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="tabular-nums">{`Page ${String(page)} of ${String(pages)}`}</span>
            {page < pages ? (
              <Link href={href({ page: String(page + 1) })} className="font-semibold text-admin-link hover:underline">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`h-8 rounded-[4px] border px-3 text-[12.5px] leading-[30px] font-semibold ${
        current ? 'border-admin-edge bg-admin-nav text-admin-ink' : 'border-admin-line text-admin-body hover:border-admin-focus'
      }`}
    >
      {children}
    </Link>
  );
}
