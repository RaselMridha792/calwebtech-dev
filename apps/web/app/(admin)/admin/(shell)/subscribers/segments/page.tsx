import { adminSegmentListSchema, canWrite } from '@calwebtech/shared';
import Link from 'next/link';
import { AudienceTabs } from '@/components/admin/audience/audience-tabs';
import { describeRules } from '@/components/admin/audience/describe-rules';
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

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Segments</h1>
          {canWrite(user.role, 'subscribers') ? (
            <Link
              href="/admin/subscribers/segments/new/"
              className="h-8 rounded-[4px] bg-primary px-3 text-[12.5px] leading-8 font-semibold text-white hover:bg-admin-primaryh"
            >
              New segment
            </Link>
          ) : null}
        </div>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          A segment is a set of rules, not a list. It is counted again every time it is opened and again when a campaign
          is sent.
        </p>

        <AudienceTabs current="segments" />

        {list.items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-admin-body">No segments yet.</p>
        ) : (
          <ul className="border-t border-admin-line">
            {list.items.map((segment) => (
              <li key={segment.id} className="border-b border-admin-line py-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/subscribers/segments/${segment.id}/`}
                    className="text-[13px] font-semibold text-admin-ink hover:underline"
                  >
                    {segment.name}
                  </Link>
                  <span className="ms-auto text-[12px] font-semibold text-admin-body tabular-nums">
                    {`${segment.count.toLocaleString()} ${segment.count === 1 ? 'subscriber' : 'subscribers'}`}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-admin-muted">
                  {[
                    describeRules(segment.rules),
                    segment.campaignCount > 0
                      ? `used by ${String(segment.campaignCount)} ${segment.campaignCount === 1 ? 'campaign' : 'campaigns'}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {segment.description ? (
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] text-admin-body">{segment.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
