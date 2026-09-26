import { adminSegmentSchema, adminSubscriberListSchema, canWrite } from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import { SegmentEditor } from '@/components/admin/audience/segment-editor';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
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
    <AdminPage width="medium">
      <BackLink href="/admin/subscribers/segments/">Back to segments</BackLink>

      <PageHeader
        eyebrow="Segment"
        title={segment ? segment.name : 'New segment'}
        description={
          segment
            ? [
                segment.campaignCount > 0
                  ? `Used by ${String(segment.campaignCount)} ${segment.campaignCount === 1 ? 'campaign' : 'campaigns'}`
                  : 'Not used by a campaign yet',
                `last edited ${edited(segment.updatedAt)}`,
              ].join(' · ')
            : 'Choose who this segment reaches. The count on the right follows the rules as you write them.'
        }
      />

      <SegmentEditor segment={segment} knownTags={subscribers.tags.map((tag) => tag.name)} mayWrite={mayWrite} />
    </AdminPage>
  );
}

function edited(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
