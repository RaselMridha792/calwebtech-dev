'use client';
import type { BookingPageContent, BookingSlotsView } from '@calwebtech/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { TURNSTILE_FIELD, useTurnstile } from '../forms/use-turnstile';
import { ArrowIcon } from '../ui/icons';

/**
 * The booking form: pick a time, say who you are, confirm.
 *
 * Three things this does not do, each deliberately:
 *
 * - **No date library.** Every route has 20 kB of its own JavaScript to spend and a date
 *   library is most of it. `Intl.DateTimeFormat` already knows every timezone the browser
 *   does, which is all this needs.
 * - **No slot arithmetic.** The API sends instants; this renders them in the visitor's own
 *   zone and sends one back. A browser that computed its own slots would offer times the
 *   rules never allowed.
 * - **No optimism.** A confirmed slot is confirmed by the server. When it comes back taken
 *   — which happens, because two people can want the same hour — the form says so and
 *   shows the list again rather than pretending.
 */

type Step = 'slot' | 'details' | 'review';

export interface BookingFormProps {
  content: BookingPageContent;
  slots: BookingSlotsView;
  /** Carried from the cost calculator's result, when the visitor arrived from it. */
  source: string | null;
  turnstileSiteKey: string | undefined;
  action: (formData: FormData) => void;
  /** Set when the server refused the slot; the list below it is already the new one. */
  slotTaken?: boolean;
  pending?: boolean;
}

/** The visitor's own zone, as the browser reports it. */
function visitorZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function BookingForm({
  content,
  slots,
  source,
  turnstileSiteKey,
  action,
  slotTaken = false,
  pending = false,
}: BookingFormProps) {
  const [step, setStep] = useState<Step>('slot');
  const [chosen, setChosen] = useState<string | null>(null);
  const zone = useMemo(() => visitorZone(), []);
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [checkProblem, setCheckProblem] = useState<string | null>(null);
  const { containerRef, prepare, waitForToken } = useTurnstile(turnstileSiteKey, 'book-a-consultation');

  /**
   * Waits for the challenge, then sends the form — in that order, and only once.
   *
   * Cloudflare writes the token into the form, so there is nothing to send until it has.
   * The payload is built here rather than left to the form's own submission: it is read at
   * the moment the wait resolved, which is the one point where the field is known to hold a
   * token, and the three steps need JavaScript anyway.
   */
  const startingRef = useRef<Promise<unknown> | null>(null);

  /** Loads the widget while the visitor is still typing, so confirming waits on nothing. */
  const warmUp = useCallback(() => {
    startingRef.current ??= prepare().catch(() => null);
  }, [prepare]);

  const confirm = useCallback(() => {
    const form = formRef.current;
    if (!form || busy) return;
    setCheckProblem(null);

    // A widget that is already loading is waited for, never joined by a second: two hidden
    // fields of the same name and the server reads whichever came first.
    startingRef.current ??= prepare().catch(() => null);
    setBusy(true);
    void startingRef.current.then(() =>
      waitForToken(form).then(
        () => {
          setBusy(false);
          const payload = new FormData(form);
          payload.set(TURNSTILE_FIELD, form.querySelector<HTMLInputElement>(`input[name="${TURNSTILE_FIELD}"]`)?.value ?? '');
          action(payload);
        },
        () => {
          setBusy(false);
          // Sending it anyway would only have the API refuse it, and the visitor would be
          // told their own booking looked automated.
          setCheckProblem('The security check did not finish. Please try again.');
        },
      ),
    );
  }, [action, busy, prepare, waitForToken]);

  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone }),
    [zone],
  );
  const timeLabel = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone }),
    [zone],
  );

  /**
   * The API groups slots by the business's calendar day. A visitor far enough east or west
   * sees a slot fall on the day before or after, so the days are rebuilt here against
   * their own clock — otherwise a Friday evening in Los Angeles sits under "Friday" for
   * someone in Sydney for whom it is Saturday lunchtime.
   */
  const days = useMemo(() => {
    const byDay = new Map<string, { label: string; slots: { startsAt: string; time: string }[] }>();
    const key = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone });
    for (const day of slots.days) {
      for (const slot of day.slots) {
        const at = new Date(slot.startsAt);
        const dayKey = key.format(at);
        const entry = byDay.get(dayKey) ?? { label: dayLabel.format(at), slots: [] };
        entry.slots.push({ startsAt: slot.startsAt, time: timeLabel.format(at) });
        byDay.set(dayKey, entry);
      }
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  }, [slots, zone, dayLabel, timeLabel]);

  const chosenAt = chosen ? new Date(chosen) : null;

  if (days.length === 0) {
    return (
      <div className="border-t border-hairline pt-8">
        <p className="body-lg text-ink-muted">{content.empty}</p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="border-t border-hairline pt-8"
    >
      <Steps step={step} />

      {slotTaken ? (
        <p role="alert" className="body-base mt-6 border-l-2 border-gold-ink py-1 ps-4 text-ink">
          Somebody booked that time while you were filling this in. Here are the times still free.
        </p>
      ) : null}

      <section aria-labelledby="booking-slot" className="mt-8" hidden={step !== 'slot'}>
          <h2 id="booking-slot" className="heading-lg text-ink">
            {content.steps.slot.heading}
          </h2>
          {content.steps.slot.intro ? (
            <p className="body-base mt-2 text-ink-muted">{content.steps.slot.intro}</p>
          ) : null}

          <div className="mt-6 max-h-[28rem] overflow-y-auto border-t border-hairline">
            {days.map((day) => (
              <div key={day.label} className="border-b border-hairline py-5">
                <p className="eyebrow text-ink-muted">{day.label}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <li key={slot.startsAt}>
                      <button
                        type="button"
                        aria-pressed={chosen === slot.startsAt}
                        onClick={() => {
                          warmUp();
                          setChosen(slot.startsAt);
                          setStep('details');
                        }}
                        className={`button-label min-h-11 border px-4 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                          chosen === slot.startsAt
                            ? 'border-navy-900 bg-navy-900 text-ink-invert'
                            : 'border-hairline text-ink hover:border-hairline-strong hover:bg-canvas-raised'
                        }`}
                      >
                        {slot.time}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        <p className="body-sm mt-4 text-ink-muted">{`Times are shown in ${zone.replace(/_/g, ' ')}.`}</p>
      </section>

      <section aria-labelledby="booking-details" className="mt-8" hidden={step !== 'details'}>
          <h2 id="booking-details" className="heading-lg text-ink">
            {content.steps.details.heading}
          </h2>
          {content.steps.details.intro ? (
            <p className="body-base mt-2 text-ink-muted">{content.steps.details.intro}</p>
          ) : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field name="name" label="Full name" required autoComplete="name" />
            <Field name="email" label="Work email" type="email" required autoComplete="email" />
            <Field name="phone" label="Phone" optional autoComplete="tel" />
          </div>
          <div className="mt-5">
            <label htmlFor="booking-context" className="eyebrow text-ink-muted">
              What would you like to talk about?
            </label>
            <textarea
              id="booking-context"
              name="context"
              rows={4}
              className="body-base mt-2 w-full border border-hairline bg-canvas-raised px-4 py-3 text-ink outline-none focus-visible:border-gold-ink"
            />
          </div>

          <Actions
            back={() => {
              setStep('slot');
            }}
            next={() => {
              const form = formRef.current;
              const details = form?.querySelectorAll<HTMLInputElement>('#booking-name, #booking-email');
              for (const field of details ?? []) {
                if (!field.reportValidity()) return;
              }
              warmUp();
              setStep('review');
            }}
          nextLabel="Review"
        />
      </section>

      <section aria-labelledby="booking-review" className="mt-8" hidden={step !== 'review'}>
          <h2 id="booking-review" className="heading-lg text-ink">
            {content.steps.review.heading}
          </h2>
          {chosenAt ? (
            <p className="display-md mt-4 text-ink">
              {`${dayLabel.format(chosenAt)}, ${timeLabel.format(chosenAt)}`}
            </p>
          ) : null}
          <p className="body-sm mt-2 text-ink-muted">
            {`${String(slots.consultationType.durationMinutes)} minutes · ${slots.consultationType.name}`}
          </p>
          <p className="body-base mt-5 border-t border-hairline-gold pt-5 text-ink-muted">{content.meetingNote}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('details');
              }}
              className="button-label min-h-12 border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong"
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending || busy || chosen === null}
              className="button-label inline-flex min-h-12 items-center gap-2 bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40"
            >
              {pending || busy ? 'Confirming…' : content.submitLabel}
              <ArrowIcon className="w-4" />
            </button>
          </div>
        {content.footnote ? <p className="body-sm mt-4 text-ink-muted">{content.footnote}</p> : null}
      </section>

      <input type="hidden" name="startsAt" value={chosen ?? ''} />
      <input type="hidden" name="timezone" value={zone} />
      <input type="hidden" name="consultationType" value={slots.consultationType.slug} />
      {source ? <input type="hidden" name="source" value={source} /> : null}
      {checkProblem ? (
        <p role="alert" className="body-base mt-6 border-l-2 border-danger py-1 ps-4 text-ink">
          {checkProblem}
        </p>
      ) : null}
      {/* The site's own widget, so the field name and the lifecycle are the ones every
          other form uses (components/forms/use-turnstile.ts). */}
      <div ref={containerRef} className="mt-6" />
    </form>
  );
}

/** Where the visitor is, as three states rather than a bar that means nothing on its own. */
function Steps({ step }: { step: Step }) {
  const order: Step[] = ['slot', 'details', 'review'];
  const labels: Record<Step, string> = { slot: 'Time', details: 'Details', review: 'Confirm' };
  const current = order.indexOf(step);
  return (
    <ol className="meta flex flex-wrap gap-x-6 gap-y-1 text-ink-muted">
      {order.map((name, index) => (
        <li key={name} aria-current={index === current ? 'step' : undefined} className={index <= current ? 'text-gold-ink' : ''}>
          {`${String(index + 1).padStart(2, '0')} — ${labels[name]}`}
        </li>
      ))}
    </ol>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = false,
  optional = false,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
}) {
  const id = `booking-${name}`;
  return (
    <div>
      <label htmlFor={id} className="eyebrow text-ink-muted">
        {label}
        {optional ? <span className="ms-2 normal-case tracking-normal">(optional)</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="body-base mt-2 h-12 w-full border border-hairline bg-canvas-raised px-4 text-ink outline-none focus-visible:border-gold-ink"
      />
    </div>
  );
}

function Actions({ back, next, nextLabel }: { back: () => void; next: () => void; nextLabel: string }) {
  return (
    <div className="mt-7 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={back}
        className="button-label min-h-12 border border-hairline px-5 text-ink transition-colors duration-150 hover:border-hairline-strong"
      >
        Back
      </button>
      <button
        type="button"
        onClick={next}
        className="button-label inline-flex min-h-12 items-center gap-2 bg-navy-900 px-6 text-ink-invert transition-colors duration-150 hover:bg-navy-700"
      >
        {nextLabel}
        <ArrowIcon className="w-4" />
      </button>
    </div>
  );
}
