import { adminSegmentListSchema, canWrite } from '@calwebtech/shared';
import Link from 'next/link';
import { AudienceTabs } from '@/components/admin/audience/audience-tabs';
import { describeRules } from '@/components/admin/audience/describe-rules';
import { PlusIcon, SubscribersIcon } from '@/components/admin/icons';
import { AdminPage, EmptyState, PageHeader } from '@/components/admin/ui/page';
import { LIST, LIST_ROW, button } from '@/components/admin/ui/styles';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * Segments (docs/12-admin-dashboard.md, module 4).
 *
 * Each count is worked out when the page loads, from the rules as they stand, with the
 * suppression list and unsubscribes already taken out — the same number a send would reach
 * if it went now.
 */
export default async function AdminSegmentsPage() {
  const user = await requireModule('subscribers', 'read');
  const list = await adminGet('/admin/segments', adminSegmentListSchema);
  const mayWrite = canWrite(user.role, 'subscribers');

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Sales"
        title="Segments"
        count={list.items.length}
        description="A segment is a set of rules that picks out part of your list, not a fixed list of names: it is counted again every time it is opened and again when a campaign is sent."
        actions={
          mayWrite ? (
            <Link href="/admin/subscribers/segments/new/" className={button('primary')}>
              <PlusIcon className="size-4" />
              New segment
            </Link>
          ) : null
        }
      />

      <AudienceTabs current="segments" />

      <div className={LIST}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={<SubscribersIcon className="size-5" />}
            title="No segments yet"
            actions={
              mayWrite ? (
                <Link href="/admin/subscribers/segments/new/" className={button('primary')}>
                  <PlusIcon className="size-4" />
                  New segment
                </Link>
              ) : null
            }
          >
            A segment picks subscribers by rules: a tag they carry, the page they signed up on, or how long ago they
            joined. Create one to send a campaign to part of your list rather than all of it.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-admin-line2">
            {list.items.map((segment) => (
              <li key={segment.id} className={LIST_ROW}>
                <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                  <Link
                    href={`/admin/subscribers/segments/${segment.id}/`}
                    className="text-[14.5px] font-semibold text-ink-invert before:absolute before:inset-0"
                  >
                    {segment.name}
                  </Link>
                  {segment.description ? (
                    <p className="line-clamp-2 text-[13.5px] text-ink-invert-muted">{segment.description}</p>
                  ) : null}
                  <p className="text-[12.5px] text-admin-muted">
                    {[
                      describeRules(segment.rules),
                      segment.campaignCount > 0
                        ? `used by ${String(segment.campaignCount)} ${segment.campaignCount === 1 ? 'campaign' : 'campaigns'}`
                        : 'not used by a campaign yet',
                    ].join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
                  <span className="font-display text-[22px] leading-none font-extrabold tracking-[-0.02em] text-ink-invert tabular-nums">
                    {segment.count.toLocaleString('en-GB')}
                  </span>
                  <span className="text-[12px] text-admin-muted">{segment.count === 1 ? 'subscriber now' : 'subscribers now'}</span>
                </div>
                <span aria-hidden className="text-admin-muted max-sm:hidden">
                  →
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPage>
  );
}
