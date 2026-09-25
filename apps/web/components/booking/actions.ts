'use server';

import { bookingSubmissionSchema, thankYouPath, type BookingConfirmation } from '@calwebtech/shared';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TURNSTILE_FIELD } from '@/lib/turnstile-field';
import { createBooking, getBookingSlots } from '@/lib/api/booking';
import { formElapsed } from '@/lib/form-clock-field';

/**
 * What the page shows after the visitor confirms.
 *
 * `taken` carries the slots as they now stand, so the form can re-offer without a reload:
 * the one thing worse than losing a slot is being told so and having to start again.
 */
export type BookingFormState =
  | { status: 'idle' }
  | { status: 'booked'; confirmation: BookingConfirmation }
  | { status: 'taken'; slots: NonNullable<Awaited<ReturnType<typeof getBookingSlots>>> | null }
  | { status: 'error'; message: string; fieldErrors: Record<string, string[]> };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export async function submitBooking(_state: BookingFormState, form: FormData): Promise<BookingFormState> {
  const parsed = bookingSubmissionSchema.safeParse({
    consultationType: text(form, 'consultationType'),
    startsAt: text(form, 'startsAt'),
    timezone: text(form, 'timezone'),
    name: text(form, 'name'),
    email: text(form, 'email'),
    phone: text(form, 'phone'),
    context: text(form, 'context'),
    source: text(form, 'source'),
    turnstileToken: text(form, TURNSTILE_FIELD),
    formElapsedMs: formElapsed(form),
  });


  if (!parsed.success) {
    // One list per field, the way the calculator's action builds them.
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: 'error', message: 'Some details are missing.', fieldErrors };
  }

  // The proxy in front of the web app sets this; the API trusts it for rate limiting.
  const forwarded = (await headers()).get('x-forwarded-for');
  const visitorIp = forwarded?.split(',')[0]?.trim() ?? null;

  const result = await createBooking(parsed.data, visitorIp);
  if (result.status === 'booked') {
    // A booked call goes to a page of its own (the owner's revision of 2026-09-22), which
    // repeats the time back. Only the instant and the visitor's zone travel in the address:
    // nothing about who booked it, since a thank-you URL ends up in histories and referrers.
    const query = new URLSearchParams({ at: result.confirmation.startsAt, tz: parsed.data.timezone });
    redirect(`${thankYouPath('booking')}?${query.toString()}`);
  }
  if (result.status === 'slot-taken') {
    return { status: 'taken', slots: await getBookingSlots(parsed.data.consultationType) };
  }
  if (result.status === 'bot-check') {
    return { status: 'error', message: 'That looked automated. Please try again.', fieldErrors: {} };
  }
  if (result.status === 'already-booked') {
    // In the visitor's own clock, as the rest of the form shows times.
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: parsed.data.timezone,
    }).format(new Date(result.startsAt));
    return {
      status: 'error',
      message: `You already have a call booked for ${when}. The link in its confirmation email moves it to another time.`,
      fieldErrors: {},
    };
  }
  return { status: 'error', message: result.message, fieldErrors: result.fieldErrors ?? {} };
}
