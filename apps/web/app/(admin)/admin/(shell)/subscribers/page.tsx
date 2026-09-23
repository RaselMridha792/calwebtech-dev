import {
  SUBSCRIBER_STATUSES,
  SUBSCRIBER_STATUS_LABELS,
  adminSubscriberListSchema,
  type SubscriberStatus,
} from '@calwebtech/shared';
import Link from 'next/link';
import { AudienceTabs } from '@/components/admin/audience/audience-tabs';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * Subscribers (docs/12-admin-dashboard.md, module 4).
 *
 * Suppression is shown apart from subscription state, because they are different facts: a
 * subscriber can be subscribed and still suppressed after a hard bounce, and the screen has
 * to say which one stops the mail.
 *
 * Like bookings, the whole screen is state in the URL and needs no JavaScript: a filter is a
 * link, and the search box is a plain GET form.
 */
export default async function AdminSubscribersPage({ searchParams }: PageProps<'/admin/subscribers'>) {
  await requireModule('subscribers', 'read');
  const params = await searchParams;
  const status: SubscriberStatus | '' =
    typeof params.status === 'string' ? (SUBSCRIBER_STATUSES.find((s) => s === params.status) ?? '') : '';
  const tag = typeof params.tag === 'string' ? params.tag : '';
  const search = typeof params.search === 'string' ? params.search : '';
  const page = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1;

  const query = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(tag ? { tag } : {}),
    ...(search ? { search } : {}),
    page: String(page),
  });
  const list = await adminGet(`/admin/subscribers?${query.toString()}`, adminSubscriberListSchema);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  /** The current view with one thing changed, so every link keeps the other filters. */
  const href = (change: Record<string, string>): string => {
    const next = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(tag ? { tag } : {}),
      ...(search ? { search } : {}),
      ...change,
    });
    for (const [key, value] of [...next.entries()]) if (!value) next.delete(key);
    const text = next.toString();
    return `/admin/subscribers/${text ? `?${text}` : ''}`;
  };

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Subscribers</h1>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {list.total} {list.total === 1 ? 'subscriber' : 'subscribers'}
          {status || tag || search ? ' match this view' : ''}. A suppressed address is never mailed, whatever its
          subscription says.
        </p>

        <AudienceTabs current="subscribers" />

        <form method="get" action="/admin/subscribers/" className="mb-3 flex flex-wrap items-end gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <label className="flex min-w-[220px] flex-1 flex-col gap-[3px]">
            <span className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Search</span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Email or name"
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

        <nav aria-label="Subscription status" className="mb-3 flex flex-wrap gap-2">
          <FilterLink href={href({ status: '', page: '' })} current={!status}>
            All
          </FilterLink>
          {SUBSCRIBER_STATUSES.map((option) => (
            <FilterLink key={option} href={href({ status: option, page: '' })} current={status === option}>
              {SUBSCRIBER_STATUS_LABELS[option]}
            </FilterLink>
          ))}
        </nav>

        {list.tags.length > 0 ? (
          <nav aria-label="Tags" className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Tag</span>
            <FilterLink href={href({ tag: '', page: '' })} current={!tag}>
              Any
            </FilterLink>
            {list.tags.map((entry) => (
              <FilterLink key={entry.name} href={href({ tag: entry.name, page: '' })} current={tag === entry.name}>
                {`${entry.name} · ${String(entry.count)}`}
              </FilterLink>
            ))}
          </nav>
        ) : null}

        {list.items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-admin-body">
            {status || tag || search
              ? 'Nobody matches this view.'
              : 'No subscribers yet. Somebody who signs up on the site appears here.'}
          </p>
        ) : (
          <ul className="border-t border-admin-line">
            {list.items.map((subscriber) => (
              <li key={subscriber.id} className="border-b border-admin-line py-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/subscribers/${subscriber.id}/`}
                    className="text-[13px] font-semibold break-all text-admin-ink hover:underline"
                  >
                    {subscriber.email}
                  </Link>
                  {subscriber.name ? <span className="text-[12px] text-admin-muted">{subscriber.name}</span> : null}
                  <span className="ms-auto text-[12px] font-semibold text-admin-body">
                    {SUBSCRIBER_STATUS_LABELS[subscriber.status]}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-admin-muted">
                  {[
                    `Joined ${new Date(subscriber.consentAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`,
                    subscriber.sourcePage ? `from ${subscriber.sourcePage}` : null,
                    subscriber.tags.length > 0 ? subscriber.tags.join(', ') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
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
