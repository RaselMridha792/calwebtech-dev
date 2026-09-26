import { SUBSCRIBER_STATUS_LABELS, SUPPRESSION_REASON_LABELS, adminSubscriberSchema, canWrite } from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import { SubscriberStatusPill } from '@/components/admin/audience/audience-tabs';
import { TagEditor } from '@/components/admin/audience/tag-editor';
import { AdminPage, BackLink, Facts, PageHeader, Panel } from '@/components/admin/ui/page';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string | undefined> = SUPPRESSION_REASON_LABELS;

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

function when(value: string | null): string {
  return value
    ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

/** What each subscription state means for the mail, in one plain sentence. */
const STATE_NOTE = {
  active: 'Subscribed. Campaigns whose segment includes this person will reach them.',
  unsubscribed: 'This person unsubscribed. No campaign is sent to them.',
  suppressed: 'Mail to this address is blocked by the suppression list, whatever the subscription says.',
} as const;

/** One subscriber: when and where they consented, what stops the mail, and their tags. */
export default async function AdminSubscriberPage({ params }: PageProps<'/admin/subscribers/[id]'>) {
  const user = await requireModule('subscribers', 'read');
  const { id } = await params;
  const subscriber = await adminFind(`/admin/subscribers/${encodeURIComponent(id)}`, adminSubscriberSchema);
  if (!subscriber) notFound();

  return (
    <AdminPage width="medium">
      <BackLink href="/admin/subscribers/">Back to subscribers</BackLink>

      <PageHeader
        eyebrow="Subscriber"
        title={<span className="min-w-0 break-all">{subscriber.email}</span>}
        badge={<SubscriberStatusPill status={subscriber.status} />}
        description={[subscriber.name, `Joined ${when(subscriber.consentAt)}`].filter(Boolean).join(' · ')}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Details" labelledBy="subscriber-details" description="Where this person came from and what they have done since.">
            <Facts
              items={[
                { label: 'Email', value: <span className="break-all">{subscriber.email}</span> },
                { label: 'Name', value: subscriber.name ?? '—' },
                { label: 'Consented', value: when(subscriber.consentAt) },
                { label: 'Signed up on', value: subscriber.sourcePage ?? '—' },
                { label: 'Unsubscribed', value: when(subscriber.unsubscribedAt) },
                { label: 'Last engaged', value: when(subscriber.lastEngagedAt) },
              ]}
            />
          </Panel>

          <Panel
            title="Tags"
            labelledBy="subscriber-tags"
            description="Tags group people so a segment can pick them out. Add or remove them here, then save the set."
          >
            <TagEditor subscriberId={subscriber.id} tags={subscriber.tags} mayWrite={canWrite(user.role, 'subscribers')} />
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Subscription" labelledBy="subscriber-state">
            <div className="flex flex-col items-start gap-3">
              <SubscriberStatusPill status={subscriber.status} />
              <p className="text-[14px] leading-[1.6] text-ink-invert-muted">
                <span className="sr-only">{SUBSCRIBER_STATUS_LABELS[subscriber.status]}. </span>
                {STATE_NOTE[subscriber.status]}
              </p>
            </div>
          </Panel>

          {subscriber.suppression ? (
            <Panel
              title="Suppression list"
              labelledBy="subscriber-suppression"
              description="Kept apart from the subscription, because it is a different fact: the list wins."
            >
              <p role="note" className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink-invert">
                <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-admin-muted" />
                <span>
                  {`On the suppression list since ${when(subscriber.suppression.createdAt)} (${reasonLabel(subscriber.suppression.reason)}). No campaign reaches this address.`}
                </span>
              </p>
            </Panel>
          ) : null}
        </aside>
      </div>
    </AdminPage>
  );
}
