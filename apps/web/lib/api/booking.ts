import 'server-only';
import {
  BOOKING_ERRORS,
  type BookingConfirmation,
  type BookingPageView,
  type BookingSubmission,
  bookingConfirmationSchema,
  bookingPageViewSchema,
  bookingSlotsViewSchema,
} from '@calwebtech/shared';
import { cache } from 'react';
import { apiUrl, hasApi } from './core';

/**
 * `/book-a-consultation/`.
 *
 * There is no snapshot to fall back to and there never will be: the page's whole content
 * is which times are free, which is a fact about the database at this second. Without the
 * API the page says so rather than showing times nobody can book.
 */
export const getBookingPage = cache(async (): Promise<BookingPageView | null> => {
  if (!hasApi()) return null;
  const response = await fetch(apiUrl('/pages/book-a-consultation'), { cache: 'no-store' });
  // 404 means no consultation type is set up yet, which the page treats as "no times".
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for the booking page`);
  return bookingPageViewSchema.parse(await response.json());
});

/** The slots as they stand. Called again after a refused slot, so the page can re-offer. */
export async function getBookingSlots(type?: string) {
  if (!hasApi()) return null;
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  const response = await fetch(apiUrl(`/booking/slots${query}`), { cache: 'no-store' });
  if (!response.ok) return null;
  return bookingSlotsViewSchema.parse(await response.json());
}

export type BookingResult =
  | { status: 'booked'; confirmation: BookingConfirmation }
  | { status: 'slot-taken' }
  | { status: 'bot-check' }
  | { status: 'error'; message: string };

/**
 * Sends a booking and reports what happened in the page's own terms.
 *
 * A taken slot is not an error — it is the ordinary outcome of two people wanting the same
 * hour — so it comes back as its own case for the page to re-offer from, rather than as a
 * message the visitor has to interpret.
 */
export async function createBooking(input: BookingSubmission, visitorIp: string | null): Promise<BookingResult> {
  if (!hasApi()) return { status: 'error', message: 'Booking is unavailable right now.' };

  const response = await fetch(apiUrl('/booking'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // The API trusts this because the proxy in front of it sets it (docs/01).
      ...(visitorIp ? { 'x-forwarded-for': visitorIp } : {}),
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (response.ok) {
    return { status: 'booked', confirmation: bookingConfirmationSchema.parse(await response.json()) };
  }

  const body: unknown = await response.json().catch(() => null);
  const error = typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : '';
  if (response.status === 403 && error === 'bot_check_failed') return { status: 'bot-check' };
  if (error === BOOKING_ERRORS.slotGone || error === BOOKING_ERRORS.slotUnknown) return { status: 'slot-taken' };
  return { status: 'error', message: 'That could not be booked. Please try again.' };
}
