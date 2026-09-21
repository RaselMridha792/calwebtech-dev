import { ModuleStub } from '@/components/admin/module-stub';
import { requireModule } from '@/lib/admin/session';

export default async function MediaPage() {
  await requireModule('media');
  return (
    <ModuleStub
      group="Content"
      title="Media"
      note="Not in this pass. The media library blocks the content editors, because alt text is required at upload and nothing else can supply it."
    />
  );
}
