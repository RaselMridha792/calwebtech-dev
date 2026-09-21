import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function CampaignsPage() {
  await requireModule('campaigns');
  return (
    <ModuleStub
      group="Sales"
      title="Campaigns"
      note="Deferred to Task 5.4. The composer, templates and reporting come last, after the content types can be edited."
    />
  );
}
