import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function SubscribersPage() {
  await requireModule('subscribers');
  return (
    <ModuleStub
      group="Sales"
      title="Subscribers"
      note="Not in this pass. Subscribers, segments and tags come with the campaign engine, and reuse this shell and its tables."
    />
  );
}
