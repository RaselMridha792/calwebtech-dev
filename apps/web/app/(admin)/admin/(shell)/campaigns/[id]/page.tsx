import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TEMPLATE_LABELS,
  CAMPAIGN_TOKEN_HELP,
  adminCampaignSchema,
  adminSegmentListSchema,
  canRead,
  canWrite,
  type CampaignStatus,
} from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import { CampaignComposer } from '@/components/admin/campaigns/campaign-composer';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
import { PILL } from '@/components/admin/ui/styles';
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

  const edited = campaign
    ? new Date(campaign.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <AdminPage>
      <BackLink href="/admin/campaigns/">Back to campaigns</BackLink>
      <PageHeader
        eyebrow="Campaign"
        title={campaign ? campaign.name : 'New campaign'}
        badge={<StatusPill status={campaign?.status ?? 'DRAFT'} />}
        description={
          !campaign
            ? 'Write the email, choose who receives it, and send yourself a test before it goes out. Nothing reaches a subscriber until you schedule it.'
            : campaign.status !== 'DRAFT'
              ? `Last edited ${edited ?? ''}. Only a draft can be changed.`
              : `Last edited ${edited ?? ''}. Save as you go; nothing reaches a subscriber until you schedule it.`
        }
      />
      <CampaignComposer
        campaign={campaign}
        segments={segments.items.map((segment) => ({ id: segment.id, name: segment.name, count: segment.count }))}
        templates={CAMPAIGN_TEMPLATE_LABELS}
        tokens={CAMPAIGN_TOKEN_HELP}
        mayWrite={mayWrite && (!campaign || campaign.status === 'DRAFT')}
        maySend={mayWrite}
        userEmail={user.email}
      />
    </AdminPage>
  );
}

/** Where a campaign stands, as a pill with a dot. Teal only once it has gone out. */
const DOT: Record<CampaignStatus, string> = {
  DRAFT: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  SCHEDULED: 'rounded-full bg-admin-dot',
  SENDING: 'rounded-full bg-gold-500',
  SENT: 'rounded-full bg-result',
  FAILED: 'rounded-full bg-danger',
};

function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span className={`${PILL} pl-2 font-sans tracking-normal`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}
