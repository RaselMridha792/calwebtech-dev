import { adminSegmentSchema, adminSubscriberListSchema, canWrite } from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SegmentEditor } from '@/components/admin/audience/segment-editor';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * One segment, or a new one when the id is `new`. A reader sees the rules and the count;
 * only a role that writes to the module gets the builder's controls.
 */
export default async function AdminSegmentPage({ params }: PageProps<'/admin/subscribers/segments/[id]'>) {
  const user = await requireModule('subscribers', 'read');
  const mayWrite = canWrite(user.role, 'subscribers');
  const { id } = await params;
  const creating = id === 'new';
  if (creating && !mayWrite) notFound();

  const [segment, subscribers] = await Promise.all([
    creating ? null : adminFind(`/admin/segments/${encodeURIComponent(id)}`, adminSegmentSchema),
    // Only for the tag picker: the list carries every tag in use.
    adminGet('/admin/subscribers?pageSize=1', adminSubscriberListSchema),
  ]);
  if (!creating && !segment) notFound();

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <Link href="/admin/subscribers/segments/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to segments
        </Link>
        <h1 className="mt-2 mb-4 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">
          {segment ? segment.name : 'New segment'}
        </h1>
        <SegmentEditor
          segment={segment}
          knownTags={subscribers.tags.map((tag) => tag.name)}
          mayWrite={mayWrite}
        />
      </div>
    </main>
  );
}
