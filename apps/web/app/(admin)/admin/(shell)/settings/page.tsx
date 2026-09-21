import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function SettingsPage() {
  await requireModule('settings');
  return (
    <ModuleStub
      group="Site"
      title="Settings"
      note="Not in this pass. The five settings behind the site are changed with settings-cli on the server until this screen exists."
    />
  );
}
