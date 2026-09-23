'use client';
import type { AdminBookingDetail } from '@calwebtech/shared';
import { BOOKING_STATUSES, BOOKING_STATUS_LABELS } from '@calwebtech/shared/booking-status';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

/**
 * Where a call stands, and what came of it.
 *
 * The two live together because they are usually changed together: a call is marked
 * completed and what was said is written down in the same minute. A status change writes
 * an event, so the history below this panel says how the booking reached the state it is
 * in rather than only what that state is.
 */
export function BookingPanel({ booking, mayWrite }: { booking: AdminBookingDetail; mayWrite: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = status !== booking.status || notes !== (booking.notes ?? '');

  function save(): void {
    setBusy(true);
    setError(null);
    void adminMutate(`/admin/bookings/${encodeURIComponent(booking.id)}`, {
      method: 'PATCH',
      body: { status, notes },
    })
      .then(() => {
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
    <section className="mt-8 border-t border-admin-line pt-5">
      <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Where this stands</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {BOOKING_STATUSES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={!mayWrite || busy}
            aria-pressed={status === option}
            onClick={() => {
              setStatus(option);
            }}
            className={`h-8 rounded-[4px] border px-3 text-[12.5px] font-semibold disabled:opacity-40 ${
              status === option
                ? 'border-admin-edge bg-admin-nav text-admin-ink'
                : 'border-admin-line text-admin-body hover:border-admin-focus'
            }`}
          >
            {BOOKING_STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      <label htmlFor="booking-notes" className="mt-5 block text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
        Notes
      </label>
      <textarea
        id="booking-notes"
        value={notes}
        disabled={!mayWrite || busy}
        rows={4}
        onChange={(event) => {
          setNotes(event.target.value);
        }}
        placeholder="What was agreed, and what happens next."
        className="mt-2 w-full rounded-[4px] border border-admin-line bg-admin-sunken px-3 py-2 text-[13px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-40"
      />

      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      {mayWrite ? (
        <button
          type="button"
          onClick={save}
          disabled={busy || !changed}
          className="mt-3 h-9 rounded-[4px] bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      ) : null}
    </section>
  );
}
