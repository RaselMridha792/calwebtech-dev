'use client';
import type { AdminAvailability } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

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

const field =
  'h-8 rounded-[4px] border border-admin-line bg-admin-sunken px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-40';
const label = 'block text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';

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

  return (
    <div className="mt-6">
      <section>
        <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">The call</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="duration" className={label}>
              Minutes
            </label>
            <input
              id="duration"
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              disabled={!mayWrite || busy}
              onChange={(event) => {
                setDuration(Number(event.target.value));
                setSaved(false);
              }}
              className={`mt-1.5 w-24 ${field}`}
            />
          </div>
          <div>
            <label htmlFor="buffer-before" className={label}>
              Gap before
            </label>
            <input
              id="buffer-before"
              type="number"
              min={0}
              max={240}
              step={5}
              value={bufferBefore}
              disabled={!mayWrite || busy}
              onChange={(event) => {
                setBufferBefore(Number(event.target.value));
                setSaved(false);
              }}
              className={`mt-1.5 w-24 ${field}`}
            />
          </div>
          <div>
            <label htmlFor="buffer-after" className={label}>
              Gap after
            </label>
            <input
              id="buffer-after"
              type="number"
              min={0}
              max={240}
              step={5}
              value={bufferAfter}
              disabled={!mayWrite || busy}
              onChange={(event) => {
                setBufferAfter(Number(event.target.value));
                setSaved(false);
              }}
              className={`mt-1.5 w-24 ${field}`}
            />
          </div>
          <div>
            <label htmlFor="notice" className={label}>
              Least notice, hours
            </label>
            <input
              id="notice"
              type="number"
              min={0}
              max={720}
              value={notice}
              disabled={!mayWrite || busy}
              onChange={(event) => {
                setNotice(Number(event.target.value));
                setSaved(false);
              }}
              className={`mt-1.5 w-24 ${field}`}
            />
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-admin-body">
          {`One start every ${String(stride)} minutes, and nothing sooner than ${String(notice)} hours from now. Times are ${availability.timeZone}, and the page shows each visitor their own clock.`}
        </p>
      </section>

      <section className="mt-7 border-t border-admin-line pt-5">
        <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">The week</h2>
        <ul className="mt-3 divide-y divide-admin-line">
          {WEEKDAYS.map((name, weekday) => {
            const windows = week[weekday] ?? [];
            return (
              <li key={name} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                <span className="w-[5.5rem] text-[13px] font-semibold text-admin-ink">{name}</span>

                {windows.length === 0 ? (
                  <span className="text-[12.5px] text-admin-muted">Closed</span>
                ) : (
                  <ul className="flex flex-wrap items-center gap-2">
                    {windows.map((window, index) => (
                      // The index is the identity: two windows can hold the same hours while
                      // one of them is being typed into.
                      <li key={`${name}-${String(index)}`} className="flex items-center gap-1.5">
                        <input
                          type="time"
                          aria-label={`${name} opens`}
                          value={clock(window.startMinute)}
                          disabled={!mayWrite || busy}
                          onChange={(event) => {
                            editWeek(
                              weekday,
                              windows.map((entry, at) =>
                                at === index ? { ...entry, startMinute: minutesOf(event.target.value) } : entry,
                              ),
                            );
                          }}
                          className={field}
                        />
                        <span className="text-[12.5px] text-admin-muted">to</span>
                        <input
                          type="time"
                          aria-label={`${name} closes`}
                          value={clock(window.endMinute)}
                          disabled={!mayWrite || busy}
                          onChange={(event) => {
                            editWeek(
                              weekday,
                              windows.map((entry, at) =>
                                at === index ? { ...entry, endMinute: minutesOf(event.target.value) } : entry,
                              ),
                            );
                          }}
                          className={field}
                        />
                        {mayWrite ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              editWeek(
                                weekday,
                                windows.filter((_, at) => at !== index),
                              );
                            }}
                            className="h-8 rounded-[4px] border border-admin-line px-2 text-[12.5px] text-admin-body hover:border-admin-focus disabled:opacity-40"
                          >
                            {`Remove ${name} ${clock(window.startMinute)}`}
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
                    className="h-8 rounded-[4px] border border-admin-line px-2.5 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
                  >
                    {windows.length === 0 ? `Open ${name}` : `Another window on ${name}`}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12.5px] text-admin-body">
          {openDays === 0
            ? 'Every day is closed, so the page tells visitors there are no times rather than showing any.'
            : `${String(openDays)} of seven days are open. Two windows on one day sit either side of lunch; they may not overlap.`}
        </p>
      </section>

      <section className="mt-7 border-t border-admin-line pt-5">
        <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Days off</h2>
        <p className="mt-1.5 text-[12.5px] text-admin-body">
          A date here beats the week. Leave the hours empty to close the day completely, or set
          them to open only then.
        </p>
        <ul className="mt-3 space-y-2">
          {exceptions.map((entry, index) => (
            <li key={`exception-${String(index)}`} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="Date"
                value={entry.day}
                disabled={!mayWrite || busy}
                onChange={(event) => {
                  setExceptions((current) =>
                    current.map((item, at) => (at === index ? { ...item, day: event.target.value } : item)),
                  );
                  setSaved(false);
                }}
                className={field}
              />
              <input
                type="time"
                aria-label="Open from"
                value={entry.startMinute === null ? '' : clock(entry.startMinute)}
                disabled={!mayWrite || busy}
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
                className={field}
              />
              <input
                type="time"
                aria-label="Open until"
                value={entry.endMinute === null ? '' : clock(entry.endMinute)}
                disabled={!mayWrite || busy || entry.startMinute === null}
                onChange={(event) => {
                  const value = event.target.value === '' ? null : minutesOf(event.target.value);
                  setExceptions((current) => current.map((item, at) => (at === index ? { ...item, endMinute: value } : item)));
                  setSaved(false);
                }}
                className={field}
              />
              <input
                type="text"
                aria-label="Why"
                value={entry.reason}
                placeholder="Public holiday"
                maxLength={120}
                disabled={!mayWrite || busy}
                onChange={(event) => {
                  setExceptions((current) =>
                    current.map((item, at) => (at === index ? { ...item, reason: event.target.value } : item)),
                  );
                  setSaved(false);
                }}
                className={`w-52 ${field}`}
              />
              {mayWrite ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setExceptions((current) => current.filter((_, at) => at !== index));
                    setSaved(false);
                  }}
                  className="h-8 rounded-[4px] border border-admin-line px-2 text-[12.5px] text-admin-body hover:border-admin-focus disabled:opacity-40"
                >
                  {`Remove ${entry.day === '' ? 'this date' : entry.day}`}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {mayWrite ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setExceptions((current) => [...current, { day: '', startMinute: null, endMinute: null, reason: '' }]);
              setSaved(false);
            }}
            className="mt-3 h-8 rounded-[4px] border border-admin-line px-2.5 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
          >
            Add a date
          </button>
        ) : null}
      </section>

      {problem ? (
        <p role="alert" className="mt-5 text-[12.5px] text-danger">
          {problem}
        </p>
      ) : null}

      {mayWrite ? (
        <div className="mt-6 flex items-center gap-3 border-t border-admin-line pt-5">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="h-9 rounded-[4px] bg-admin-ink px-4 text-[12.5px] font-semibold text-admin-invert disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save availability'}
          </button>
          <p role="status" className="text-[12.5px] text-admin-body">
            {saved ? 'Saved. The page offers the new hours from the next visit.' : ''}
          </p>
        </div>
      ) : (
        <p className="mt-6 border-t border-admin-line pt-5 text-[12.5px] text-admin-muted">
          You can read these hours but not change them.
        </p>
      )}
    </div>
  );
}
