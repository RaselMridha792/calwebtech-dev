'use client';
import type { BookingPageContent, BookingSlotsView } from '@calwebtech/shared';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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

/**
 * Monday first, named by the browser's own locale rather than written out in English.
 * 2024-01-01 was a Monday, so seven days from it name the week in order.
 */
const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const at = new Date(Date.UTC(2024, 0, 1 + index));
  return {
    short: new Intl.DateTimeFormat(undefined, { weekday: 'narrow', timeZone: 'UTC' }).format(at),
    long: new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(at),
  };
});

/** The month's cells cut into weeks of seven. */
function weeks(cells: readonly (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let at = 0; at < cells.length; at += 7) rows.push(cells.slice(at, at + 7));
  return rows;
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center border border-hairline text-ink transition-colors duration-150 hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-30"
    >
      {children}
    </button>
  );
}

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
  /** Null until the visitor moves: the first month and day with a free time are the default. */
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
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
    const byDay = new Map<string, { key: string; label: string; slots: { startsAt: string; time: string }[] }>();
    const key = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone });
    for (const day of slots.days) {
      for (const slot of day.slots) {
        const at = new Date(slot.startsAt);
        const dayKey = key.format(at);
        const entry = byDay.get(dayKey) ?? { key: dayKey, label: dayLabel.format(at), slots: [] };
        entry.slots.push({ startsAt: slot.startsAt, time: timeLabel.format(at) });
        byDay.set(dayKey, entry);
      }
    }
    return [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [slots, zone, dayLabel, timeLabel]);

  const free = useMemo(() => new Map(days.map((day) => [day.key, day])), [days]);

  /** The months the horizon reaches, in order: at most two, and never one with nothing in it. */
  const months = useMemo(() => [...new Set(days.map((day) => day.key.slice(0, 7)))], [days]);
  const month = openMonth && months.includes(openMonth) ? openMonth : (months[0] ?? '');
  const monthAt = months.indexOf(month);

  const day = openDay && free.has(openDay) ? openDay : (days[0]?.key ?? '');
  const shown = free.get(day) ?? null;

  /**
   * The month as a calendar reads it: leading blanks to the first weekday, then its days,
   * padded to whole weeks.
   *
   * The arithmetic is on UTC dates although the keys are the visitor's own calendar days,
   * which is not a contradiction: `2026-10-03` names the same square of the grid whatever
   * zone wrote it, and UTC is the one way to do day-of-week arithmetic that never lands on
   * a daylight-saving boundary.
   */
  const grid = useMemo(() => {
    const [year = 0, index = 1] = month.split('-').map(Number);
    if (!year) return [];
    const first = new Date(Date.UTC(year, index - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday first.
    const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let date = 1; date <= length; date += 1) {
      cells.push(`${month}-${String(date).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const monthLabel = useMemo(() => {
    const [year = 0, index = 1] = month.split('-').map(Number);
    if (!year) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, index - 1, 1)),
    );
  }, [month]);

  const fullDate = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    [],
  );

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
          <p className="body-base mt-2 max-w-[46rem] text-ink-muted">{content.steps.slot.intro}</p>
        ) : null}

        {/* A month beside its times: the horizon is thirty days, and thirty days of times in
            one column is a scroll, not a choice. */}
        <div className="mt-8 grid gap-10 border-t border-hairline pt-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="heading-sm text-ink" aria-live="polite">
                {monthLabel}
              </p>
              <div className="flex gap-1">
                <MonthButton
                  label="Previous month"
                  disabled={monthAt <= 0}
                  onClick={() => {
                    setOpenMonth(months[monthAt - 1] ?? month);
                  }}
                >
                  <ArrowIcon className="w-4 rotate-180" />
                </MonthButton>
                <MonthButton
                  label="Next month"
                  disabled={monthAt < 0 || monthAt >= months.length - 1}
                  onClick={() => {
                    setOpenMonth(months[monthAt + 1] ?? month);
                  }}
                >
                  <ArrowIcon className="w-4" />
                </MonthButton>
              </div>
            </div>

            <table className="mt-5 w-full table-fixed border-collapse">
              <caption className="sr-only">{`Days with a free time in ${monthLabel}`}</caption>
              <thead>
                <tr>
                  {WEEKDAYS.map((weekday) => (
                    <th key={weekday.short} scope="col" className="pb-2 text-center">
                      <span aria-hidden="true" className="meta text-ink-muted">
                        {weekday.short}
                      </span>
                      <span className="sr-only">{weekday.long}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks(grid).map((week) => (
                  <tr key={week[0] ?? String(week.indexOf(null))}>
                    {week.map((cell, index) => (
                      <td key={cell ?? `blank-${String(index)}`} className="p-0.5 text-center">
                        {cell === null ? (
                          <span className="block h-11" />
                        ) : (
                          <button
                            type="button"
                            disabled={!free.has(cell)}
                            aria-pressed={day === cell}
                            aria-label={`${fullDate.format(new Date(`${cell}T12:00:00Z`))}${
                              free.has(cell) ? '' : ', nothing free'
                            }`}
                            onClick={() => {
                              warmUp();
                              setOpenDay(cell);
                            }}
                            className={`meta h-11 w-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                              day === cell
                                ? 'bg-navy-900 text-ink-invert'
                                : free.has(cell)
                                  ? 'text-ink underline decoration-hairline-gold decoration-2 underline-offset-[6px] hover:bg-canvas-sunken'
                                  : 'text-ink-muted/45'
                            }`}
                          >
                            {Number(cell.slice(8))}
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="body-sm mt-4 text-ink-muted">{`Times are shown in ${zone.replace(/_/g, ' ')}.`}</p>
          </div>

          <div className="border-t border-hairline pt-6 lg:border-t-0 lg:border-s lg:pt-0 lg:ps-16">
            <p className="eyebrow text-ink-muted">{shown ? shown.label : 'No day chosen'}</p>
            {shown ? (
              <>
                <ul id="booking-times" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {shown.slots.map((slot) => (
                    <li key={slot.startsAt}>
                      <button
                        type="button"
                        aria-pressed={chosen === slot.startsAt}
                        onClick={() => {
                          warmUp();
                          setChosen(slot.startsAt);
                          setStep('details');
                        }}
                        className={`button-label min-h-11 w-full border px-3 py-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
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
                <p className="body-sm mt-5 text-ink-muted">
                  {`${String(shown.slots.length)} ${shown.slots.length === 1 ? 'time' : 'times'} free. Choosing one takes you to the next step.`}
                </p>
              </>
            ) : (
              <p className="body-base mt-4 text-ink-muted">Pick a day with a line under it.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="booking-details" className="mt-8 max-w-[46rem]" hidden={step !== 'details'}>
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

      <section aria-labelledby="booking-review" className="mt-8 max-w-[46rem]" hidden={step !== 'review'}>
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
