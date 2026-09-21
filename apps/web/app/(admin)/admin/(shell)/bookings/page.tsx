import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function BookingsPage() {
  await requireModule('bookings');
  return (
    <ModuleStub
      group="Sales"
      title="Bookings"
      note="Blocked on the booking API, which was lost with the worktrees and has not been rebuilt. Designed; it ships once Task 5.1 exists again."
    />
  );
}
