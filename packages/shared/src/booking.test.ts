import { describe, expect, it } from 'vitest';
import {
  type AvailabilityOverride,
  type AvailabilityRule,
  type SlotSources,
  addDays,
  dayKeyOf,
  generateSlots,
  isTimeZone,
  weekdayOf,
  zoneOffsetMinutes,
  zonedInstant,
} from './booking';

/**
 * The booking engine's arithmetic, without a database.
 *
 * Every test here is about one thing: a slot is a wall-clock time in the business's own
 * zone, and turning that into an instant is where booking engines go wrong. Los Angeles is
 * used throughout because it changes offset twice a year, which is the case that catches a
 * naive conversion.
 */

const LA = 'America/Los_Angeles';

/** Nine to five, Monday to Friday, a day's notice. */
const NINE_TO_FIVE: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  minimumNoticeHours: 24,
}));

function sources(overrides: Partial<SlotSources> = {}): SlotSources {
  return {
    timeZone: LA,
    durationMinutes: 30,
    bufferBefore: 0,
    bufferAfter: 0,
    rules: NINE_TO_FIVE,
    overrides: [],
    taken: [],
    from: '2026-10-05',
    to: '2026-10-05',
    // A Thursday, well clear of the notice window for the Monday being generated.
    now: new Date('2026-10-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('the clock in a zone', () => {
  it('knows a zone it has never heard of is not one', () => {
    expect(isTimeZone(LA)).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
  });

  it('reads the offset on each side of a daylight-saving change', () => {
    // Los Angeles is UTC-7 in October and UTC-8 in November.
    expect(zoneOffsetMinutes(new Date('2026-10-05T16:00:00.000Z'), LA)).toBe(-420);
    expect(zoneOffsetMinutes(new Date('2026-11-05T16:00:00.000Z'), LA)).toBe(-480);
  });

  it('turns a wall-clock time into the instant it happens, on both sides of the change', () => {
    // 09:00 in Los Angeles is 16:00 UTC in October, 17:00 UTC in November.
    expect(zonedInstant('2026-10-05', 9 * 60, LA).toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(zonedInstant('2026-11-09', 9 * 60, LA).toISOString()).toBe('2026-11-09T17:00:00.000Z');
  });

  it('round-trips an instant back to the day the zone was on', () => {
    // Half past four in the afternoon UTC is still the same morning in Los Angeles; an
    // hour before midnight UTC is the previous evening there.
    expect(dayKeyOf(new Date('2026-10-05T16:30:00.000Z'), LA)).toBe('2026-10-05');
    expect(dayKeyOf(new Date('2026-10-06T04:00:00.000Z'), LA)).toBe('2026-10-05');
  });

  it('counts weekdays on the wall calendar, not in UTC', () => {
    // Monday 5 October in Los Angeles, though it is already Tuesday in UTC.
    expect(weekdayOf(new Date('2026-10-06T04:00:00.000Z'), LA)).toBe(1);
  });

  it('adds days across a month end and across a daylight-saving change', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('generating slots', () => {
  it('fills the window with starts a duration apart', () => {
    const [day] = generateSlots(sources());
    expect(day?.slots).toHaveLength(16); // nine to five, half-hourly
    expect(day?.slots[0]?.startsAt.toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(day?.slots.at(-1)?.startsAt.toISOString()).toBe('2026-10-05T23:30:00.000Z');
  });

  it('leaves room for the whole of the last call, buffers included', () => {
    const [day] = generateSlots(sources({ durationMinutes: 45, bufferAfter: 15 }));
    // Each start takes an hour of the window, so eight fit between nine and five.
    expect(day?.slots).toHaveLength(8);
    expect(day?.slots.at(-1)?.endsAt.toISOString()).toBe('2026-10-05T23:45:00.000Z');
  });

  it('holds the wall-clock hours across a daylight-saving change', () => {
    const days = generateSlots(sources({ from: '2026-11-02', to: '2026-11-02' }));
    // Still nine in the morning in Los Angeles, now an hour later in UTC.
    expect(days[0]?.slots[0]?.startsAt.toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });

  it('offers nothing on a weekday with no rule', () => {
    // 4 October 2026 is a Sunday.
    const days = generateSlots(sources({ from: '2026-10-04', to: '2026-10-04' }));
    expect(days[0]?.slots).toEqual([]);
  });

  it('refuses a day the overrides close, whatever the weekly rules say', () => {
    const blocked: AvailabilityOverride = {
      day: '2026-10-05',
      blocked: true,
      startMinute: null,
      endMinute: null,
      reason: 'Company offsite',
    };
    expect(generateSlots(sources({ overrides: [blocked] }))[0]?.slots).toEqual([]);
  });

  it('lets an override open different hours on one day', () => {
    const shortened: AvailabilityOverride = {
      day: '2026-10-05',
      blocked: false,
      startMinute: 13 * 60,
      endMinute: 15 * 60,
      reason: 'Half day',
    };
    const [day] = generateSlots(sources({ overrides: [shortened] }));
    expect(day?.slots).toHaveLength(4);
    expect(day?.slots[0]?.startsAt.toISOString()).toBe('2026-10-05T20:00:00.000Z');
  });

  it('never offers a slot inside its own notice window', () => {
    // Half past nine on the morning itself: the whole day is inside 24 hours' notice.
    const days = generateSlots(sources({ now: new Date('2026-10-05T16:30:00.000Z') }));
    expect(days[0]?.slots).toEqual([]);
  });

  it('offers the part of a day that clears the notice window', () => {
    // Twenty-four hours before two in the afternoon: everything from then on is bookable.
    const days = generateSlots(sources({ now: new Date('2026-10-04T21:00:00.000Z') }));
    expect(days[0]?.slots[0]?.startsAt.toISOString()).toBe('2026-10-05T21:00:00.000Z');
  });

  it('removes a slot that is already booked, and only that one', () => {
    const taken = [new Date('2026-10-05T18:00:00.000Z')];
    const [day] = generateSlots(sources({ taken }));
    expect(day?.slots).toHaveLength(15);
    expect(day?.slots.some((slot) => slot.startsAt.getTime() === taken[0]?.getTime())).toBe(false);
  });

  it('covers every day of a range, including the ones with nothing on them', () => {
    const days = generateSlots(sources({ from: '2026-10-03', to: '2026-10-07' }));
    expect(days.map((entry) => entry.day)).toEqual([
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
    // Saturday and Sunday are closed; the three weekdays are not.
    expect(days.map((entry) => entry.slots.length > 0)).toEqual([false, false, true, true, true]);
  });

  it('returns nothing rather than looping when a duration would never fit', () => {
    expect(generateSlots(sources({ durationMinutes: 0, bufferBefore: 0, bufferAfter: 0 }))).toEqual([]);
  });
});
