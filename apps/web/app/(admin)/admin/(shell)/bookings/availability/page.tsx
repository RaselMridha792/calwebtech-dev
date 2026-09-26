import { adminAvailabilitySchema } from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import { AvailabilityForm } from '@/components/admin/bookings/availability-form';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
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
    <AdminPage width="medium">
      <BackLink href="/admin/bookings/">Back to bookings</BackLink>
      <PageHeader
        eyebrow="Sales"
        title="Availability"
        description={`When a ${availability.consultationType.name.toLowerCase()} can be booked. Hours are written in ${availability.timeZone}, and the page offers times up to ${String(availability.horizonDays)} days ahead.`}
      />
      <AvailabilityForm availability={availability} mayWrite={mayWrite} />
    </AdminPage>
  );
}
