'use client';
import type { AdminAvailability } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, button } from '../ui/styles';

/**
 * The hours calls can be booked in, and the days they cannot (task 5.1).
 *
 * The whole week is sent in one save rather than a window at a time. A week is read as one
 * thing, and a half-saved week leaves the calendar in a state nobody chose — a visitor
 * booking in the second between two requests would be offered hours the owner had already
 * changed their mind about.
 *
 * Times are typed as clock faces and stored as minutes from midnight in the business's own
 * zone, which is the unit the slot generator works in. The zone itself is not edited here:
 * it belongs to the page, which states it to the visitor, and two places to change it is
 * one place to get it wrong.
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

interface Window {
  startMinute: number;
  endMinute: number;
}

interface Exception {
  day: string;
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
}

function clock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function minutesOf(value: string): number {
  const [hours = '0', rest = '0'] = value.split(':');
  return Number(hours) * 60 + Number(rest);
}

/** A time or date input sits in a fixed-width slot so a row of them lines up. */
const SLOT = 'w-[136px] shrink-0';

export function AvailabilityForm({ availability, mayWrite }: { availability: AdminAvailability; mayWrite: boolean }) {
  const router = useRouter();
  const [duration, setDuration] = useState(availability.consultationType.durationMinutes);
  const [bufferBefore, setBufferBefore] = useState(availability.consultationType.bufferBefore);
  const [bufferAfter, setBufferAfter] = useState(availability.consultationType.bufferAfter);
  // One notice for the whole week. The column exists per rule, but a firm has one policy,
  // and the engine applies the rule's own value either way.
  const [notice, setNotice] = useState(availability.rules[0]?.minimumNoticeHours ?? 24);
  const [week, setWeek] = useState<Window[][]>(() =>
    WEEKDAYS.map((_, weekday) =>
      availability.rules
        .filter((rule) => rule.weekday === weekday)
        .map((rule) => ({ startMinute: rule.startMinute, endMinute: rule.endMinute })),
    ),
  );
  const [exceptions, setExceptions] = useState<Exception[]>(() =>
    availability.overrides.map((entry) => ({
      day: entry.day,
      startMinute: entry.startMinute,
      endMinute: entry.endMinute,
      reason: entry.reason ?? '',
    })),
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function editWeek(weekday: number, next: Window[]): void {
    setWeek((current) => current.map((day, index) => (index === weekday ? next : day)));
    setSaved(false);
  }

  function save(): void {
    setBusy(true);
    setProblem(null);
    setSaved(false);
    const body = {
      durationMinutes: duration,
      bufferBefore,
      bufferAfter,
      rules: week.flatMap((windows, weekday) =>
        windows.map((window) => ({ weekday, ...window, minimumNoticeHours: notice })),
      ),
      // A date with no window is the whole day blocked; one with a window is open only then.
      overrides: exceptions
        .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.day))
        .map((entry) => ({
          day: entry.day,
          blocked: entry.startMinute === null,
          startMinute: entry.startMinute,
          endMinute: entry.endMinute,
          reason: entry.reason.trim() === '' ? null : entry.reason.trim(),
        })),
    };

    void adminMutate('/admin/bookings/availability', { method: 'PUT', body })
      .then(() => {
        setSaved(true);
        router.refresh();
      })
      .catch((cause: unknown) => {
        setProblem(cause instanceof MutationError ? cause.message : 'That could not be saved.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const stride = bufferBefore + duration + bufferAfter;
  const openDays = week.filter((windows) => windows.length > 0).length;
  const locked = !mayWrite || busy;

  return (
    <div className="flex flex-col gap-6">
      <Section id="availability-call" title="The call" description="How long a call lasts, and the room to leave around it.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberField
            id="duration"
            label="Call length (minutes)"
            min={5}
            max={480}
            step={5}
            value={duration}
            disabled={locked}
            onChange={(value) => {
              setDuration(value);
              setSaved(false);
            }}
          />
          <NumberField
            id="buffer-before"
            label="Gap before (minutes)"
            min={0}
            max={240}
            step={5}
            value={bufferBefore}
            disabled={locked}
            onChange={(value) => {
              setBufferBefore(value);
              setSaved(false);
            }}
          />
          <NumberField
            id="buffer-after"
            label="Gap after (minutes)"
            min={0}
            max={240}
            step={5}
            value={bufferAfter}
            disabled={locked}
            onChange={(value) => {
              setBufferAfter(value);
              setSaved(false);
            }}
          />
          <NumberField
            id="notice"
            label="Least notice (hours)"
            min={0}
            max={720}
            value={notice}
            disabled={locked}
            onChange={(value) => {
              setNotice(value);
              setSaved(false);
            }}
          />
        </div>
        <p className="mt-4 text-[14px] leading-[1.6] text-ink-invert-muted">
          {`One start every ${String(stride)} minutes, and nothing sooner than ${String(notice)} hours from now. Times are ${availability.timeZone}, and the page shows each visitor their own clock.`}
        </p>
      </Section>

      <Section
        id="availability-week"
        title="The week"
        description="The hours visitors can choose from on each day. A day with no window is closed."
      >
        <ul className="-my-1 divide-y divide-admin-line2">
          {WEEKDAYS.map((name, weekday) => {
            const windows = week[weekday] ?? [];
            return (
              <li key={name} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-5">
                <span className="w-28 shrink-0 text-[14.5px] font-semibold text-ink-invert sm:pt-2">{name}</span>

                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  {windows.length === 0 ? (
                    <span className="text-[14px] text-admin-muted sm:pt-2">Closed</span>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {windows.map((window, index) => (
                        // The index is the identity: two windows can hold the same hours while
                        // one of them is being typed into.
                        <li key={`${name}-${String(index)}`} className="flex flex-wrap items-center gap-2">
                          <span className={SLOT}>
                            <input
                              type="time"
                              aria-label={`${name} opens`}
                              value={clock(window.startMinute)}
                              disabled={locked}
                              onChange={(event) => {
                                editWeek(
                                  weekday,
                                  windows.map((entry, at) =>
                                    at === index ? { ...entry, startMinute: minutesOf(event.target.value) } : entry,
                                  ),
                                );
                              }}
                              className={INPUT}
                            />
                          </span>
                          <span className="text-[13px] text-admin-muted">to</span>
                          <span className={SLOT}>
                            <input
                              type="time"
                              aria-label={`${name} closes`}
                              value={clock(window.endMinute)}
                              disabled={locked}
                              onChange={(event) => {
                                editWeek(
                                  weekday,
                                  windows.map((entry, at) =>
                                    at === index ? { ...entry, endMinute: minutesOf(event.target.value) } : entry,
                                  ),
                                );
                              }}
                              className={INPUT}
                            />
                          </span>
                          {mayWrite ? (
                            <button
                              type="button"
                              disabled={busy}
                              aria-label={`Remove ${name} ${clock(window.startMinute)}`}
                              onClick={() => {
                                editWeek(
                                  weekday,
                                  windows.filter((_, at) => at !== index),
                                );
                              }}
                              className={button('ghost', 'sm')}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {mayWrite ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const last = windows.at(-1);
                        editWeek(weekday, [
                          ...windows,
                          last
                            ? { startMinute: Math.min(last.endMinute + 60, 23 * 60), endMinute: Math.min(last.endMinute + 60 + duration, 24 * 60) }
                            : { startMinute: 9 * 60, endMinute: 17 * 60 },
                        ]);
                      }}
                      className={`${button('secondary', 'sm')} self-start`}
                    >
                      {windows.length === 0 ? `Open ${name}` : `Another window on ${name}`}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[14px] leading-[1.6] text-ink-invert-muted">
          {openDays === 0
            ? 'Every day is closed, so the page tells visitors there are no times rather than showing any.'
            : `${String(openDays)} of seven days are open. Two windows on one day sit either side of lunch; they may not overlap.`}
        </p>
      </Section>

      <Section
        id="availability-days-off"
        title="Days off"
        description="A date here beats the week. Leave the hours empty to close the day completely, or set them to open only then."
      >
        {exceptions.length === 0 ? (
          <p className="text-[14px] text-ink-invert-muted">No days off yet. Every date follows the week above.</p>
        ) : (
          <ul className="-my-1 divide-y divide-admin-line2">
            {exceptions.map((entry, index) => (
              <li key={`exception-${String(index)}`} className="flex flex-wrap items-end gap-3 py-4">
                <label className={`flex flex-col gap-1.5 ${SLOT} max-sm:w-[calc(50%-6px)]`}>
                  <span className={LABEL}>Date</span>
                  <input
                    type="date"
                    aria-label="Date"
                    value={entry.day}
                    disabled={locked}
                    onChange={(event) => {
                      setExceptions((current) =>
                        current.map((item, at) => (at === index ? { ...item, day: event.target.value } : item)),
                      );
                      setSaved(false);
                    }}
                    className={INPUT}
                  />
                </label>
                <label className={`flex flex-col gap-1.5 ${SLOT} max-sm:w-[calc(50%-6px)]`}>
                  <span className={LABEL}>Open from</span>
                  <input
                    type="time"
                    aria-label="Open from"
                    value={entry.startMinute === null ? '' : clock(entry.startMinute)}
                    disabled={locked}
                    onChange={(event) => {
                      const value = event.target.value === '' ? null : minutesOf(event.target.value);
                      setExceptions((current) =>
                        current.map((item, at) =>
                          at === index
                            ? { ...item, startMinute: value, endMinute: value === null ? null : (item.endMinute ?? 24 * 60) }
                            : item,
                        ),
                      );
                      setSaved(false);
                    }}
                    className={INPUT}
                  />
                </label>
                <label className={`flex flex-col gap-1.5 ${SLOT} max-sm:w-[calc(50%-6px)]`}>
                  <span className={LABEL}>Open until</span>
                  <input
                    type="time"
                    aria-label="Open until"
                    value={entry.endMinute === null ? '' : clock(entry.endMinute)}
                    disabled={locked || entry.startMinute === null}
                    onChange={(event) => {
                      const value = event.target.value === '' ? null : minutesOf(event.target.value);
                      setExceptions((current) => current.map((item, at) => (at === index ? { ...item, endMinute: value } : item)));
                      setSaved(false);
                    }}
                    className={INPUT}
                  />
                </label>
                <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                  <span className={LABEL}>Reason</span>
                  <input
                    type="text"
                    aria-label="Why"
                    value={entry.reason}
                    placeholder="Public holiday"
                    maxLength={120}
                    disabled={locked}
                    onChange={(event) => {
                      setExceptions((current) =>
                        current.map((item, at) => (at === index ? { ...item, reason: event.target.value } : item)),
                      );
                      setSaved(false);
                    }}
                    className={INPUT}
                  />
                </label>
                {mayWrite ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Remove ${entry.day === '' ? 'this date' : entry.day}`}
                    onClick={() => {
                      setExceptions((current) => current.filter((_, at) => at !== index));
                      setSaved(false);
                    }}
                    className={`${button('ghost', 'sm')} mb-1`}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {mayWrite ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setExceptions((current) => [...current, { day: '', startMinute: null, endMinute: null, reason: '' }]);
              setSaved(false);
            }}
            className={`${button('secondary', 'sm')} ${exceptions.length === 0 ? 'mt-4' : 'mt-5'}`}
          >
            Add a date
          </button>
        ) : null}
      </Section>

      {problem ? (
        <p role="alert" className={ERROR}>
          {problem}
        </p>
      ) : null}

      {mayWrite ? (
        <div className={`${CARD} flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6`}>
          <p role="status" className="flex items-center gap-2 text-[14px] text-ink-invert-muted">
            {saved ? (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-result" />
                Saved. The page offers the new hours from the next visit.
              </>
            ) : (
              'Everything above is saved together, as one week.'
            )}
          </p>
          <button type="button" disabled={busy} onClick={save} className={button('primary')}>
            {busy ? 'Saving…' : 'Save availability'}
          </button>
        </div>
      ) : (
        <p className={HELP}>You can read these hours but not change them.</p>
      )}
    </div>
  );
}

/** A card with a heading and one line on what it holds, the shape every group here sits in. */
function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${CARD} ${CARD_PAD}`}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 id={id} className={H2}>
          {title}
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        className={INPUT}
      />
    </div>
  );
}
