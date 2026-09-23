'use client';
import type { BookingPageContent, BookingSlotsView } from '@calwebtech/shared';
import { useActionState } from 'react';
import { submitBooking, type BookingFormState } from './actions';
import { BookingForm } from './booking-form';

/**
 * Holds the one piece of state the form cannot: what the server said.
 *
 * A refused slot comes back with the list as it now stands, so the form re-offers from
 * fresh times without a reload. A confirmed one replaces the form entirely — leaving it on
 * screen invites a second booking of a slot that is already gone.
 */
export function BookingSection({
  content,
  slots,
  source,
  turnstileSiteKey,
}: {
  content: BookingPageContent;
  slots: BookingSlotsView;
  source: string | null;
  turnstileSiteKey: string | undefined;
}) {
  const initial: BookingFormState = { status: 'idle' };
  const [state, action, pending] = useActionState(submitBooking, initial);

  if (state.status === 'booked') {
    const startsAt = new Date(state.confirmation.startsAt);
    const when = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(startsAt);
    return (
      <div role="status" className="border-t border-hairline-gold pt-8">
        <h2 className="display-md text-ink">{content.success.heading}</h2>
        <p className="body-lg mt-3 text-ink-muted">{content.success.body}</p>
        <p className="heading-md mt-6 text-ink">{when}</p>
        <p className="body-sm mt-2 text-ink-muted">
          {`${String(slots.consultationType.durationMinutes)} minutes · ${state.confirmation.consultationType}`}
        </p>
      </div>
    );
  }

  return (
    <>
      {state.status === 'error' ? (
        <p role="alert" className="body-base mb-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {state.message}
        </p>
      ) : null}
      <BookingForm
        content={content}
        // After a refusal the list is the one the server just rebuilt, not the stale one.
        slots={state.status === 'taken' && state.slots ? state.slots : slots}
        source={source}
        turnstileSiteKey={turnstileSiteKey}
        action={action}
        slotTaken={state.status === 'taken'}
        pending={pending}
      />
    </>
  );
}
