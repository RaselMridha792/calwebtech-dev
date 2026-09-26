import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function FormsAndRoutingPage() {
  await requireModule('formsRouting');
  return (
    <ModuleStub
      group="Site"
      title="Forms and routing"
      note="Forms and routing will let you choose which mailbox each kind of enquiry goes to. The six enquiry types behind the contact form already work today; this is where their mailboxes will be changed."
    />
  );
}
