import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function PageSectionsPage() {
  await requireModule('pageSections');
  return (
    <ModuleStub
      group="Content"
      title="Page sections"
      note="Not in this pass. Page sections are how the announcement bar and the static blocks change without a deploy."
    />
  );
}
