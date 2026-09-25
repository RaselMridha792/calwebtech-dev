'use client';
import type { BookingSlotsView } from '@calwebtech/shared';
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowIcon } from '../ui/icons';
import { moveCall, type ManageState } from './manage-actions';
import { SlotPicker, hasFreeTime, visitorZone } from './slot-picker';

/**
 * Moving a booked call (docs/08-decisions.md, 60): the same month and times as booking one,
 * without the call's own time, then a confirmation. The server decides whether the new time
 * is still free; when it is not, the list comes back as it now stands.
 */
const INITIAL: ManageState = { status: 'idle' };

export function RescheduleForm({
  token,
  slots,
  current,
  typeSlug,
}: {
  token: string;
  slots: BookingSlotsView;
  /** The call's time now, left out of the list. */
  current: string;
  typeSlug: string;
}) {
  const [state, dispatch, pending] = useActionState(moveCall, INITIAL);
  const [chosen, setChosen] = useState<string | null>(null);
  const zone = useMemo(() => visitorZone(), []);
  const doneRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);

  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: zone,
      }),
    [zone],
  );

  useEffect(() => {
    if (state.status === 'done') doneRef.current?.focus();
  }, [state]);

  if (state.status === 'done') {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="border-t border-hairline pt-8 outline-none">
        <p className="heading-lg text-ink">Your call has moved</p>
        <p className="display-md mt-4 text-ink">{when.format(new Date(state.view.startsAt))}</p>
        <p className="body-lg mt-4 max-w-[46rem] text-ink-muted">
          We have emailed you the new time with an updated calendar entry. The meeting link still comes from a person
          before the call.
        </p>
      </div>
    );
  }

  if (state.status === 'closed') {
    return (
      <p role="alert" className="body-lg border-t border-hairline pt-8 text-ink-muted">
        This call can no longer be moved: it has been cancelled or its time has passed.
      </p>
    );
  }

  // Every free time but the one the call already has.
  const latest = state.status === 'taken' && state.slots ? state.slots : slots;
  const offered = {
    ...latest,
    days: latest.days.map((day) => ({ ...day, slots: day.slots.filter((slot) => slot.startsAt !== current) })),
  };

  if (!hasFreeTime(offered)) {
    return (
      <p className="body-lg border-t border-hairline pt-8 text-ink-muted">
        There are no other free times in the next few weeks. Reply to your confirmation email and we will find one.
      </p>
    );
  }

  return (
    <form
      className="border-t border-hairline pt-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (!chosen) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => {
          dispatch(data);
        });
      }}
    >
      {state.status === 'taken' ? (
        <p role="alert" className="body-base mb-6 border-l-2 border-gold-ink py-1 ps-4 text-ink">
          Somebody booked that time a moment ago. Here are the times still free.
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p role="alert" className="body-base mb-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {state.message}
        </p>
      ) : null}

      <section aria-labelledby="move-slot" hidden={chosen !== null}>
        <h2 id="move-slot" className="heading-lg text-ink">
          Choose a new time
        </h2>
        <SlotPicker
          slots={offered}
          zone={zone}
          chosen={chosen}
          onChoose={(startsAt) => {
            setChosen(startsAt);
            // The review replaces the list; focus goes where the page changed.
            requestAnimationFrame(() => reviewRef.current?.focus());
          }}
        />
      </section>

      <section aria-labelledby="move-review" className="max-w-[46rem]" hidden={chosen === null}>
        <h2 id="move-review" ref={reviewRef} tabIndex={-1} className="heading-lg text-ink outline-none">
          Move your call to
        </h2>
        {chosen ? <p className="display-md mt-4 text-ink">{when.format(new Date(chosen))}</p> : null}
        <p className="body-sm mt-2 text-ink-muted">{`Times are shown in ${zone.replace(/_/g, ' ')}.`}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setChosen(null);
            }}
            className="button-label min-h-12 border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending || chosen === null}
            className="button-label inline-flex min-h-12 items-center gap-2 bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
          >
            {pending ? 'Moving…' : 'Move my call'}
            <ArrowIcon className="w-4" />
          </button>
        </div>
      </section>

      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="startsAt" value={chosen ?? ''} />
      <input type="hidden" name="timezone" value={zone} />
      <input type="hidden" name="type" value={typeSlug} />
    </form>
  );
}
