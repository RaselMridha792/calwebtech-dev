'use server';

import { bookingRescheduleSchema, bookingTokenSchema, type BookingManageView } from '@calwebtech/shared';
import { cancelBooking, getBookingSlots, moveBooking } from '@/lib/api/booking';

/**
 * Moving and cancelling a call from its signed link (docs/08-decisions.md, 60). The token in
 * the form is the whole credential, and the API checks it; nothing here trusts the page.
 */
export type ManageState =
  | { status: 'idle' }
  | { status: 'done'; view: BookingManageView }
  /** The chosen time went, with the times as they now stand. */
  | { status: 'taken'; slots: NonNullable<Awaited<ReturnType<typeof getBookingSlots>>> | null }
  | { status: 'closed' }
  | { status: 'error'; message: string };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

const UNAVAILABLE = 'That could not be done just now. Please try again, or reply to your confirmation email.';

export async function moveCall(_state: ManageState, form: FormData): Promise<ManageState> {
  const parsed = bookingRescheduleSchema.safeParse({
    token: text(form, 'token'),
    startsAt: text(form, 'startsAt'),
    timezone: text(form, 'timezone'),
  });
  if (!parsed.success) return { status: 'error', message: 'Choose a new time first.' };

  const result = await moveBooking(parsed.data);
  if (result.status === 'done') return { status: 'done', view: result.view };
  if (result.status === 'taken') return { status: 'taken', slots: await getBookingSlots(text(form, 'type') || undefined) };
  if (result.status === 'closed') return { status: 'closed' };
  if (result.status === 'gone') return { status: 'error', message: 'This link no longer names a call.' };
  return { status: 'error', message: UNAVAILABLE };
}

export async function cancelCall(_state: ManageState, form: FormData): Promise<ManageState> {
  const token = bookingTokenSchema.safeParse(text(form, 'token'));
  if (!token.success) return { status: 'error', message: 'This link no longer names a call.' };

  const result = await cancelBooking(token.data);
  if (result.status === 'done') return { status: 'done', view: result.view };
  if (result.status === 'closed') return { status: 'closed' };
  if (result.status === 'gone') return { status: 'error', message: 'This link no longer names a call.' };
  return { status: 'error', message: UNAVAILABLE };
}
