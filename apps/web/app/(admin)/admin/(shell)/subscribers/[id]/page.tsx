import { SUBSCRIBER_STATUS_LABELS, SUPPRESSION_REASON_LABELS, adminSubscriberSchema, canWrite } from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TagEditor } from '@/components/admin/audience/tag-editor';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string | undefined> = SUPPRESSION_REASON_LABELS;

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

/** One subscriber: when and where they consented, what stops the mail, and their tags. */
export default async function AdminSubscriberPage({ params }: PageProps<'/admin/subscribers/[id]'>) {
  const user = await requireModule('subscribers', 'read');
  const { id } = await params;
  const subscriber = await adminFind(`/admin/subscribers/${encodeURIComponent(id)}`, adminSubscriberSchema);
  if (!subscriber) notFound();

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[900px]">
        <Link href="/admin/subscribers/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          Subscribers
        </Link>

        <h1 className="mt-2 font-display text-[21px] font-bold tracking-[-0.02em] break-all text-admin-ink">
          {subscriber.email}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-admin-body">
          {subscriber.name ? `${subscriber.name} · ` : ''}
          {SUBSCRIBER_STATUS_LABELS[subscriber.status]}
        </p>

        {subscriber.suppression ? (
          <p role="note" className="mt-4 border-t border-b border-admin-line py-3 text-[12.5px] text-admin-ink">
            {`On the suppression list since ${when(subscriber.suppression.createdAt)} (${reasonLabel(subscriber.suppression.reason)}). No campaign reaches this address.`}
          </p>
        ) : null}

        <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-admin-line pt-5 sm:grid-cols-2">
          <Fact label="Consented">{when(subscriber.consentAt)}</Fact>
          <Fact label="Signed up on">{subscriber.sourcePage ?? '—'}</Fact>
          <Fact label="Unsubscribed">{when(subscriber.unsubscribedAt)}</Fact>
          <Fact label="Last engaged">{when(subscriber.lastEngagedAt)}</Fact>
        </dl>

        <TagEditor subscriberId={subscriber.id} tags={subscriber.tags} mayWrite={canWrite(user.role, 'subscribers')} />
      </div>
    </main>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">{label}</dt>
      <dd className="mt-1 text-[13px] text-admin-ink">{children}</dd>
    </div>
  );
}
