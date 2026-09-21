import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function AllTypesPage() {
  await requireModule('content');
  return (
    <ModuleStub
      group="Content"
      title="All types"
      note="Not in this pass. Every content type gets the same listing, editor and SEO panel, and the first of them is Service."
    />
  );
}
