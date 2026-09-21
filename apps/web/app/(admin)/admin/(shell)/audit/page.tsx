import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function AuditLogPage() {
  await requireModule('auditLog');
  return (
    <ModuleStub
      group="Admin"
      title="Audit log"
      note="Not in this pass. Entries are being written already — every sign-in, pipeline change, note and export — so this screen has a history waiting for it."
    />
  );
}
