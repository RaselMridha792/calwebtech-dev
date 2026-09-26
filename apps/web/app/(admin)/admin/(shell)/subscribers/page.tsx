import {
  SUBSCRIBER_STATUSES,
  SUBSCRIBER_STATUS_LABELS,
  adminSubscriberListSchema,
  type SubscriberStatus,
} from '@calwebtech/shared';
import Link from 'next/link';
import { AudienceTabs, SubscriberStatusPill } from '@/components/admin/audience/audience-tabs';
import { SearchIcon, SubscribersIcon } from '@/components/admin/icons';
import { AdminPage, ChipLinks, EmptyState, PageHeader } from '@/components/admin/ui/page';
import { INPUT, KICKER, LIST, LIST_ROW, TAG, button } from '@/components/admin/ui/styles';
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
  const narrowed = Boolean(status || tag || search);
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);

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
    <AdminPage>
      <PageHeader
        eyebrow="Sales"
        title="Subscribers"
        count={list.total}
        description={
          narrowed
            ? `${String(list.total)} ${list.total === 1 ? 'subscriber matches' : 'subscribers match'} this view. A suppressed address is never mailed, whatever its subscription says.`
            : 'Everyone who signed up for email on the site. A suppressed address is never mailed, whatever its subscription says.'
        }
      />

      <AudienceTabs current="subscribers" />

      <div className="flex flex-col gap-4">
        <form role="search" method="get" action="/admin/subscribers/" className="flex flex-wrap items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          <div className="relative w-full sm:w-[320px]">
            <label htmlFor="subscriber-search" className="sr-only">
              Search subscribers
            </label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-muted" />
            <input
              id="subscriber-search"
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Email or name"
              className={`${INPUT} pl-9 ${search ? 'border-admin-edge' : ''}`}
            />
          </div>
          <button type="submit" className={button('secondary')}>
            Search
          </button>
          {narrowed ? (
            <Link href="/admin/subscribers/" className={button('ghost')}>
              Clear all
            </Link>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={KICKER}>Status</span>
            <ChipLinks
              label="Subscription status"
              chips={[
                { href: href({ status: '', page: '' }), label: 'All', current: !status },
                ...SUBSCRIBER_STATUSES.map((option) => ({
                  href: href({ status: option, page: '' }),
                  label: SUBSCRIBER_STATUS_LABELS[option],
                  current: status === option,
                })),
              ]}
            />
          </div>

          {list.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className={KICKER}>Tag</span>
              <ChipLinks
                label="Tags"
                chips={[
                  { href: href({ tag: '', page: '' }), label: 'Any', current: !tag },
                  ...list.tags.map((entry) => ({
                    href: href({ tag: entry.name, page: '' }),
                    label: entry.name,
                    count: entry.count,
                    current: tag === entry.name,
                  })),
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className={LIST}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<SubscribersIcon className="size-5" />}
            title={narrowed ? 'Nobody matches this view' : 'No subscribers yet'}
            actions={
              narrowed ? (
                <Link href="/admin/subscribers/" className={button('secondary')}>
                  Clear filters
                </Link>
              ) : null
            }
          >
            {narrowed
              ? 'Widen the search, or clear the status and tag filters to see everyone.'
              : 'Somebody who signs up on the site appears here the moment they do, with the page they joined from.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-admin-line2">
            {list.items.map((subscriber) => (
              <li key={subscriber.id} className={LIST_ROW}>
                <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                  <Link
                    href={`/admin/subscribers/${subscriber.id}/`}
                    className="text-[14.5px] font-semibold break-all text-ink-invert before:absolute before:inset-0"
                  >
                    {subscriber.email}
                  </Link>
                  <p className="text-[12.5px] text-admin-muted">
                    {[
                      subscriber.name,
                      `Joined ${joined(subscriber.consentAt)}`,
                      subscriber.sourcePage ? `from ${subscriber.sourcePage}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {subscriber.tags.length > 0 ? (
                  <ul aria-label="Tags" className="flex flex-wrap items-center gap-1.5">
                    {subscriber.tags.map((name) => (
                      <li key={name} className={TAG}>
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <SubscriberStatusPill status={subscriber.status} />
                <span aria-hidden className="text-admin-muted max-sm:hidden">
                  →
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

function joined(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
