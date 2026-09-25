import { z } from 'zod';
import { CONSULTATION_PATH } from './calculator';
import { answerBlockSchema, pageSeoSchema, questionSchema, requiredText } from './pages/common';
import { BOOKING_STATUSES } from './booking-status';

/*
 * The booking engine (docs/06-build-plan.md, task 5.1).
 *
 * Two rules shape everything here:
 *
 * 1. **The browser never decides what is bookable.** It renders the slots the API built
 *    and posts one back; the API rebuilds the list and refuses anything not in it. A slot
 *    picker is a convenience, not an authority.
 * 2. **Double booking is prevented by the database**, through the unique constraint on
 *    `(consultationTypeId, startsAt)`. Two people pressing confirm in the same second is
 *    not a race the application layer can win by checking first — one insert succeeds and
 *    the other is told the slot went.
 *
 * Nothing here arranges a meeting. The booking captures who, when and what about; the
 * meeting link is sent by hand afterwards.
 */

export { CONSULTATION_PATH };

/** Setting rows of the booking family. */
export const BOOKING_SETTING_KEYS = {
  /** Copy of `/book-a-consultation/` and the business timezone, validated below. */
  page: 'booking.page',
} as const;

/** The form id a booking's lead is attributed to. */
export const BOOKING_FORM_ID = 'book-a-consultation';

/** How far ahead the page offers slots. Beyond this, availability is guesswork. */
export const BOOKING_HORIZON_DAYS = 30;

// ---------------------------------------------------------------- time

/**
 * A calendar day in the business timezone, as `YYYY-MM-DD`. Not a `Date`: a day is a
 * label on a wall calendar, and turning it into an instant needs a timezone, which is
 * exactly the confusion this type exists to prevent.
 */
export const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export type DayKey = z.infer<typeof dayKeySchema>;

/** An IANA zone. Rejected early because every instant below is derived from one. */
export const timeZoneSchema = z.string().min(1).max(64).refine(isTimeZone, 'Unknown timezone');

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const PARTS = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = PARTS.get(timeZone);
  if (cached) return cached;
  const made = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  PARTS.set(timeZone, made);
  return made;
}

/** What a zone's clock reads at an instant, as numbers. */
function readClock(instant: Date, timeZone: string): { year: number; month: number; day: number; minutes: number } {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const at = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // `hour12: false` renders midnight as 24 in some engines.
  return { year: at('year'), month: at('month'), day: at('day'), minutes: (at('hour') % 24) * 60 + at('minute') };
}

/** How far a zone is from UTC at an instant, in minutes. Positive is east. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const clock = readClock(instant, timeZone);
  const asUtc = Date.UTC(clock.year, clock.month - 1, clock.day, 0, clock.minutes);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant at which a zone's clock reads this day and minute.
 *
 * Two passes, because the offset depends on the answer: the first guess uses the offset
 * at roughly the right time, and the second corrects it when that guess landed on the
 * other side of a daylight-saving change. A third pass would change nothing — offsets do
 * not shift twice within a day.
 */
export function zonedInstant(day: DayKey, minutes: number, timeZone: string): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, date, 0, minutes);
  const first = new Date(wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60_000);
  const second = new Date(wall - zoneOffsetMinutes(first, timeZone) * 60_000);
  return second;
}

/** The day a zone's clock is on at an instant. */
export function dayKeyOf(instant: Date, timeZone: string): DayKey {
  const { year, month, day } = readClock(instant, timeZone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The weekday a zone's clock is on at an instant, 0 for Sunday. */
export function weekdayOf(instant: Date, timeZone: string): number {
  const { year, month, day } = readClock(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The day `count` days after this one, on the wall calendar. */
export function addDays(day: DayKey, count: number): DayKey {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + count));
  return `${String(moved.getUTCFullYear()).padStart(4, '0')}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-${String(moved.getUTCDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- availability

/** A weekly window of bookable time, in minutes from midnight in the business timezone. */
export const availabilityRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  minimumNoticeHours: z.number().int().min(0).max(720).default(24),
});
export type AvailabilityRule = z.output<typeof availabilityRuleSchema>;

/** One date that does not follow the weekly rules: closed, or open at different hours. */
export const availabilityOverrideSchema = z.object({
  day: dayKeySchema,
  blocked: z.boolean(),
  startMinute: z.number().int().min(0).max(1440).nullable().default(null),
  endMinute: z.number().int().min(0).max(1440).nullable().default(null),
  reason: z.string().max(200).nullable().default(null),
});
export type AvailabilityOverride = z.output<typeof availabilityOverrideSchema>;

export interface SlotSources {
  /** The business's own timezone; every rule and override is written in it. */
  timeZone: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  rules: readonly AvailabilityRule[];
  overrides: readonly AvailabilityOverride[];
  /** Instants already booked for this consultation type. */
  taken: readonly Date[];
  /** The first and last day to generate, inclusive, in the business timezone. */
  from: DayKey;
  to: DayKey;
  now: Date;
}

/** One bookable start, as the instant it begins and the instant it ends. */
export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

/** A day on the wall calendar and what is bookable on it. */
export interface SlotDay {
  day: DayKey;
  slots: Slot[];
}

/**
 * Every bookable slot in a range, in the business timezone.
 *
 * A slot occupies the buffer before it, its own duration, and the buffer after — so the
 * gap between two starts is all three, and the window has to hold the whole of the last
 * one. A booked instant removes exactly its own start, which is what the database's
 * unique constraint is on; overlapping is impossible by construction because every start
 * is on the same stride.
 */
export function generateSlots(sources: SlotSources): SlotDay[] {
  const { timeZone, durationMinutes, bufferBefore, bufferAfter, rules, overrides, taken, now } = sources;
  const stride = bufferBefore + durationMinutes + bufferAfter;
  if (stride <= 0) return [];

  const takenAt = new Set(taken.map((instant) => instant.getTime()));
  const overrideFor = new Map(overrides.map((override) => [override.day, override]));
  const days: SlotDay[] = [];

  for (let day = sources.from; day <= sources.to; day = addDays(day, 1)) {
    const override = overrideFor.get(day);
    if (override?.blocked === true) {
      days.push({ day, slots: [] });
      continue;
    }

    const weekday = weekdayOf(zonedInstant(day, 12 * 60, timeZone), timeZone);
    const windows =
      override && override.startMinute !== null && override.endMinute !== null
        ? // An open override replaces the day's hours, and keeps the notice its rules ask
          // for so a date opened at short notice is not bookable within the hour.
          [
            {
              startMinute: override.startMinute,
              endMinute: override.endMinute,
              minimumNoticeHours: noticeFor(rules, weekday),
            },
          ]
        : rules.filter((rule) => rule.weekday === weekday);

    const slots: Slot[] = [];
    for (const window of windows) {
      const earliest = now.getTime() + window.minimumNoticeHours * 3_600_000;
      for (let minute = window.startMinute + bufferBefore; minute + durationMinutes + bufferAfter <= window.endMinute; minute += stride) {
        const startsAt = zonedInstant(day, minute, timeZone);
        if (startsAt.getTime() < earliest) continue;
        if (takenAt.has(startsAt.getTime())) continue;
        slots.push({ startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) });
      }
    }

    slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    days.push({ day, slots });
  }

  return days;
}

/** The longest notice any rule asks for on a weekday; the safe choice for an override. */
function noticeFor(rules: readonly AvailabilityRule[], weekday: number): number {
  const onDay = rules.filter((rule) => rule.weekday === weekday).map((rule) => rule.minimumNoticeHours);
  return onDay.length > 0 ? Math.max(...onDay) : 24;
}

// ---------------------------------------------------------------- the page

export const consultationTypeViewSchema = z.object({
  slug: z.string().min(1).max(80),
  name: requiredText(80),
  durationMinutes: z.number().int().positive(),
  description: requiredText(300).nullable(),
});
export type ConsultationTypeView = z.output<typeof consultationTypeViewSchema>;

export const slotViewSchema = z.object({
  /** The instant the call starts, in UTC. The browser renders it in the visitor's zone. */
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export const slotDayViewSchema = z.object({
  day: dayKeySchema,
  slots: z.array(slotViewSchema),
});

/** What `GET /booking/slots` returns. */
export const bookingSlotsViewSchema = z.object({
  consultationType: consultationTypeViewSchema,
  /** The business's zone, so the page can say which one the times were set in. */
  timeZone: timeZoneSchema,
  days: z.array(slotDayViewSchema),
});
export type BookingSlotsView = z.output<typeof bookingSlotsViewSchema>;

/** Copy of `/book-a-consultation/`, stored in the `booking.page` setting. */
export const bookingPageContentSchema = z.object({
  seo: pageSeoSchema,
  title: requiredText(120),
  answerBlock: answerBlockSchema,
  intro: requiredText(600),
  /** The business's own timezone. Every availability rule is written in it. */
  timeZone: timeZoneSchema,
  steps: z.object({
    slot: z.object({ heading: questionSchema(), intro: requiredText(400).nullable().default(null) }),
    details: z.object({ heading: questionSchema(), intro: requiredText(400).nullable().default(null) }),
    review: z.object({ heading: questionSchema(), intro: requiredText(400).nullable().default(null) }),
  }),
  /** Shown when no slot is bookable inside the horizon. */
  empty: requiredText(300),
  submitLabel: requiredText(40),
  footnote: requiredText(300).nullable().default(null),
  success: z.object({ heading: requiredText(80), body: requiredText(400) }),
  /** What the page says about the meeting link, which a person sends by hand. */
  meetingNote: requiredText(300),
});
export type BookingPageContent = z.output<typeof bookingPageContentSchema>;
export type BookingPageContentInput = z.input<typeof bookingPageContentSchema>;

/**
 * The page's copy before anybody edits it.
 *
 * One copy, used by both the seed and the snapshot import, so a seeded database and an
 * imported one say the same thing. These are working defaults, not the owner's words: the
 * whole object is a setting, editable without a deploy, and neither writer overwrites one
 * that already exists.
 */
export const DEFAULT_BOOKING_PAGE: BookingPageContentInput = {
  seo: {
    title: 'Book a consultation',
    description: 'Pick a time that suits you. Thirty minutes, no obligation, and a person on the other end.',
  },
  title: 'Book a consultation',
  answerBlock:
    'Choose a time, tell us what you are trying to fix, and we will confirm by email. The call is thirty minutes and there is nothing to prepare.',
  intro:
    'Every call starts with what is going wrong now rather than with a deck. Bring the site, the numbers or the deadline you are working to, and we will tell you what we would do about it.',
  timeZone: 'America/Los_Angeles',
  steps: {
    slot: { heading: 'When suits you?', intro: 'Times are shown in your own timezone.' },
    details: { heading: 'How do we reach you?', intro: null },
    review: { heading: 'Does this look right?', intro: null },
  },
  empty: 'There is nothing bookable in the next few weeks. Send us a message and we will find a time by email.',
  submitLabel: 'Confirm this time',
  footnote: 'We hold the slot as soon as you confirm. Nothing is charged and there is no obligation.',
  success: {
    heading: 'That time is yours.',
    body: 'A confirmation is on its way. We will send the meeting link before the call.',
  },
  meetingNote: 'We send the meeting link by email once the time is confirmed, so nothing is scheduled automatically.',
};

/** The consultation a new database can take, and the hours it can be taken in. */
export const DEFAULT_CONSULTATION = {
  slug: 'consultation',
  name: 'Consultation',
  durationMinutes: 30,
  bufferAfter: 15,
  description: 'Thirty minutes on what you are trying to fix, and what it would take.',
  /** Nine to five on weekdays, a day's notice, in the timezone above. */
  weekdays: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  minimumNoticeHours: 24,
} as const;

/** What `GET /pages/book-a-consultation` returns. */
export const bookingPageViewSchema = z.object({
  content: bookingPageContentSchema,
  slots: bookingSlotsViewSchema,
});
export type BookingPageView = z.output<typeof bookingPageViewSchema>;

// ---------------------------------------------------------------- submitting

const blankToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

export const bookingSubmissionSchema = z.object({
  consultationType: z.string().min(1).max(80),
  /** One of the instants the API offered. It rebuilds the list and checks. */
  startsAt: z.iso.datetime(),
  /** The visitor's zone, stored so the team knows what clock they read. */
  timezone: timeZoneSchema,
  name: requiredText(120),
  email: z.email().max(200),
  phone: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
  /** What they want to talk about. The one thing that makes a call worth having. */
  context: z.preprocess(blankToUndefined, z.string().trim().max(2000).optional()),
  /** Carried from the cost calculator when the visitor arrives from its result. */
  source: z.preprocess(blankToUndefined, z.string().trim().max(60).optional()),
  turnstileToken: z.preprocess(blankToUndefined, z.string().max(2048).optional()),
});
export type BookingSubmission = z.output<typeof bookingSubmissionSchema>;

export const bookingConfirmationSchema = z.object({
  status: z.literal('booked'),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  consultationType: requiredText(80),
  /** Signed links the confirmation email repeats. */
  rescheduleToken: z.string().min(1),
  cancelToken: z.string().min(1),
});
export type BookingConfirmation = z.infer<typeof bookingConfirmationSchema>;

/** Why a booking was refused, in the words the page shows. */
export const BOOKING_ERRORS = {
  slotGone: 'slot_taken',
  slotUnknown: 'slot_unavailable',
  typeUnknown: 'consultation_type_unknown',
  /** A signed link that names no booking, or names one that can no longer change. */
  linkUnknown: 'booking_link_unknown',
  /** The call is cancelled, or has already happened. */
  closed: 'booking_closed',
} as const;

// ---------------------------------------------------------------- moving and cancelling

/**
 * `/book-a-consultation/reschedule/<token>/` and `/book-a-consultation/cancel/<token>/`
 * (docs/08-decisions.md, 60). The token is the credential: whoever holds the link from the
 * confirmation email may move or cancel that one call, and nothing else. It is a random
 * 192-bit value stored on the booking, so it cannot be guessed and names one call.
 */
export const bookingTokenSchema = z.string().trim().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const BOOKING_LINK_ACTIONS = ['reschedule', 'cancel'] as const;
export type BookingLinkAction = (typeof BOOKING_LINK_ACTIONS)[number];

/** What a signed link shows: the call it is for, and whether it can still change. */
export const bookingManageViewSchema = z.object({
  action: z.enum(BOOKING_LINK_ACTIONS),
  consultationType: requiredText(80),
  durationMinutes: z.number().int().positive(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  /** The zone the visitor booked in. */
  timezone: z.string().min(1),
  /** False once the call is cancelled or its time has passed. */
  open: z.boolean(),
  cancelled: z.boolean(),
});
export type BookingManageView = z.infer<typeof bookingManageViewSchema>;

export const bookingRescheduleSchema = z.object({
  token: bookingTokenSchema,
  /** One of the instants the API offered, as for a new booking. */
  startsAt: z.iso.datetime(),
  timezone: timeZoneSchema,
});
export type BookingReschedule = z.infer<typeof bookingRescheduleSchema>;

export const bookingCancelSchema = z.object({ token: bookingTokenSchema });
export type BookingCancel = z.infer<typeof bookingCancelSchema>;

/** The addresses of the two pages a booking's emails link to. */
export function bookingLinkPath(action: BookingLinkAction, token: string): string {
  return `${CONSULTATION_PATH}${action}/${encodeURIComponent(token)}/`;
}

// ---------------------------------------------------------------- the dashboard

export { BOOKING_STATUSES, BOOKING_STATUS_LABELS, type BookingStatus } from './booking-status';

export const ADMIN_BOOKING_PAGE_SIZE = 25;

export const adminBookingQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  /** `upcoming` is the default view: a past call is history, not a to-do. */
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  search: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(ADMIN_BOOKING_PAGE_SIZE),
});
export type AdminBookingQuery = z.output<typeof adminBookingQuerySchema>;

export const adminBookingSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  /** The zone the visitor booked in, so the team reads their clock as well as its own. */
  timezone: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: z.enum(BOOKING_STATUSES),
  consultationType: z.object({ name: z.string(), durationMinutes: z.number().int() }),
  context: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /** The lead this call came from, when the visitor had already left one. */
  leadId: z.string().nullable(),
});
export type AdminBooking = z.infer<typeof adminBookingSchema>;

export const adminBookingListSchema = z.object({
  items: z.array(adminBookingSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminBookingList = z.infer<typeof adminBookingListSchema>;

export const adminBookingDetailSchema = adminBookingSchema.extend({
  events: z.array(z.object({ id: z.string(), type: z.string(), createdAt: z.iso.datetime() })),
});
export type AdminBookingDetail = z.infer<typeof adminBookingDetailSchema>;

/** What an admin may change about a booking: where it stands, and what was said. */
export const adminBookingUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  notes: z.preprocess(blankToUndefined, z.string().trim().max(4000).optional()),
});
export type AdminBookingUpdate = z.output<typeof adminBookingUpdateSchema>;

// ------------------------------------------------- availability, from the dashboard

/**
 * The hours a consultation can be booked in, as the dashboard reads and writes them.
 *
 * Minutes from midnight in the business's own timezone, which is the unit the generator
 * works in: a rule written as "09:00" would have to be parsed somewhere, and the one place
 * a clock face belongs is the input the person types into.
 */
export const adminAvailabilityRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(24 * 60),
  endMinute: z.number().int().min(0).max(24 * 60),
  minimumNoticeHours: z.number().int().min(0).max(24 * 30),
});
export type AdminAvailabilityRule = z.infer<typeof adminAvailabilityRuleSchema>;

export const adminAvailabilityOverrideSchema = z.object({
  id: z.string(),
  /** A calendar day in the business timezone: `2026-10-13`. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blocked: z.boolean(),
  startMinute: z.number().int().min(0).max(24 * 60).nullable(),
  endMinute: z.number().int().min(0).max(24 * 60).nullable(),
  reason: z.string().nullable(),
});
export type AdminAvailabilityOverride = z.infer<typeof adminAvailabilityOverrideSchema>;

export const adminAvailabilitySchema = z.object({
  consultationType: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    durationMinutes: z.number().int(),
    bufferBefore: z.number().int(),
    bufferAfter: z.number().int(),
    active: z.boolean(),
  }),
  /** The business's own zone, from the page setting. Read-only here; the page owns it. */
  timeZone: z.string(),
  rules: z.array(adminAvailabilityRuleSchema),
  overrides: z.array(adminAvailabilityOverrideSchema),
  horizonDays: z.number().int(),
});
export type AdminAvailability = z.infer<typeof adminAvailabilitySchema>;

/**
 * What the dashboard may change. The whole week is sent at once rather than a rule at a
 * time: a week is read as one thing, and a partial save leaves availability in a state
 * nobody chose.
 *
 * An empty `rules` list is allowed and means the calendar is closed. It is not a mistake to
 * guard against — a firm that stops taking calls for a month needs to be able to say so.
 */
export const adminAvailabilityUpdateSchema = z
  .object({
    durationMinutes: z.number().int().min(5).max(8 * 60),
    bufferBefore: z.number().int().min(0).max(4 * 60),
    bufferAfter: z.number().int().min(0).max(4 * 60),
    rules: z.array(adminAvailabilityRuleSchema).max(7 * 4),
    overrides: z.array(adminAvailabilityOverrideSchema.omit({ id: true })).max(365),
  })
  .refine((value) => value.rules.every((rule) => rule.endMinute > rule.startMinute), {
    message: 'A day has to end after it starts',
    path: ['rules'],
  })
  .refine(
    (value) =>
      value.rules.every(
        (rule) => rule.endMinute - rule.startMinute >= value.bufferBefore + value.durationMinutes + value.bufferAfter,
      ),
    { message: 'A window that cannot hold one call would offer no times', path: ['rules'] },
  )
  .refine((value) => !hasOverlap(value.rules), {
    message: 'Two windows on the same day overlap',
    path: ['rules'],
  })
  .refine((value) => new Set(value.overrides.map((entry) => entry.day)).size === value.overrides.length, {
    message: 'One entry per date',
    path: ['overrides'],
  });
export type AdminAvailabilityUpdate = z.output<typeof adminAvailabilityUpdateSchema>;

/** Two windows on one weekday may sit either side of lunch, but they may not overlap. */
function hasOverlap(rules: readonly AdminAvailabilityRule[]): boolean {
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const day = rules.filter((rule) => rule.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
    for (let index = 1; index < day.length; index += 1) {
      const previous = day[index - 1];
      const current = day[index];
      if (previous && current && current.startMinute < previous.endMinute) return true;
    }
  }
  return false;
}
