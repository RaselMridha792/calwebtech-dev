import { BOOKING_STATUS_LABELS, adminBookingDetailSchema } from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingPanel } from '@/components/admin/bookings/booking-panel';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/** One booking: everything the visitor said, and where the call stands. */
export default async function AdminBookingPage({ params }: PageProps<'/admin/bookings/[id]'>) {
  const user = await requireModule('bookings', 'read');
  const { id } = await params;
  const booking = await adminFind(`/admin/bookings/${encodeURIComponent(id)}`, adminBookingDetailSchema);
  if (!booking) notFound();

  const mayWrite = user.modules.includes('bookings') && user.role !== 'VIEWER';
  const starts = new Date(booking.startsAt);

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[900px]">
        <Link href="/admin/bookings/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          Bookings
        </Link>

        <h1 className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">{booking.name}</h1>
        <p className="mt-0.5 text-[12.5px] text-admin-body">
          {`${booking.consultationType.name} · ${String(booking.consultationType.durationMinutes)} minutes · ${BOOKING_STATUS_LABELS[booking.status]}`}
        </p>

        <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-admin-line pt-5 sm:grid-cols-2">
          <Fact label="When, your time">
            {starts.toLocaleString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Fact>
          {/* The clock the visitor read when they chose it, which is what to quote to them. */}
          <Fact label={`When, their time (${booking.timezone})`}>
            {starts.toLocaleString(undefined, {
              timeZone: booking.timezone,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Fact>
          <Fact label="Email">
            <a href={`mailto:${booking.email}`} className="text-admin-link hover:underline">
              {booking.email}
            </a>
          </Fact>
          <Fact label="Phone">
            {booking.phone ? (
              <a href={`tel:${booking.phone}`} className="text-admin-link hover:underline">
                {booking.phone}
              </a>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label="Booked">
            {new Date(booking.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Fact>
          <Fact label="From a lead">
            {booking.leadId ? (
              <Link href={`/admin/leads/${booking.leadId}/`} className="text-admin-link hover:underline">
                Open the lead
              </Link>
            ) : (
              '—'
            )}
          </Fact>
        </dl>

        {booking.context ? (
          <section className="mt-8 border-t border-admin-line pt-5">
            <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
              What they want to talk about
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-admin-ink">{booking.context}</p>
          </section>
        ) : null}

        <BookingPanel booking={booking} mayWrite={mayWrite} />

        <section className="mt-8 border-t border-admin-line pt-5">
          <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">History</h2>
          <ul className="mt-2.5 space-y-1.5">
            {booking.events.map((event) => (
              <li key={event.id} className="text-[12.5px] text-admin-body">
                <span className="text-admin-ink">{event.type.replace(/_/g, ' ')}</span>
                {' · '}
                {new Date(event.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">{label}</dt>
      <dd className="mt-1 text-[13px] text-admin-ink">{children}</dd>
    </div>
  );
}
