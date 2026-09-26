import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  adminAvailabilitySchema,
  adminBookingListSchema,
  type AdminBooking,
  type BookingStatus,
} from '@calwebtech/shared';
import Link from 'next/link';
import { BookingsIcon, ChevronRightIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, LinkTabs, PageHeader } from '@/components/admin/ui/page';
import { LIST, PILL, button } from '@/components/admin/ui/styles';
import { adminFind, adminGet } from '@/lib/admin/api';
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
 * colleague. Times are shown on the business's own clock, which is the zone the hours
 * under Availability are written in; the visitor's clock sits beside each one.
 */
export default async function AdminBookingsPage({ searchParams }: PageProps<'/admin/bookings'>) {
  await requireModule('bookings', 'read');
  const params = await searchParams;
  const when = WHEN.find((entry) => entry.key === params.when)?.key ?? 'upcoming';
  const status: BookingStatus | '' = BOOKING_STATUSES.find((s) => s === params.status) ?? '';
  const search = typeof params.search === 'string' ? params.search : '';
  const page = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;

  const query = new URLSearchParams({
    when,
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  });
  const [list, availability] = await Promise.all([
    adminGet(`/admin/bookings?${query.toString()}`, adminBookingListSchema),
    // The business's own zone, so every time on this screen reads on the same clock.
    adminFind('/admin/bookings/availability', adminAvailabilitySchema),
  ]);
  const timeZone = availability?.timeZone;

  const href = (change: { when?: string; page?: number }): string => {
    const next = new URLSearchParams();
    next.set('when', change.when ?? when);
    if (status) next.set('status', status);
    if (search) next.set('search', search);
    const nextPage = change.page ?? 1;
    if (nextPage > 1) next.set('page', String(nextPage));
    return `/admin/bookings/?${next.toString()}`;
  };
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Sales"
        title="Bookings"
        count={list.total}
        description={
          timeZone
            ? `Every call booked from the site. Times are on the business's clock (${timeZone}); each visitor's own clock is beside their booking.`
            : "Every call booked from the site, with each visitor's own clock beside their booking."
        }
        actions={
          <Link href="/admin/bookings/availability/" className={button('secondary')}>
            <BookingsIcon className="size-4" />
            Availability
          </Link>
        }
      />

      <LinkTabs
        label="Which bookings"
        tabs={WHEN.map((entry) => ({
          href: href({ when: entry.key }),
          label: entry.label,
          current: when === entry.key,
          count: when === entry.key ? list.total : undefined,
        }))}
      />

      {list.items.length === 0 ? (
        <div className={LIST}>
          <Empty when={when} status={status} />
        </div>
      ) : (
        <div className={LIST}>
          <ul className="divide-y divide-admin-line2">
            {list.items.map((booking) => (
              <BookingRow key={booking.id} booking={booking} timeZone={timeZone} />
            ))}
          </ul>
          {pages > 1 ? (
            <nav
              aria-label="Pages"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 px-4 py-3 sm:px-5"
            >
              <p className="text-[13px] text-ink-invert-muted tabular-nums">
                {`Showing ${String((list.page - 1) * list.pageSize + 1)}–${String(Math.min(list.total, list.page * list.pageSize))} of ${String(list.total)}`}
              </p>
              <div className="flex items-center gap-2">
                <PageLink href={href({ page: list.page - 1 })} disabled={list.page <= 1}>
                  Previous
                </PageLink>
                <span className="px-1 text-[13px] text-ink-invert-muted tabular-nums">{`Page ${String(list.page)} of ${String(pages)}`}</span>
                <PageLink href={href({ page: list.page + 1 })} disabled={list.page >= pages}>
                  Next
                </PageLink>
              </div>
            </nav>
          ) : null}
        </div>
      )}
    </AdminPage>
  );
}

/**
 * One call: the date as a calendar leaf, who it is with, when on the business's clock,
 * and where it stands. The whole row opens the booking.
 */
function BookingRow({ booking, timeZone }: { booking: AdminBooking; timeZone: string | undefined }) {
  const date = dateParts(booking.startsAt, booking.endsAt, timeZone);
  const theirs = timeZone === booking.timezone ? null : theirClock(booking.startsAt, booking.timezone);
  const kind = `${booking.consultationType.name} · ${String(booking.consultationType.durationMinutes)} min`;
  return (
    <li className="group relative flex items-center gap-3.5 px-4 py-3.5 transition-colors duration-150 hover:bg-admin-hover sm:gap-4 sm:px-5">
      <span
        aria-hidden
        className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-admin-line bg-admin-sunken"
      >
        <span className="text-[10px] font-semibold tracking-[0.1em] text-gold-500 uppercase">{date.month}</span>
        <span className="font-display text-[17px] leading-tight font-extrabold text-ink-invert">{date.day}</span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/admin/bookings/${encodeURIComponent(booking.id)}/`}
          className="truncate text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
        >
          {booking.name}
        </Link>
        <span className="truncate text-[12.5px] text-admin-muted">{booking.email}</span>
        <span className="text-[13px] text-ink-invert-muted sm:hidden">
          <span className="font-semibold text-ink-invert tabular-nums">{date.when}</span> · {kind}
        </span>
        {booking.context ? (
          <span className="mt-0.5 line-clamp-1 text-[13px] text-ink-invert-muted max-sm:hidden">{booking.context}</span>
        ) : null}
        <span className="mt-1.5 sm:hidden">
          <StatusPill status={booking.status} />
        </span>
      </span>

      <span className="hidden w-[250px] shrink-0 flex-col gap-0.5 sm:flex">
        <span className="text-[14px] font-semibold text-ink-invert tabular-nums">{date.when}</span>
        <span className="truncate text-[12.5px] text-admin-muted">{kind}</span>
        {theirs ? <span className="truncate text-[12.5px] text-admin-muted">{`Their clock: ${theirs}`}</span> : null}
      </span>

      {/* A fixed slot, so the time column lines up whatever the label's length. */}
      <span className="hidden w-[116px] shrink-0 sm:flex">
        <StatusPill status={booking.status} />
      </span>

      <ChevronRightIcon className="size-4 shrink-0 text-admin-muted transition-transform duration-150 group-hover:translate-x-0.5" />
    </li>
  );
}

/** Where a call stands, as a pill with a dot. Teal is kept for a call that happened. */
const DOT: Record<BookingStatus, string> = {
  CONFIRMED: 'rounded-full bg-admin-dot',
  RESCHEDULED: 'rounded-full bg-admin-surface ring-2 ring-admin-dot ring-inset',
  CANCELLED: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  COMPLETED: 'rounded-full bg-result',
  NO_SHOW: 'rounded-full bg-danger',
};

function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span className={`${PILL} pl-2`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {BOOKING_STATUS_LABELS[status]}
    </span>
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
 * Two different absences: a calendar with nothing on it yet, and a view narrowed to
 * nothing. A new booking made on the site appears here within seconds either way.
 */
function Empty({ when, status }: { when: (typeof WHEN)[number]['key']; status: BookingStatus | '' }) {
  const title = status
    ? `No ${BOOKING_STATUS_LABELS[status].toLowerCase()} bookings here`
    : when === 'upcoming'
      ? 'No calls coming up'
      : when === 'past'
        ? 'No past calls yet'
        : 'No bookings yet';
  return (
    <EmptyState
      icon={<BookingsIcon className="size-5" />}
      title={title}
      actions={
        <>
          {status || when !== 'all' ? (
            <Link href="/admin/bookings/?when=all" className={button('secondary')}>
              Show every booking
            </Link>
          ) : null}
          <Link href="/admin/bookings/availability/" className={button(status || when !== 'all' ? 'ghost' : 'primary')}>
            Check availability
          </Link>
        </>
      }
    >
      A booking made on the site appears here within seconds. Visitors book from the consultation page, in the hours
      set under Availability.
    </EmptyState>
  );
}

function dateParts(startsAt: string, endsAt: string, timeZone: string | undefined): { month: string; day: string; when: string } {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const clock = (value: Date): string => value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  return {
    month: start.toLocaleDateString('en-GB', { month: 'short', timeZone }),
    day: start.toLocaleDateString('en-GB', { day: '2-digit', timeZone }),
    when: `${start.toLocaleDateString('en-GB', { weekday: 'short', timeZone })} ${clock(start)}–${clock(end)}`,
  };
}

/** The clock the visitor read when they chose the time, which is what to quote to them. */
function theirClock(startsAt: string, timezone: string): string {
  try {
    return `${new Date(startsAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: timezone })}, ${timezone}`;
  } catch {
    return timezone;
  }
}
