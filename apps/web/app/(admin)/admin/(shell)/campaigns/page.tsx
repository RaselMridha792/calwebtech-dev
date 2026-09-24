import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  adminCampaignListSchema,
  canWrite,
  type CampaignStatus,
} from '@calwebtech/shared';
import Link from 'next/link';
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

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Campaigns</h1>
          {canWrite(user.role, 'campaigns') ? (
            <Link
              href="/admin/campaigns/new/"
              className="h-8 rounded-[4px] bg-primary px-3 text-[12.5px] leading-8 font-semibold text-white hover:bg-admin-primaryh"
            >
              New campaign
            </Link>
          ) : null}
        </div>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {list.items.length} {list.items.length === 1 ? 'campaign' : 'campaigns'}
          {status ? ` ${CAMPAIGN_STATUS_LABELS[status].toLowerCase()}` : ''}. A campaign goes to a segment, counted again
          when it is sent, and never to an address on the suppression list.
        </p>

        <nav aria-label="Campaign status" className="mb-4 flex flex-wrap gap-2">
          <FilterLink href="/admin/campaigns/" current={!status}>
            All
          </FilterLink>
          {CAMPAIGN_STATUSES.map((option) => (
            <FilterLink key={option} href={`/admin/campaigns/?status=${option}`} current={status === option}>
              {CAMPAIGN_STATUS_LABELS[option]}
            </FilterLink>
          ))}
        </nav>

        {list.items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-admin-body">
            {status ? 'No campaign has this status.' : 'No campaigns yet.'}
          </p>
        ) : (
          <ul className="border-t border-admin-line">
            {list.items.map((campaign) => (
              <li key={campaign.id} className="border-b border-admin-line py-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/campaigns/${campaign.id}/`}
                    className="text-[13px] font-semibold text-admin-ink hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  {campaign.status === 'SENDING' || campaign.status === 'SENT' || campaign.status === 'FAILED' ? (
                    <Link
                      href={`/admin/campaigns/${campaign.id}/report/`}
                      className="text-[12px] font-semibold text-admin-link hover:underline"
                    >
                      Report
                    </Link>
                  ) : null}
                  <span className="ms-auto text-[12px] font-semibold text-admin-body">
                    {CAMPAIGN_STATUS_LABELS[campaign.status]}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-admin-muted">
                  {[
                    campaign.subject,
                    campaign.segment ? `to ${campaign.segment.name}` : 'no segment chosen',
                    campaign.sentAt
                      ? `sent ${new Date(campaign.sentAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`
                      : `edited ${new Date(campaign.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`,
                  ].join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`h-8 rounded-[4px] border px-3 text-[12.5px] leading-[30px] font-semibold ${
        current ? 'border-admin-edge bg-admin-nav text-admin-ink' : 'border-admin-line text-admin-body hover:border-admin-focus'
      }`}
    >
      {children}
    </Link>
  );
}
