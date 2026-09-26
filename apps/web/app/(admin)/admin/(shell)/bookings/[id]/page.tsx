import {
  BOOKING_STATUS_LABELS,
  adminAvailabilitySchema,
  adminBookingDetailSchema,
  type BookingStatus,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingPanel } from '@/components/admin/bookings/booking-panel';
import { AdminPage, BackLink, Facts, PageHeader, Panel } from '@/components/admin/ui/page';
import { LINK, PILL, button } from '@/components/admin/ui/styles';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/** One booking: everything the visitor said, and where the call stands. */
export default async function AdminBookingPage({ params }: PageProps<'/admin/bookings/[id]'>) {
  const user = await requireModule('bookings', 'read');
  const { id } = await params;
  const [booking, availability] = await Promise.all([
    adminFind(`/admin/bookings/${encodeURIComponent(id)}`, adminBookingDetailSchema),
    // The business's own zone, so the call reads on the same clock as the hours it was booked in.
    adminFind('/admin/bookings/availability', adminAvailabilitySchema),
  ]);
  if (!booking) notFound();

  const mayWrite = user.modules.includes('bookings') && user.role !== 'VIEWER';
  const timeZone = availability?.timeZone;
  const firstName = booking.name.split(/\s+/)[0] ?? booking.name;
  const long = (iso: string, zone: string | undefined): string =>
    new Date(iso).toLocaleString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: zone,
    });
  const short = (iso: string): string =>
    new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone });

  return (
    <AdminPage width="medium">
      <BackLink href="/admin/bookings/">Back to bookings</BackLink>

      <PageHeader
        eyebrow="Booking"
        title={booking.name}
        badge={<StatusPill status={booking.status} />}
        description={`${booking.consultationType.name} · ${String(booking.consultationType.durationMinutes)} minutes · booked ${short(booking.createdAt)}`}
        actions={
          <>
            <a href={`mailto:${booking.email}`} className={button('secondary')}>
              Email {firstName}
            </a>
            {booking.phone ? (
              <a href={`tel:${booking.phone}`} className={button('secondary')}>
                Call
              </a>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="When"
            labelledBy="booking-when"
            description="The business's clock first, then the clock the visitor read when they chose the time. Quote them theirs."
          >
            <Facts
              items={[
                {
                  label: timeZone ? 'Business time' : 'Time',
                  value: <Clock when={long(booking.startsAt, timeZone)} zone={timeZone} />,
                },
                // The clock the visitor read when they chose it, which is what to quote to them.
                {
                  label: 'Their time',
                  value: <Clock when={long(booking.startsAt, booking.timezone)} zone={booking.timezone} />,
                },
                { label: 'Length', value: `${String(booking.consultationType.durationMinutes)} minutes` },
                { label: 'Call type', value: booking.consultationType.name },
              ]}
            />
          </Panel>

          <Panel title="Who" labelledBy="booking-who">
            <Facts
              items={[
                {
                  label: 'Email',
                  value: (
                    <a href={`mailto:${booking.email}`} className={LINK}>
                      {booking.email}
                    </a>
                  ),
                },
                {
                  label: 'Phone',
                  value: booking.phone ? (
                    <a href={`tel:${booking.phone}`} className={LINK}>
                      {booking.phone}
                    </a>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Booked', value: short(booking.createdAt) },
                {
                  label: 'From a lead',
                  value: booking.leadId ? (
                    <Link href={`/admin/leads/${booking.leadId}/`} className={LINK}>
                      Open the lead
                    </Link>
                  ) : (
                    '—'
                  ),
                },
              ]}
            />
          </Panel>

          {booking.context ? (
            <Panel title="What they want to talk about" labelledBy="booking-context">
              <p className="text-[14.5px] leading-[1.65] whitespace-pre-line text-ink-invert">{booking.context}</p>
            </Panel>
          ) : null}

          <Panel title="History" labelledBy="booking-history" description="How this booking reached the state it is in.">
            {booking.events.length === 0 ? (
              <p className="text-[14px] text-ink-invert-muted">Nothing has happened to this booking since it was made.</p>
            ) : (
              <ol className="flex flex-col">
                {booking.events.map((event) => (
                  <li
                    key={event.id}
                    className="relative flex gap-3 pb-4 before:absolute before:top-4 before:bottom-0 before:left-[3.5px] before:w-px before:bg-admin-line2 last:pb-0 last:before:hidden"
                  >
                    <span aria-hidden className="relative mt-[7px] size-2 shrink-0 rounded-full bg-admin-muted" />
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-[1.55] text-ink-invert capitalize">{event.type.replace(/_/g, ' ')}</span>
                      <span className="mt-0.5 block text-[12.5px] text-admin-muted">{short(event.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <BookingPanel booking={booking} mayWrite={mayWrite} />
        </div>
      </div>
    </AdminPage>
  );
}

/** A time and, under it, the zone it is read in, so a long zone name never crowds the label. */
function Clock({ when, zone }: { when: string; zone: string | undefined }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>{when}</span>
      {zone ? <span className="text-[12.5px] text-admin-muted">{zone}</span> : null}
    </span>
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
    <span className={`${PILL} pl-2 font-sans tracking-normal`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
