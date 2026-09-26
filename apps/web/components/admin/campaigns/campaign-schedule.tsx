'use client';
import type { AdminCampaign } from '@calwebtech/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, LINK, button } from '../ui/styles';

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
  const finished = campaign.status === 'SENDING' || campaign.status === 'SENT' || campaign.status === 'FAILED';

  return (
    <section aria-labelledby="campaign-send" className={`${CARD} ${CARD_PAD}`}>
      <h2 id="campaign-send" className={H2}>
        Send
      </h2>
      <p className={`${HELP} mt-1`}>
        {campaign.status === 'DRAFT'
          ? 'Pick a time, or send it now. The segment is counted again when the send starts.'
          : campaign.status === 'SCHEDULED'
            ? 'Waiting for its time. Until then it can go back to being a draft.'
            : 'How far the send has got, in people.'}
      </p>

      {campaign.status === 'DRAFT' ? (
        mayWrite ? (
          <div className="mt-4 flex flex-col gap-3">
            {!campaign.segment ? (
              <p className="text-[13.5px] leading-[1.5] text-ink-invert-muted">Choose a segment and save before scheduling.</p>
            ) : unsaved ? (
              <p className="text-[13.5px] leading-[1.5] text-ink-invert-muted">Save your changes first: the saved draft is what gets sent.</p>
            ) : null}
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Send at (your time)</span>
              <input
                type="datetime-local"
                value={sendAt}
                min={localInputValue(new Date())}
                disabled={busy}
                onChange={(event) => {
                  setSendAt(event.target.value);
                }}
                className={INPUT}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || unsaved || !campaign.segment || !sendAt}
                onClick={() => {
                  post('schedule', { sendAt: new Date(sendAt).toISOString() });
                }}
                className={button('primary')}
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
                className={button(confirmingNow ? 'danger' : 'secondary')}
              >
                {confirmingNow ? 'Yes, send it now' : 'Send now'}
              </button>
              {confirmingNow ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingNow(false);
                  }}
                  className={button('ghost')}
                >
                  Not yet
                </button>
              ) : null}
            </div>
            {confirmingNow && campaign.segment ? (
              <p role="status" className="rounded-lg border border-admin-line2 bg-admin-sunken px-3.5 py-3 text-[13.5px] leading-[1.55] text-ink-invert">
                {`This sends to ${campaign.segment.name}${segmentCount === null ? '' : `, ${segmentCount.toLocaleString()} ${segmentCount === 1 ? 'person' : 'people'} today`}, within a minute. It cannot be stopped once it starts.`}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-[14px] text-ink-invert-muted">Not scheduled.</p>
        )
      ) : null}

      {campaign.status === 'SCHEDULED' && campaign.scheduledAt ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[14.5px] leading-[1.55] font-semibold text-ink-invert">{`Scheduled for ${when(campaign.scheduledAt)}, to ${campaign.segment?.name ?? 'its segment'}.`}</p>
          <p className={HELP}>The segment is counted again when it starts.</p>
          {mayWrite ? (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  post('unschedule');
                }}
                className={button('secondary')}
              >
                Back to draft
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {finished ? (
        <div className="mt-4" aria-live="polite">
          <p className="font-display text-[28px] leading-none font-extrabold tracking-[-0.02em] text-ink-invert tabular-nums">
            {sent.toLocaleString()}
            <span className="text-[15px] font-semibold tracking-normal text-ink-invert-muted">{` of ${total.toLocaleString()} sent`}</span>
          </p>
          <p className="mt-2 flex items-start gap-2 text-[13.5px] leading-[1.5] text-ink-invert-muted">
            <span
              aria-hidden
              className={`mt-[5px] size-2 shrink-0 rounded-full ${
                campaign.status === 'SENT' ? 'bg-result' : campaign.status === 'FAILED' ? 'bg-danger' : 'bg-gold-500'
              }`}
            />
            <span>
              {[
                campaign.status === 'SENDING' ? 'Sending now' : campaign.status === 'SENT' ? 'Sent' : 'Failed',
                failed > 0 ? `${failed.toLocaleString()} not sent (failed, or suppressed before their turn)` : null,
                campaign.sentAt ? `finished ${when(campaign.sentAt)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
          <Link href={`/admin/campaigns/${encodeURIComponent(campaign.id)}/report/`} className={`${LINK} mt-3 inline-block text-[13.5px]`}>
            View the report →
          </Link>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={`${ERROR} mt-3`}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
