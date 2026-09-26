'use client';
import type { AdminBookingDetail } from '@calwebtech/shared';
import { BOOKING_STATUSES, BOOKING_STATUS_LABELS } from '@calwebtech/shared/booking-status';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, ERROR, H2, HELP, LABEL, TEXTAREA, button } from '../ui/styles';

/**
 * Where a call stands, and what came of it.
 *
 * The two live together because they are usually changed together: a call is marked
 * completed and what was said is written down in the same minute. A status change writes
 * an event, so the history beside this panel says how the booking reached the state it is
 * in rather than only what that state is.
 */
export function BookingPanel({ booking, mayWrite }: { booking: AdminBookingDetail; mayWrite: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = status !== booking.status || notes !== (booking.notes ?? '');

  function save(): void {
    setBusy(true);
    setError(null);
    setSaved(false);
    void adminMutate(`/admin/bookings/${encodeURIComponent(booking.id)}`, {
      method: 'PATCH',
      body: { status, notes },
    })
      .then(() => {
        setSaved(true);
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof MutationError ? cause.message : 'That could not be saved.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <section aria-labelledby="booking-standing" className={`${CARD} ${CARD_PAD}`}>
      <h2 id="booking-standing" className={H2}>
        Where this stands
      </h2>
      <p className={`${HELP} mt-1`}>Mark the call as it happens and note what came of it. Both are saved together.</p>

      <fieldset className="mt-5">
        <legend className={LABEL}>Status</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOOKING_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              disabled={!mayWrite || busy}
              aria-pressed={status === option}
              onClick={() => {
                setStatus(option);
                setSaved(false);
              }}
              className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 pointer-coarse:h-11 disabled:cursor-not-allowed disabled:opacity-50 ${
                status === option
                  ? 'border-admin-edge bg-admin-nav text-ink-invert'
                  : 'border-admin-line text-ink-invert-muted hover:border-admin-edge hover:text-ink-invert'
              }`}
            >
              {BOOKING_STATUS_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <label htmlFor="booking-notes" className={`${LABEL} mt-5 block`}>
        Notes
      </label>
      <textarea
        id="booking-notes"
        value={notes}
        disabled={!mayWrite || busy}
        rows={5}
        onChange={(event) => {
          setNotes(event.target.value);
          setSaved(false);
        }}
        placeholder="What was agreed, and what happens next."
        className={`${TEXTAREA} mt-2`}
      />

      {error ? (
        <p role="alert" className={`${ERROR} mt-3`}>
          {error}
        </p>
      ) : null}

      {mayWrite ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy || !changed} className={button('primary')}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <p role="status" className="flex items-center gap-2 text-[13px] text-ink-invert-muted">
            {saved && !changed ? (
              <>
                <span aria-hidden className="size-2 rounded-full bg-result" />
                Saved.
              </>
            ) : changed ? (
              'Unsaved changes.'
            ) : null}
          </p>
        </div>
      ) : (
        <p className={`${HELP} mt-4`}>You can read this booking but not change it.</p>
      )}
    </section>
  );
}
