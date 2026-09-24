import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TEMPLATE_LABELS,
  CAMPAIGN_TOKEN_HELP,
  adminCampaignSchema,
  adminSegmentListSchema,
  canRead,
  canWrite,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CampaignComposer } from '@/components/admin/campaigns/campaign-composer';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * One campaign, or a new one when the id is `new`. The labels are passed down from here so
 * the composer, a client component, imports no schema from the shared package.
 */
export default async function AdminCampaignPage({ params }: PageProps<'/admin/campaigns/[id]'>) {
  const user = await requireModule('campaigns', 'read');
  const mayWrite = canWrite(user.role, 'campaigns');
  const { id } = await params;
  const creating = id === 'new';
  if (creating && !mayWrite) notFound();

  const [campaign, segments] = await Promise.all([
    creating ? null : adminFind(`/admin/campaigns/${encodeURIComponent(id)}`, adminCampaignSchema),
    // The segment picker needs the subscribers module too; without it, the picker is empty.
    canRead(user.role, 'subscribers') ? adminGet('/admin/segments', adminSegmentListSchema) : { items: [] },
  ]);
  if (!creating && !campaign) notFound();

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <Link href="/admin/campaigns/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to campaigns
        </Link>
        <h1 className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">
          {campaign ? campaign.name : 'New campaign'}
        </h1>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {campaign ? CAMPAIGN_STATUS_LABELS[campaign.status] : 'Draft'}
          {campaign && campaign.status !== 'DRAFT' ? '. Only a draft can be changed.' : ''}
        </p>
        <CampaignComposer
          campaign={campaign}
          segments={segments.items.map((segment) => ({ id: segment.id, name: segment.name, count: segment.count }))}
          templates={CAMPAIGN_TEMPLATE_LABELS}
          tokens={CAMPAIGN_TOKEN_HELP}
          mayWrite={mayWrite && (!campaign || campaign.status === 'DRAFT')}
          maySend={mayWrite}
          userEmail={user.email}
        />
      </div>
    </main>
  );
}
