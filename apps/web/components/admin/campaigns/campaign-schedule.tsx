'use client';
import type { AdminCampaign } from '@calwebtech/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

const LABEL = 'text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';
const BUTTON =
  'h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40';

/** `2026-10-01T09:30` in this browser's zone, the format a datetime-local input reads. */
function localInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

/**
 * Scheduling and the send's progress (Task 5.4).
 *
 * The time is typed in this browser's clock and sent as an instant, so "9:30" means 9:30
 * where the person scheduling it is. Sending now asks once more, naming the segment and
 * today's count, because nothing on this screen can call a send back once it starts.
 */
export function CampaignSchedulePanel({
  campaign,
  segmentCount,
  unsaved,
  mayWrite,
}: {
  campaign: AdminCampaign;
  /** The segment's count today, for the confirmation; null without a segment. */
  segmentCount: number | null;
  unsaved: boolean;
  mayWrite: boolean;
}) {
  const router = useRouter();
  const [sendAt, setSendAt] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [confirmingNow, setConfirmingNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A send in progress refreshes itself, so the counts move without a reload.
  const sending = campaign.status === 'SENDING' || campaign.status === 'SCHEDULED';
  useEffect(() => {
    if (!sending) return;
    const timer = window.setInterval(() => {
      router.refresh();
    }, 15_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [sending, router]);

  function post(path: string, body?: unknown): void {
    setBusy(true);
    setError(null);
    adminMutate<AdminCampaign>(`/admin/campaigns/${encodeURIComponent(campaign.id)}/${path}`, { method: 'POST', body })
      .then(() => {
        setConfirmingNow(false);
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof MutationError ? (Object.values(cause.fieldErrors).flat()[0] ?? cause.message) : 'That did not work.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const total = campaign.recipientCount;
  const { sent, failed } = campaign.progress;

  return (
    <section className="border-t border-admin-line pt-4">
      <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Send</h2>

      {campaign.status === 'DRAFT' ? (
        mayWrite ? (
          <div className="mt-2 flex flex-col gap-2">
            {!campaign.segment ? (
              <p className="text-[12px] text-admin-body">Choose a segment and save before scheduling.</p>
            ) : unsaved ? (
              <p className="text-[12px] text-admin-body">Save your changes first: the saved draft is what gets sent.</p>
            ) : null}
            <label className="flex flex-col gap-[3px]">
              <span className={LABEL}>Send at (your time)</span>
              <input
                type="datetime-local"
                value={sendAt}
                min={localInputValue(new Date())}
                disabled={busy}
                onChange={(event) => {
                  setSendAt(event.target.value);
                }}
                className="h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || unsaved || !campaign.segment || !sendAt}
                onClick={() => {
                  post('schedule', { sendAt: new Date(sendAt).toISOString() });
                }}
                className="h-8 rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
              >
                Schedule
              </button>
              <button
                type="button"
                disabled={busy || unsaved || !campaign.segment}
                onClick={() => {
                  if (confirmingNow) post('schedule', { sendAt: null });
                  else setConfirmingNow(true);
                }}
                className={BUTTON}
              >
                {confirmingNow ? 'Yes, send it now' : 'Send now'}
              </button>
              {confirmingNow ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingNow(false);
                  }}
                  className={BUTTON}
                >
                  Not yet
                </button>
              ) : null}
            </div>
            {confirmingNow && campaign.segment ? (
              <p role="status" className="text-[12px] text-admin-ink">
                {`This sends to ${campaign.segment.name}${segmentCount === null ? '' : `, ${segmentCount.toLocaleString()} ${segmentCount === 1 ? 'person' : 'people'} today`}, within a minute. It cannot be stopped once it starts.`}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-admin-body">Not scheduled.</p>
        )
      ) : null}

      {campaign.status === 'SCHEDULED' && campaign.scheduledAt ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-[12.5px] text-admin-ink">{`Scheduled for ${when(campaign.scheduledAt)}, to ${campaign.segment?.name ?? 'its segment'}.`}</p>
          <p className="text-[11.5px] text-admin-muted">The segment is counted again when it starts.</p>
          {mayWrite ? (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  post('unschedule');
                }}
                className={BUTTON}
              >
                Back to draft
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {campaign.status === 'SENDING' || campaign.status === 'SENT' || campaign.status === 'FAILED' ? (
        <div className="mt-2" aria-live="polite">
          <p className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink tabular-nums">
            {`${sent.toLocaleString()} of ${total.toLocaleString()} sent`}
          </p>
          <p className="text-[12px] text-admin-body">
            {[
              campaign.status === 'SENDING' ? 'Sending now' : campaign.status === 'SENT' ? 'Sent' : 'Failed',
              failed > 0 ? `${failed.toLocaleString()} not sent (failed, or suppressed before their turn)` : null,
              campaign.sentAt ? `finished ${when(campaign.sentAt)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <Link
            href={`/admin/campaigns/${encodeURIComponent(campaign.id)}/report/`}
            className="mt-2 inline-block text-[12.5px] font-semibold text-admin-link hover:underline"
          >
            View the report
          </Link>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
