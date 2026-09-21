import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function FormsAndRoutingPage() {
  await requireModule('formsRouting');
  return (
    <ModuleStub
      group="Site"
      title="Forms and routing"
      note="Not in this pass. The six enquiry types behind the contact form are live already; this screen is what makes their mailboxes editable."
    />
  );
}
