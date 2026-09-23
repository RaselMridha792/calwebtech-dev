/**
 * Where a booking stands, and what the dashboard calls each state.
 *
 * On its own, with no Zod import, because the admin's status panel is a client component:
 * reached through the package's barrel it would carry the whole of Zod into the browser and
 * breach the per-route budget. `booking.ts` builds its enum from this list, so there is
 * still one source of truth, and the client imports `@calwebtech/shared/booking-status`.
 */
export const BOOKING_STATUSES = ['CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmed',
  RESCHEDULED: 'Rescheduled',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No show',
};
