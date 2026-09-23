import { BOOKING_STATUSES, BOOKING_STATUS_LABELS, adminBookingListSchema } from '@calwebtech/shared';
import Link from 'next/link';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const WHEN = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
] as const;

/**
 * Bookings (docs/12-admin-dashboard.md).
 *
 * Opens on what is still to come, because a call that has happened is history and a screen
 * that starts with six months of it hides the two calls this week.
 *
 * The whole screen is state in the URL, so it is a server component with no JavaScript of
 * its own: a filter is a link, and a filtered view is a view somebody can send to a
 * colleague.
 */
export default async function AdminBookingsPage({ searchParams }: PageProps<'/admin/bookings'>) {
  await requireModule('bookings', 'read');
  const params = await searchParams;
  const when = typeof params.when === 'string' && WHEN.some((entry) => entry.key === params.when) ? params.when : 'upcoming';
  const status = typeof params.status === 'string' && BOOKING_STATUSES.some((s) => s === params.status) ? params.status : '';
  const search = typeof params.search === 'string' ? params.search : '';

  const query = new URLSearchParams({ when, ...(status ? { status } : {}), ...(search ? { search } : {}) });
  const list = await adminGet(`/admin/bookings?${query.toString()}`, adminBookingListSchema);

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Bookings</h1>
          <Link
            href="/admin/bookings/availability/"
            className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] leading-[30px] font-semibold text-admin-body hover:border-admin-focus"
          >
            Availability
          </Link>
        </div>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {list.total} {list.total === 1 ? 'call' : 'calls'}. Times are shown in this browser&apos;s timezone, with the
          visitor&apos;s own beside each one.
        </p>

        <nav aria-label="Which bookings" className="mb-4 flex flex-wrap gap-2">
          {WHEN.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/bookings/?when=${entry.key}${status ? `&status=${status}` : ''}`}
              aria-current={when === entry.key ? 'page' : undefined}
              className={`h-8 rounded-[4px] border px-3 text-[12.5px] leading-[30px] font-semibold ${
                when === entry.key
                  ? 'border-admin-edge bg-admin-nav text-admin-ink'
                  : 'border-admin-line text-admin-body hover:border-admin-focus'
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        {list.items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-admin-body">
            Nothing here. A booking made on the site appears within seconds.
          </p>
        ) : (
          <ul className="border-t border-admin-line">
            {list.items.map((booking) => (
              <li key={booking.id} className="border-b border-admin-line py-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/bookings/${booking.id}/`}
                    className="text-[13px] font-semibold text-admin-ink hover:underline"
                  >
                    {booking.name}
                  </Link>
                  <span className="text-[12px] text-admin-muted">{booking.email}</span>
                  <span className="ms-auto text-[12px] font-semibold text-admin-body tabular-nums">
                    {new Date(booking.startsAt).toLocaleString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-admin-muted">
                  {`${booking.consultationType.name} · ${String(booking.consultationType.durationMinutes)} min · their timezone ${booking.timezone} · ${BOOKING_STATUS_LABELS[booking.status]}`}
                </p>
                {booking.context ? (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] text-admin-body">{booking.context}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
