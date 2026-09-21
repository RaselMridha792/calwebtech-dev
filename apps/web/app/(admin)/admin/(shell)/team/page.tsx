import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function TeamAndRolesPage() {
  await requireModule('team');
  return (
    <ModuleStub
      group="Admin"
      title="Team and roles"
      note="Not in this pass. Accounts are created with the admin-cli on the server until this screen exists."
    />
  );
}
