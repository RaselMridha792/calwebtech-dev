import { PAGE_COPY_LABELS, adminPageCopyDetailSchema, pageCopyKeySchema } from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import type { Json } from '@/components/admin/content/copy-editor';
import { PageCopyEditor } from '@/components/admin/content/page-copy-editor';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
import { adminGet } from '@/lib/admin/api';
import { pageCopyLiveNote } from '@/lib/admin/page-copy';
import { requireModule } from '@/lib/admin/session';

/** One piece of page copy, as fields (docs/14-remaining-work.md, task 4). */
export default async function AdminPageCopyEditorPage({ params }: PageProps<'/admin/page-copy/[key]'>) {
  await requireModule('content', 'full');
  const parsed = pageCopyKeySchema.safeParse(decodeURIComponent((await params).key));
  if (!parsed.success) notFound();
  const key = parsed.data;
  const detail = await adminGet(`/admin/page-copy/${encodeURIComponent(key)}`, adminPageCopyDetailSchema);
  if (!detail.stored) notFound();
  const label = PAGE_COPY_LABELS[key];

  return (
    <AdminPage width="medium">
      <BackLink href="/admin/page-copy/">Back to page copy</BackLink>

      <PageHeader
        eyebrow="Page copy"
        title={label.title}
        description={detail.updatedAt ? `${label.help} Last changed ${edited(detail.updatedAt)}.` : label.help}
      />

      <PageCopyEditor copyKey={key} value={detail.value as Json} liveNote={pageCopyLiveNote(key)} />
    </AdminPage>
  );
}

function edited(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
