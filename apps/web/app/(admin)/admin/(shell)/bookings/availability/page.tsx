import { adminAvailabilitySchema } from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AvailabilityForm } from '@/components/admin/bookings/availability-form';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * When calls can be booked (task 5.1).
 *
 * This is the screen that keeps the booking engine out of a deploy: the hours, the length
 * of a call, the notice required and the days off are all content, and a firm that stops
 * taking Friday afternoons should not need a developer to say so.
 *
 * It answers 404 when no consultation type exists, which is the same state the public page
 * reports as "no times": there is nothing to set the hours of yet.
 */
export default async function AdminAvailabilityPage() {
  const user = await requireModule('bookings', 'read');
  const availability = await adminFind('/admin/bookings/availability', adminAvailabilitySchema);
  if (!availability) notFound();

  const mayWrite = user.modules.includes('bookings') && user.role !== 'VIEWER';

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[900px]">
        <Link href="/admin/bookings/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          Bookings
        </Link>

        <h1 className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Availability</h1>
        <p className="mt-0.5 text-[12.5px] text-admin-body">
          {`${availability.consultationType.name} · booked up to ${String(availability.horizonDays)} days ahead · hours in ${availability.timeZone}`}
        </p>

        <AvailabilityForm availability={availability} mayWrite={mayWrite} />
      </div>
    </main>
  );
}
