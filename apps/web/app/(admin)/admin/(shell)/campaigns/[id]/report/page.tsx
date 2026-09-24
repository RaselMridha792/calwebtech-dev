import {
  CAMPAIGN_STATUS_LABELS,
  RECIPIENT_STATES,
  RECIPIENT_STATE_LABELS,
  campaignReportSchema,
  type RecipientState,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

/** A share of the people sent to, rounded the way a person would say it. */
function share(part: number, whole: number): string {
  if (whole === 0) return '—';
  const percent = (part / whole) * 100;
  return `${percent < 10 && percent > 0 ? percent.toFixed(1) : String(Math.round(percent))}%`;
}

/**
 * A campaign's report (docs/12-admin-dashboard.md, module 5; Task 5.4).
 *
 * Counted in people, not events. Opens are a floor: many mail clients load images for the
 * reader or never, so the true number is higher. Deliveries, bounces and complaints come
 * from Resend's webhook; without it configured they stay at zero, and the note says so.
 *
 * State in the URL and no client script, like every list in the dashboard.
 */
export default async function CampaignReportPage({ params, searchParams }: PageProps<'/admin/campaigns/[id]/report'>) {
  await requireModule('campaigns', 'read');
  const { id } = await params;
  const query = await searchParams;
  const state: RecipientState | '' =
    typeof query.state === 'string' ? (RECIPIENT_STATES.find((entry) => entry === query.state) ?? '') : '';
  const page = typeof query.page === 'string' && /^\d+$/.test(query.page) ? Number(query.page) : 1;

  const search = new URLSearchParams({ ...(state ? { state } : {}), page: String(page) });
  const report = await adminFind(`/admin/campaigns/${encodeURIComponent(id)}/report?${search.toString()}`, campaignReportSchema);
  if (!report) notFound();

  const { totals, campaign, recipients } = report;
  const pages = Math.max(1, Math.ceil(recipients.total / recipients.pageSize));
  const base = `/admin/campaigns/${encodeURIComponent(campaign.id)}/report/`;
  const href = (change: { state?: string; page?: number }): string => {
    const next = new URLSearchParams();
    const nextState = change.state ?? state;
    if (nextState) next.set('state', nextState);
    if (change.page && change.page > 1) next.set('page', String(change.page));
    const text = next.toString();
    return `${base}${text ? `?${text}` : ''}`;
  };

  const rows: { label: string; value: number; note: string }[] = [
    { label: 'Sent', value: totals.sent, note: `of ${totals.recipients.toLocaleString()} in the audience when it started` },
    { label: 'Delivered', value: totals.delivered, note: share(totals.delivered, totals.sent) },
    { label: 'Opened', value: totals.opened, note: `${share(totals.opened, totals.sent)}, at least` },
    { label: 'Clicked', value: totals.clicked, note: share(totals.clicked, totals.sent) },
    { label: 'Unsubscribed', value: totals.unsubscribed, note: share(totals.unsubscribed, totals.sent) },
    { label: 'Bounced', value: totals.bounced, note: 'moved to the suppression list' },
    { label: 'Marked as spam', value: totals.complained, note: 'moved to the suppression list' },
    { label: 'Not sent', value: totals.notSent, note: 'suppressed or unsubscribed before their turn, or failed' },
  ];
  const noEvents = totals.sent > 0 && totals.delivered + totals.bounced + totals.complained === 0;

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <Link
          href={`/admin/campaigns/${encodeURIComponent(campaign.id)}/`}
          className="text-[12.5px] font-semibold text-admin-link hover:underline"
        >
          ← Back to the campaign
        </Link>
        <h1 className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">{`Report: ${campaign.name}`}</h1>
        <p className="mt-0.5 mb-5 text-[12.5px] text-admin-body">
          {[
            CAMPAIGN_STATUS_LABELS[campaign.status],
            campaign.segment ? `to ${campaign.segment}` : null,
            `started ${when(campaign.startedAt)}`,
            campaign.finishedAt ? `finished ${when(campaign.finishedAt)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <dl className="border-t border-admin-line">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-admin-line py-2.5">
              <dt className="w-[140px] text-[12.5px] font-semibold text-admin-ink">{row.label}</dt>
              <dd className="font-display text-[19px] font-bold tracking-[-0.02em] text-admin-ink tabular-nums">
                {row.value.toLocaleString()}
              </dd>
              <dd className="text-[11.5px] text-admin-muted">{row.note}</dd>
            </div>
          ))}
        </dl>
        {noEvents ? (
          <p role="note" className="mt-3 text-[12px] text-admin-body">
            No delivery events have arrived. Deliveries, opens, clicks, bounces and complaints come from Resend&apos;s
            webhook, so they stay at zero until it is pointed at /api/webhooks/resend and RESEND_WEBHOOK_SECRET is set.
          </p>
        ) : null}

        <h2 className="mt-8 text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Recipients</h2>
        <nav aria-label="Recipients by what happened" className="mt-2 mb-3 flex flex-wrap gap-2">
          <FilterLink href={href({ state: '', page: 1 })} current={!state}>
            Everyone
          </FilterLink>
          {RECIPIENT_STATES.map((entry) => (
            <FilterLink key={entry} href={href({ state: entry, page: 1 })} current={state === entry}>
              {RECIPIENT_STATE_LABELS[entry]}
            </FilterLink>
          ))}
        </nav>

        {recipients.items.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-admin-body">Nobody in this view.</p>
        ) : (
          <ul className="border-t border-admin-line">
            {recipients.items.map((recipient) => (
              <li key={recipient.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-admin-line py-2.5">
                <span className="text-[13px] font-semibold break-all text-admin-ink">{recipient.email}</span>
                {recipient.name ? <span className="text-[12px] text-admin-muted">{recipient.name}</span> : null}
                <span className="ms-auto text-[12px] font-semibold text-admin-body">
                  {RECIPIENT_STATE_LABELS[recipient.state]}
                </span>
                <span className="w-full text-[11.5px] text-admin-muted">
                  {[
                    recipient.sentAt ? `sent ${when(recipient.sentAt)}` : null,
                    recipient.lastEventAt && recipient.lastEventAt !== recipient.sentAt
                      ? `last seen ${when(recipient.lastEventAt)}`
                      : null,
                    recipient.error,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-[12.5px] text-admin-body">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className="font-semibold text-admin-link hover:underline">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="tabular-nums">{`Page ${String(page)} of ${String(pages)}`}</span>
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className="font-semibold text-admin-link hover:underline">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
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
