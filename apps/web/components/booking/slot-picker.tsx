'use client';
import type { BookingSlotsView } from '@calwebtech/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowIcon } from '../ui/icons';

/**
 * A month beside its free times, in the visitor's own clock: the first step of booking a call
 * and the whole of moving one (docs/08-decisions.md, 60).
 *
 * The API sends instants; this renders them in the visitor's zone and hands one back. It does
 * no slot arithmetic of its own — a browser that computed slots would offer times the rules
 * never allowed.
 */

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

/** The visitor's own zone, as the browser reports it. */
export function visitorZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** True when the list holds at least one free time. */
export function hasFreeTime(slots: BookingSlotsView): boolean {
  return slots.days.some((day) => day.slots.length > 0);
}

export interface SlotPickerProps {
  slots: BookingSlotsView;
  zone: string;
  chosen: string | null;
  onChoose: (startsAt: string) => void;
  /** Called on the first touch of a day or a time, e.g. to load the bot check early. */
  onInteract?: () => void;
}

export function SlotPicker({ slots, zone, chosen, onChoose, onInteract }: SlotPickerProps) {
  /** Null until the visitor moves: the first month and day with a free time are the default. */
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

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

  return (
    // A month beside its times: the horizon is thirty days, and thirty days of times in one
    // column is a scroll, not a choice.
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
                <th key={weekday.long} scope="col" className="pb-2 text-center">
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
                          onInteract?.();
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
                      onInteract?.();
                      onChoose(slot.startsAt);
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
  );
}
