import 'server-only';
import {
  BOOKING_ERRORS,
  CONSULTATION_PATH,
  type BookingConfirmation,
  type BookingManageView,
  type BookingPageView,
  type BookingReschedule,
  type BookingSubmission,
  bookingConfirmationSchema,
  bookingManageViewSchema,
  bookingPageViewSchema,
  bookingSlotsViewSchema,
} from '@calwebtech/shared';
import { cache } from 'react';
import type { SitemapEntry } from '../sitemap';
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

/**
 * One page, and no record behind it. It is listed whether or not a slot is free today: the
 * page is the address the site links to and a buyer searches for, and an empty week is a
 * fact about this afternoon rather than a reason to drop it out of the index.
 */
export function sitemapEntries(): Promise<SitemapEntry[]> {
  return Promise.resolve([{ path: CONSULTATION_PATH, title: 'Book a consultation', section: 'Plan a project' }]);
}

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
  /** The address has a call still to come; its emails carry the link to move it. */
  | { status: 'already-booked'; startsAt: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string[]> };

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
  if (error === BOOKING_ERRORS.alreadyBooked && typeof body === 'object' && body !== null && 'startsAt' in body) {
    return { status: 'already-booked', startsAt: String(body.startsAt) };
  }
  if (response.status === 429) {
    return { status: 'error', message: 'Several bookings came from this address today. Please reply to your confirmation email instead.' };
  }
  if (response.status === 400 && typeof body === 'object' && body !== null && 'fieldErrors' in body) {
    const fieldErrors = body.fieldErrors as Record<string, string[]>;
    return { status: 'error', message: fieldErrors.email?.[0] ?? 'Some details are missing.', fieldErrors };
  }
  return { status: 'error', message: 'That could not be booked. Please try again.' };
}

// ---------------------------------------------------------------- the signed links

/**
 * The call a signed link names, or null when it names none (docs/08-decisions.md, 60). The
 * page answers 404 for that, the same as for a link that never existed.
 */
export async function getBookingLink(token: string): Promise<BookingManageView | null> {
  if (!hasApi()) return null;
  const response = await fetch(apiUrl(`/booking/manage/${encodeURIComponent(token)}`), { cache: 'no-store' });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`API responded ${String(response.status)} for a booking link`);
  return bookingManageViewSchema.parse(await response.json());
}

export type BookingLinkResult =
  | { status: 'done'; view: BookingManageView }
  /** The new time is not offered, or somebody took it meanwhile. */
  | { status: 'taken' }
  /** The call is cancelled or has happened, so it cannot change. */
  | { status: 'closed' }
  /** The link names nothing. */
  | { status: 'gone' }
  | { status: 'unavailable' };

async function postBookingLink(path: string, body: unknown): Promise<BookingLinkResult> {
  if (!hasApi()) return { status: 'unavailable' };
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.ok) return { status: 'done', view: bookingManageViewSchema.parse(await response.json()) };
  if (response.status === 404 || response.status === 400) return { status: 'gone' };
  if (response.status === 409) {
    const error = ((await response.json().catch(() => ({}))) as { error?: string }).error;
    return error === BOOKING_ERRORS.closed ? { status: 'closed' } : { status: 'taken' };
  }
  return { status: 'unavailable' };
}

export function moveBooking(input: BookingReschedule): Promise<BookingLinkResult> {
  return postBookingLink('/booking/reschedule', input);
}

export function cancelBooking(token: string): Promise<BookingLinkResult> {
  return postBookingLink('/booking/cancel', { token });
}
