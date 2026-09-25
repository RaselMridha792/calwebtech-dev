import { randomBytes } from 'node:crypto';
import { Prisma } from '@calwebtech/db';
import {
  BOOKING_ERRORS,
  BOOKING_FORM_ID,
  BOOKING_HORIZON_DAYS,
  BOOKING_SETTING_KEYS,
  DEFAULT_BOOKING_PAGE,
  type AvailabilityOverride,
  type AvailabilityRule,
  type BookingConfirmation,
  type BookingLinkAction,
  type BookingManageView,
  type BookingPageView,
  type BookingReschedule,
  type BookingSlotsView,
  type BookingSubmission,
  addDays,
  bookingPageContentSchema,
  bookingSlotsViewSchema,
  dayKeyOf,
  generateSlots,
} from '@calwebtech/shared';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionGuard } from '../antispam/submission-guard';
import { refuseUnlessPlausible } from '../leads/leads.service';
import { EmailQueue } from '../queue/email-queue';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TurnstileService } from '../turnstile/turnstile.service';
import { reminderJobIds, reminderJobs, type RemindedCall } from './booking-reminders';

/**
 * The booking engine (docs/06-build-plan.md, task 5.1).
 *
 * The browser is shown a list of slots and posts one back. This service rebuilds that list
 * from the rules and refuses anything not in it, because a slot the page offered five
 * minutes ago may not exist now and a slot it never offered may have been typed in.
 *
 * The last word belongs to the database. `Booking` is unique on
 * `(consultationTypeId, slotStartsAt)` — the time a call holds while it is on — so when two
 * people confirm the same slot in the same second one insert succeeds and the other raises
 * P2002, which this service reports as "that time has gone" rather than as a failure.
 * Checking first and inserting second would leave exactly the window the constraint closes.
 * A cancelled call holds no time, so its slot can be booked again.
 */
@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly settings: SettingsService,
    private readonly emailQueue: EmailQueue,
    private readonly guard: SubmissionGuard,
  ) {}

  /**
   * The page's copy and its business timezone.
   *
   * A database with no `booking.page` row is an ordinary state, not a fault: a fresh
   * production stack has migrations but no settings yet. The shipped default answers for it,
   * so the page renders and says there are no times rather than returning 500 to every
   * visitor. A row that exists and is wrong still throws, because that is a fault.
   */
  private async content() {
    const row = await this.settings.get(BOOKING_SETTING_KEYS.page);
    return bookingPageContentSchema.parse(row ?? DEFAULT_BOOKING_PAGE);
  }

  /** The type a booking is for, with the rules that decide when it can happen. */
  private async consultationType(slug?: string) {
    const type = await this.prisma.client.consultationType.findFirst({
      where: slug ? { slug, active: true } : { active: true },
      orderBy: { name: 'asc' },
      include: { rules: true },
    });
    if (!type) throw new NotFoundException(BOOKING_ERRORS.typeUnknown);
    return type;
  }

  /**
   * Every bookable slot inside the horizon, in the business timezone.
   *
   * Overrides are read for the whole window rather than per day, and bookings only for
   * the window, so a year of history never enters the calculation.
   */
  async slots(typeSlug?: string): Promise<BookingSlotsView> {
    const content = await this.content();
    const type = await this.consultationType(typeSlug);
    const now = new Date();
    const from = dayKeyOf(now, content.timeZone);
    const to = addDays(from, BOOKING_HORIZON_DAYS);

    const [overrides, taken] = await Promise.all([
      this.prisma.client.availabilityOverride.findMany({
        where: { date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) } },
      }),
      this.prisma.client.booking.findMany({
        where: {
          consultationTypeId: type.id,
          status: { notIn: ['CANCELLED'] },
          startsAt: { gte: now },
        },
        select: { startsAt: true },
      }),
    ]);

    const rules: AvailabilityRule[] = type.rules.map((rule) => ({
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
      minimumNoticeHours: rule.minimumNoticeHours,
    }));
    const dayOverrides: AvailabilityOverride[] = overrides.map((override) => ({
      day: override.date.toISOString().slice(0, 10),
      blocked: override.blocked,
      startMinute: override.startMinute,
      endMinute: override.endMinute,
      reason: override.reason,
    }));

    const days = generateSlots({
      timeZone: content.timeZone,
      durationMinutes: type.durationMinutes,
      bufferBefore: type.bufferBefore,
      bufferAfter: type.bufferAfter,
      rules,
      overrides: dayOverrides,
      taken: taken.map((booking) => booking.startsAt),
      from,
      to,
      now,
    });

    return bookingSlotsViewSchema.parse({
      consultationType: {
        slug: type.slug,
        name: type.name,
        durationMinutes: type.durationMinutes,
        description: type.description,
      },
      timeZone: content.timeZone,
      days: days
        .filter((day) => day.slots.length > 0)
        .map((day) => ({
          day: day.day,
          slots: day.slots.map((slot) => ({
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
          })),
        })),
    });
  }

  /** The page: its copy and the slots it can offer right now. */
  async page(): Promise<BookingPageView> {
    const [content, slots] = await Promise.all([this.content(), this.slots()]);
    return { content, slots };
  }

  /**
   * Stores a booking, or says why not.
   *
   * The order matters: the bot check first, then the slot rebuilt and checked, then the
   * insert that the database arbitrates. The contact is upserted in the same transaction
   * as the booking, so a refused slot leaves no half-written person behind.
   */
  async create(input: BookingSubmission, visitorIp: string | undefined): Promise<BookingConfirmation> {
    const email = input.email.trim().toLowerCase();
    await refuseUnlessPlausible(this.guard, 'booking', email, input.formElapsedMs);

    const botCheck = await this.turnstile.verify(input.turnstileToken, visitorIp);
    if (botCheck === 'failed') throw new ForbiddenException({ error: 'bot_check_failed' });
    if (!(await this.guard.withinLimit('booking', email))) {
      throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // One call coming up per address: a second is almost always the same person trying again,
    // and the first one's emails carry the link to move it (docs/08-decisions.md, 61).
    const upcoming = await this.prisma.client.booking.findFirst({
      where: { email, status: { in: ['CONFIRMED', 'RESCHEDULED'] }, startsAt: { gt: new Date() } },
      select: { startsAt: true },
      orderBy: { startsAt: 'asc' },
    });
    if (upcoming) {
      throw new ConflictException({ error: BOOKING_ERRORS.alreadyBooked, startsAt: upcoming.startsAt.toISOString() });
    }

    const type = await this.consultationType(input.consultationType);
    const startsAt = new Date(input.startsAt);
    const offered = await this.slots(type.slug);
    const isOffered = offered.days.some((day) => day.slots.some((slot) => slot.startsAt === startsAt.toISOString()));
    if (!isOffered) throw new ConflictException({ error: BOOKING_ERRORS.slotUnknown });

    const endsAt = new Date(startsAt.getTime() + type.durationMinutes * 60_000);
    const rescheduleToken = randomBytes(24).toString('base64url');
    const cancelToken = randomBytes(24).toString('base64url');

    try {
      const booking = await this.prisma.client.$transaction(async (tx) => {
        const contact = await tx.contact.upsert({
          where: { email },
          create: { email, name: input.name, phone: input.phone ?? null },
          update: { name: input.name, ...(input.phone ? { phone: input.phone } : {}) },
        });
        const created = await tx.booking.create({
          data: {
            consultationTypeId: type.id,
            contactId: contact.id,
            name: input.name,
            email,
            phone: input.phone ?? null,
            timezone: input.timezone,
            startsAt,
            endsAt,
            slotStartsAt: startsAt,
            context: input.context ?? null,
            rescheduleToken,
            cancelToken,
          },
        });
        await tx.bookingEvent.create({
          data: { bookingId: created.id, type: 'created', detail: { source: input.source ?? BOOKING_FORM_ID } },
        });
        return created;
      });

      await this.notify(booking.id, input, type.name, startsAt, endsAt, { rescheduleToken, cancelToken });
      await this.remind({
        id: booking.id,
        name: input.name,
        email,
        consultationType: type.name,
        startsAt,
        endsAt,
        timezone: input.timezone,
        rescheduleToken,
        cancelToken,
      });
      return {
        status: 'booked',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        consultationType: type.name,
        rescheduleToken,
        cancelToken,
      };
    } catch (error) {
      // P2002 is the unique constraint on (consultationTypeId, startsAt): somebody else
      // confirmed this slot between the page loading and this insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: BOOKING_ERRORS.slotGone });
      }
      throw error;
    }
  }

  /**
   * Queues the confirmation and the notification.
   *
   * A failure here never fails the booking: the call is in the database and the team can
   * see it, which is more than an email would have told them.
   */
  private async notify(
    bookingId: string,
    input: BookingSubmission,
    typeName: string,
    startsAt: Date,
    endsAt: Date,
    manage: { rescheduleToken: string; cancelToken: string },
  ): Promise<void> {
    try {
      const recipients = await this.settings.leadNotificationRecipients();
      await this.emailQueue.enqueue([
        {
          template: 'booking-confirmation',
          to: [input.email],
          bookingId,
          name: input.name,
          consultationType: typeName,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: input.timezone,
          manage,
        },
        ...(recipients.length > 0
          ? [
              {
                template: 'booking-notification' as const,
                to: recipients,
                bookingId,
                name: input.name,
                email: input.email,
                consultationType: typeName,
                startsAt: startsAt.toISOString(),
                timezone: input.timezone,
                context: input.context ?? null,
              },
            ]
          : []),
      ]);
    } catch (error) {
      this.logger.error(`Booking ${bookingId} was stored but its emails could not be queued.`, error);
    }
  }

  /** Queues a call's reminders. As with the confirmation, a failure never fails the booking. */
  private async remind(call: RemindedCall): Promise<void> {
    try {
      await this.emailQueue.schedule(reminderJobs(call));
    } catch (error) {
      this.logger.error(`Booking ${call.id} was stored but its reminders could not be queued.`, error);
    }
  }

  /** Takes a call's reminders for a time off the queue; the worker's own check covers a failure. */
  private async forget(call: { id: string; startsAt: Date }): Promise<void> {
    try {
      await this.emailQueue.remove(reminderJobIds(call));
    } catch (error) {
      this.logger.warn(`Booking ${call.id}: its reminders could not be removed; the worker will skip them.`, error);
    }
  }

  // ---------------------------------------------------------------- the signed links

  /**
   * The booking a signed link names, and which action it allows. The two tokens are
   * different on purpose: a link forwarded to cancel a call cannot move it, and one to move
   * it cannot cancel it.
   */
  private async byToken(token: string) {
    const booking = await this.prisma.client.booking.findFirst({
      where: { OR: [{ rescheduleToken: token }, { cancelToken: token }] },
      include: { consultationType: { select: { slug: true, name: true, durationMinutes: true } } },
    });
    if (!booking) throw new NotFoundException({ error: BOOKING_ERRORS.linkUnknown });
    const action: BookingLinkAction = booking.rescheduleToken === token ? 'reschedule' : 'cancel';
    return { booking, action };
  }

  private view(
    booking: Awaited<ReturnType<BookingService['byToken']>>['booking'],
    action: BookingLinkAction,
    now: Date,
  ): BookingManageView {
    const cancelled = booking.status === 'CANCELLED';
    return {
      action,
      consultationTypeSlug: booking.consultationType.slug,
      consultationType: booking.consultationType.name,
      durationMinutes: booking.consultationType.durationMinutes,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      timezone: booking.timezone,
      cancelled,
      open: !cancelled && ACTIVE_STATUSES.has(booking.status) && booking.startsAt.getTime() > now.getTime(),
    };
  }

  /** What a signed link shows. 404 for a token that names no booking. */
  async manage(token: string): Promise<BookingManageView> {
    const { booking, action } = await this.byToken(token);
    return this.view(booking, action, new Date());
  }

  /**
   * Cancels the call a cancel link names. Cancelling twice answers as the first did, so a
   * double click or a reload is not an error. A call already held, or one the team has
   * closed, cannot be cancelled from the link.
   */
  async cancel(token: string): Promise<BookingManageView> {
    const now = new Date();
    const { booking, action } = await this.byToken(token);
    if (action !== 'cancel') throw new NotFoundException({ error: BOOKING_ERRORS.linkUnknown });
    if (booking.status === 'CANCELLED') return this.view(booking, action, now);
    if (!this.view(booking, action, now).open) throw new ConflictException({ error: BOOKING_ERRORS.closed });

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.booking.update({
        where: { id: booking.id },
        // The time is given back: a cancelled call holds no slot.
        data: { status: 'CANCELLED', slotStartsAt: null },
        include: { consultationType: { select: { slug: true, name: true, durationMinutes: true } } },
      });
      await tx.bookingEvent.create({ data: { bookingId: booking.id, type: 'cancelled', detail: { by: 'visitor' } } });
      return row;
    });

    await this.forget(booking);
    await this.announce(updated, 'cancelled', null);
    return this.view(updated, action, now);
  }

  /**
   * Moves the call a reschedule link names, through the same rules as a new booking: the new
   * time must be one the engine offers now, and the database's unique constraint settles two
   * people choosing it at once. The tokens stay the same, so the links keep working.
   */
  async reschedule(input: BookingReschedule): Promise<BookingManageView> {
    const now = new Date();
    const { booking, action } = await this.byToken(input.token);
    if (action !== 'reschedule') throw new NotFoundException({ error: BOOKING_ERRORS.linkUnknown });
    if (!this.view(booking, action, now).open) throw new ConflictException({ error: BOOKING_ERRORS.closed });

    const startsAt = new Date(input.startsAt);
    if (startsAt.getTime() === booking.startsAt.getTime()) return this.view(booking, action, now);
    const offered = await this.slots(booking.consultationType.slug);
    const isOffered = offered.days.some((day) => day.slots.some((slot) => slot.startsAt === startsAt.toISOString()));
    if (!isOffered) throw new ConflictException({ error: BOOKING_ERRORS.slotUnknown });
    const endsAt = new Date(startsAt.getTime() + booking.consultationType.durationMinutes * 60_000);

    let updated: typeof booking;
    try {
      updated = await this.prisma.client.$transaction(async (tx) => {
        const row = await tx.booking.update({
          where: { id: booking.id },
          data: { startsAt, endsAt, slotStartsAt: startsAt, timezone: input.timezone, status: 'RESCHEDULED' },
          include: { consultationType: { select: { slug: true, name: true, durationMinutes: true } } },
        });
        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            type: 'rescheduled',
            detail: { from: booking.startsAt.toISOString(), to: startsAt.toISOString(), by: 'visitor' },
          },
        });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ error: BOOKING_ERRORS.slotGone });
      }
      throw error;
    }

    await this.forget(booking);
    await this.remind({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      consultationType: updated.consultationType.name,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      timezone: updated.timezone,
      rescheduleToken: updated.rescheduleToken,
      cancelToken: updated.cancelToken,
    });
    await this.announce(updated, 'moved', booking.startsAt);
    return this.view(updated, action, now);
  }

  /** Tells the visitor and the team that a call moved or was cancelled. Never fails the change. */
  private async announce(
    booking: Awaited<ReturnType<BookingService['byToken']>>['booking'],
    change: 'moved' | 'cancelled',
    previousStartsAt: Date | null,
  ): Promise<void> {
    try {
      const recipients = await this.settings.leadNotificationRecipients();
      const call = {
        bookingId: booking.id,
        name: booking.name,
        consultationType: booking.consultationType.name,
        startsAt: booking.startsAt.toISOString(),
        timezone: booking.timezone,
      };
      await this.emailQueue.enqueue([
        {
          template: 'booking-changed',
          to: [booking.email],
          ...call,
          endsAt: booking.endsAt.toISOString(),
          change,
          previousStartsAt: previousStartsAt?.toISOString() ?? null,
          manage: { rescheduleToken: booking.rescheduleToken, cancelToken: booking.cancelToken },
        },
        ...(recipients.length > 0
          ? [
              {
                template: 'booking-notification' as const,
                to: recipients,
                ...call,
                email: booking.email,
                context: booking.context,
                change,
                previousStartsAt: previousStartsAt?.toISOString() ?? null,
              },
            ]
          : []),
      ]);
    } catch (error) {
      this.logger.error(`Booking ${booking.id} was ${change} but its emails could not be queued.`, error);
    }
  }
}

/** A call in one of these still happens; the rest are over or cancelled. */
const ACTIVE_STATUSES = new Set(['CONFIRMED', 'RESCHEDULED']);
