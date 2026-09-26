import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  adminCampaignListSchema,
  canWrite,
  type AdminCampaign,
  type CampaignStatus,
} from '@calwebtech/shared';
import Link from 'next/link';
import { CampaignsIcon, ChevronRightIcon, PlusIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, LinkTabs, PageHeader } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, PILL, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * Campaigns (docs/12-admin-dashboard.md, module 5; Task 5.4).
 *
 * Most recently touched first, because the campaign somebody is working on is the one
 * they came here for. The filter is a link, like every other list in the dashboard.
 */
export default async function AdminCampaignsPage({ searchParams }: PageProps<'/admin/campaigns'>) {
  const user = await requireModule('campaigns', 'read');
  const params = await searchParams;
  const status: CampaignStatus | '' =
    typeof params.status === 'string' ? (CAMPAIGN_STATUSES.find((s) => s === params.status) ?? '') : '';

  const list = await adminGet(`/admin/campaigns${status ? `?status=${status}` : ''}`, adminCampaignListSchema);
  const mayWrite = canWrite(user.role, 'campaigns');

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Sales"
        title="Campaigns"
        count={list.items.length}
        description="Emails to a segment of your subscribers. A campaign goes to the segment as it stands at send time, and never to an address on the suppression list."
        actions={
          mayWrite ? (
            <Link href="/admin/campaigns/new/" className={button('primary')}>
              <PlusIcon className="size-4" />
              New campaign
            </Link>
          ) : null
        }
      />

      <LinkTabs
        label="Campaign status"
        tabs={[
          { href: '/admin/campaigns/', label: 'All', current: !status, count: status ? undefined : list.items.length },
          ...CAMPAIGN_STATUSES.map((option) => ({
            href: `/admin/campaigns/?status=${option}`,
            label: CAMPAIGN_STATUS_LABELS[option],
            current: status === option,
            count: status === option ? list.items.length : undefined,
          })),
        ]}
      />

      <div className={LIST}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<CampaignsIcon className="size-5" />}
            title={status ? `No ${CAMPAIGN_STATUS_LABELS[status].toLowerCase()} campaigns` : 'No campaigns yet'}
            actions={
              <>
                {status ? (
                  <Link href="/admin/campaigns/" className={button('secondary')}>
                    Show every campaign
                  </Link>
                ) : null}
                {mayWrite ? (
                  <Link href="/admin/campaigns/new/" className={button(status ? 'ghost' : 'primary')}>
                    <PlusIcon className="size-4" />
                    New campaign
                  </Link>
                ) : null}
              </>
            }
          >
            {status
              ? 'No campaign has this status. It will appear here the moment one does.'
              : 'Write an email, choose a segment of subscribers, send yourself a test, then schedule it. Everything you send is reported on here.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-admin-line2">
            {list.items.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
          </ul>
        )}
      </div>
    </AdminPage>
  );
}

/** One campaign: its name, subject and audience, when it went or was last touched, and where it stands. */
function CampaignRow({ campaign }: { campaign: AdminCampaign }) {
  const reportable = campaign.status === 'SENDING' || campaign.status === 'SENT' || campaign.status === 'FAILED';
  const when = campaign.sentAt
    ? `Sent ${new Date(campaign.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : campaign.scheduledAt && campaign.status === 'SCHEDULED'
      ? `Goes ${new Date(campaign.scheduledAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
      : `Edited ${new Date(campaign.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return (
    <li className={`${LIST_ROW} group`}>
      <span className="flex min-w-0 flex-1 basis-[240px] flex-col gap-0.5">
        <Link
          href={`/admin/campaigns/${encodeURIComponent(campaign.id)}/`}
          className="truncate text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
        >
          {campaign.name}
        </Link>
        <span className="truncate text-[13px] text-ink-invert-muted">{campaign.subject}</span>
        <span className="truncate text-[12.5px] text-admin-muted">
          {campaign.segment ? `To ${campaign.segment.name}` : 'No segment chosen yet'} · {when}
        </span>
      </span>
      {reportable ? (
        <Link href={`/admin/campaigns/${encodeURIComponent(campaign.id)}/report/`} className={`${button('secondary', 'sm')} relative`}>
          Report
        </Link>
      ) : null}
      <StatusPill status={campaign.status} />
      <ChevronRightIcon className="size-4 shrink-0 text-admin-muted transition-transform duration-150 group-hover:translate-x-0.5 max-sm:hidden" />
    </li>
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
    <span className={`${PILL} pl-2`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}
