'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { cancelCall, type ManageState } from './manage-actions';

/**
 * Cancelling a booked call from its signed link (docs/08-decisions.md, 60). One button, and
 * a confirmation that says the time is free again and how to book another.
 */
const INITIAL: ManageState = { status: 'idle' };

export function CancelForm({ token, bookAgainHref }: { token: string; bookAgainHref: string }) {
  const [state, dispatch, pending] = useActionState(cancelCall, INITIAL);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === 'done') doneRef.current?.focus();
  }, [state]);

  if (state.status === 'done') {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="border-t border-hairline pt-8 outline-none">
        <p className="heading-lg text-ink">Your call is cancelled</p>
        <p className="body-lg mt-4 max-w-[46rem] text-ink-muted">
          The time is free again and we have emailed you to confirm. If you would like to talk another time, choose one
          whenever suits you.
        </p>
        <a
          href={bookAgainHref}
          className="button-label mt-7 inline-flex min-h-12 items-center border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Book another time
        </a>
      </div>
    );
  }

  if (state.status === 'closed') {
    return (
      <p role="alert" className="body-lg border-t border-hairline pt-8 text-ink-muted">
        This call can no longer be cancelled here: its time has passed. Reply to your confirmation email if something
        is wrong.
      </p>
    );
  }

  return (
    <form
      className="border-t border-hairline pt-8"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => {
          dispatch(data);
        });
      }}
    >
      {state.status === 'error' ? (
        <p role="alert" className="body-base mb-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="button-label inline-flex min-h-12 items-center bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
      >
        {pending ? 'Cancelling…' : 'Cancel this call'}
      </button>
    </form>
  );
}
