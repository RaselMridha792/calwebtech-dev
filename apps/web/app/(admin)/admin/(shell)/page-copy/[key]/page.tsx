import { PAGE_COPY_LABELS, adminPageCopyDetailSchema, pageCopyKeySchema } from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Json } from '@/components/admin/content/copy-editor';
import { PageCopyEditor } from '@/components/admin/content/page-copy-editor';
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
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <Link href="/admin/page-copy/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to page copy
        </Link>
        <h1 className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">{label.title}</h1>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">{label.help}</p>
        <PageCopyEditor copyKey={key} value={detail.value as Json} liveNote={pageCopyLiveNote(key)} />
      </div>
    </main>
  );
}
