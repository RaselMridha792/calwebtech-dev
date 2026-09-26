import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function PageSectionsPage() {
  await requireModule('pageSections');
  return (
    <ModuleStub
      group="Content"
      title="Page sections"
      note="Page sections will let you change the announcement bar and the fixed blocks that appear across the site — the parts that are not a service, an industry or a case study — without asking a developer."
    />
  );
}
