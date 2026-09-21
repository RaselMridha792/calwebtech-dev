import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function DashboardPage() {
  await requireModule('overview');
  return (
    <ModuleStub
      group="Overview"
      title="Dashboard"
      note="The overview is designed after the inbox, once the lead metrics it should count are settled."
    />
  );
}
