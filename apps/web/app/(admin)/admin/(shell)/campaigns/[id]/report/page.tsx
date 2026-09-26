import {
  CAMPAIGN_STATUS_LABELS,
  RECIPIENT_STATES,
  RECIPIENT_STATE_LABELS,
  campaignReportSchema,
  type CampaignStatus,
  type RecipientState,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubscribersIcon } from '@/components/admin/icons';
import { StatCard } from '@/components/admin/ui/charts';
import { AdminPage, BackLink, ChipLinks, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { PILL, TD, TH, button } from '@/components/admin/ui/styles';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

function when(value: string | null): string {
  return value
    ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
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

  const figures: { label: string; value: number; note: string }[] = [
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
    <AdminPage>
      <BackLink href={`/admin/campaigns/${encodeURIComponent(campaign.id)}/`}>Back to the campaign</BackLink>

      <PageHeader
        eyebrow="Campaign report"
        title={campaign.name}
        badge={<StatusPill status={campaign.status} />}
        description={[
          campaign.subject,
          campaign.segment ? `to ${campaign.segment}` : null,
          `started ${when(campaign.startedAt)}`,
          campaign.finishedAt ? `finished ${when(campaign.finishedAt)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <section aria-label="What happened, in people" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {figures.map((figure) => (
          <StatCard key={figure.label} label={figure.label} value={figure.value.toLocaleString()} note={figure.note} />
        ))}
      </section>

      {noEvents ? (
        <p role="note" className="rounded-xl border border-admin-line2 bg-admin-sunken px-4 py-3.5 text-[13.5px] leading-[1.6] text-ink-invert-muted sm:px-5">
          No delivery events have arrived yet, so deliveries, opens, clicks, bounces and complaints all read zero. They come
          from Resend&apos;s webhook: ask a developer to point it at /api/webhooks/resend and set RESEND_WEBHOOK_SECRET.
        </p>
      ) : null}

      <Panel
        title="Recipients"
        labelledBy="report-recipients"
        description="Everyone the campaign was sent to, furthest along first. A click implies an open, an open a delivery."
        flush
      >
        <div className="px-4 pb-4 sm:px-6">
          <ChipLinks
            label="Recipients by what happened"
            chips={[
              { href: href({ state: '', page: 1 }), label: 'Everyone', current: !state },
              ...RECIPIENT_STATES.map((entry) => ({
                href: href({ state: entry, page: 1 }),
                label: RECIPIENT_STATE_LABELS[entry],
                current: state === entry,
              })),
            ]}
          />
        </div>

        {recipients.items.length === 0 ? (
          <div className="border-t border-admin-line2">
            <EmptyState icon={<SubscribersIcon className="size-5" />} title="Nobody in this view">
              {state ? 'No recipient has reached this state yet.' : 'Recipients are listed once the send starts.'}
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} pl-4 sm:pl-6`}>
                    Recipient
                  </th>
                  <th scope="col" className={TH}>
                    What happened
                  </th>
                  <th scope="col" className={`${TH} max-md:hidden`}>
                    Sent
                  </th>
                  <th scope="col" className={`${TH} pr-4 max-lg:hidden sm:pr-6`}>
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {recipients.items.map((recipient) => {
                  const detail = [
                    recipient.lastEventAt && recipient.lastEventAt !== recipient.sentAt ? `last seen ${when(recipient.lastEventAt)}` : null,
                    recipient.error,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <tr key={recipient.id} className="transition-colors duration-150 hover:bg-admin-hover">
                      <td className={`${TD} py-3 pl-4 sm:pl-6`}>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-semibold break-all text-ink-invert">{recipient.email}</span>
                          {recipient.name ? <span className="text-[12.5px] text-admin-muted">{recipient.name}</span> : null}
                          <span className="text-[12.5px] text-admin-muted lg:hidden">
                            {[recipient.sentAt ? `sent ${when(recipient.sentAt)}` : null, detail || null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </td>
                      <td className={`${TD} py-3`}>
                        <RecipientPill state={recipient.state} />
                      </td>
                      <td className={`${TD} py-3 whitespace-nowrap tabular-nums max-md:hidden`}>{when(recipient.sentAt)}</td>
                      <td className={`${TD} max-w-[360px] py-3 pr-4 text-[13px] max-lg:hidden sm:pr-6`}>{detail || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 ? (
          <nav
            aria-label="Pages"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 px-4 py-3 sm:px-6"
          >
            <p className="text-[13px] text-ink-invert-muted tabular-nums">
              {`Showing ${String((recipients.page - 1) * recipients.pageSize + 1)}–${String(Math.min(recipients.total, recipients.page * recipients.pageSize))} of ${String(recipients.total)}`}
            </p>
            <div className="flex items-center gap-2">
              <PageLink href={href({ page: page - 1 })} disabled={page <= 1}>
                Previous
              </PageLink>
              <span className="px-1 text-[13px] text-ink-invert-muted tabular-nums">{`Page ${String(page)} of ${String(pages)}`}</span>
              <PageLink href={href({ page: page + 1 })} disabled={page >= pages}>
                Next
              </PageLink>
            </div>
          </nav>
        ) : null}
      </Panel>
    </AdminPage>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className={button('secondary', 'sm')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={button('secondary', 'sm')}>
      {children}
    </Link>
  );
}

/** Where a campaign stands, as a pill with a dot. Teal only once it has gone out. */
const STATUS_DOT: Record<CampaignStatus, string> = {
  DRAFT: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  SCHEDULED: 'rounded-full bg-admin-dot',
  SENDING: 'rounded-full bg-gold-500',
  SENT: 'rounded-full bg-result',
  FAILED: 'rounded-full bg-danger',
};

function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span className={`${PILL} pl-2 font-sans tracking-normal`}>
      <span aria-hidden className={`size-2 shrink-0 ${STATUS_DOT[status]}`} />
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Where one recipient got to. A filled teal dot is the good outcome (opened, clicked), the
 * danger tone is what needs acting on, and a ring is still on its way or never went.
 */
const STATE_DOT: Record<RecipientState, string> = {
  complained: 'rounded-full bg-danger',
  bounced: 'rounded-full bg-danger',
  clicked: 'rounded-full bg-result',
  opened: 'rounded-full bg-result',
  delivered: 'rounded-full bg-admin-dot',
  sent: 'rounded-full bg-admin-surface ring-2 ring-admin-dot ring-inset',
  not_sent: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  pending: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
};

function RecipientPill({ state }: { state: RecipientState }) {
  return (
    <span className={`${PILL} pl-2`}>
      <span aria-hidden className={`size-2 shrink-0 ${STATE_DOT[state]}`} />
      {RECIPIENT_STATE_LABELS[state]}
    </span>
  );
}
